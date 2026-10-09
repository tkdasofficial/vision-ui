import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getProviderKey, logUsage, userIdFromAuth } from "../_shared/provider-router.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map user-friendly format names to Google TTS audioEncoding values
const FORMAT_MAP: Record<string, { encoding: string; mime: string; ext: string }> = {
  mp3: { encoding: "MP3", mime: "audio/mpeg", ext: "mp3" },
  wav: { encoding: "LINEAR16", mime: "audio/wav", ext: "wav" },
  ogg: { encoding: "OGG_OPUS", mime: "audio/ogg", ext: "ogg" },
  mulaw: { encoding: "MULAW", mime: "audio/basic", ext: "mulaw" },
  alaw: { encoding: "ALAW", mime: "audio/basic", ext: "alaw" },
};

const VOICES = [
  { id: "en-US-Neural2-D", name: "Daniel (Male)", lang: "en-US" },
  { id: "en-US-Neural2-C", name: "Catherine (Female)", lang: "en-US" },
  { id: "en-US-Neural2-A", name: "Aria (Female)", lang: "en-US" },
  { id: "en-US-Neural2-J", name: "James (Male)", lang: "en-US" },
  { id: "en-US-Studio-O", name: "Oliver (Male, Studio)", lang: "en-US" },
  { id: "en-US-Studio-Q", name: "Quinn (Female, Studio)", lang: "en-US" },
  { id: "en-GB-Neural2-B", name: "Brian (Male, British)", lang: "en-GB" },
  { id: "en-GB-Neural2-A", name: "Alice (Female, British)", lang: "en-GB" },
  { id: "en-AU-Neural2-B", name: "Ben (Male, Australian)", lang: "en-AU" },
  { id: "en-AU-Neural2-A", name: "Amy (Female, Australian)", lang: "en-AU" },
  { id: "en-IN-Neural2-A", name: "Aditi (Female, Indian)", lang: "en-IN" },
  { id: "en-IN-Neural2-B", name: "Arjun (Male, Indian)", lang: "en-IN" },
  { id: "hi-IN-Neural2-A", name: "Ananya (Female, Hindi)", lang: "hi-IN" },
  { id: "hi-IN-Neural2-B", name: "Raj (Male, Hindi)", lang: "hi-IN" },
  { id: "es-ES-Neural2-A", name: "Sofia (Female, Spanish)", lang: "es-ES" },
  { id: "fr-FR-Neural2-A", name: "Marie (Female, French)", lang: "fr-FR" },
  { id: "de-DE-Neural2-B", name: "Hans (Male, German)", lang: "de-DE" },
  { id: "ja-JP-Neural2-B", name: "Kenji (Male, Japanese)", lang: "ja-JP" },
  { id: "ko-KR-Neural2-A", name: "Minji (Female, Korean)", lang: "ko-KR" },
  { id: "zh-CN-Neural2-A", name: "Li (Female, Chinese)", lang: "zh-CN" },
  { id: "ar-XA-Neural2-A", name: "Layla (Female, Arabic)", lang: "ar-XA" },
  { id: "pt-BR-Neural2-A", name: "Ana (Female, Portuguese)", lang: "pt-BR" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const userId = userIdFromAuth(req);


  try {
    const body = await req.json();

    // If requesting voice list
    if (body.action === "list-voices") {
      return new Response(
        JSON.stringify({ voices: VOICES, formats: Object.keys(FORMAT_MAP) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      text,
      voice = "en-US-Neural2-D",
      languageCode,
      speakingRate = 1.0,
      pitch = 0,
      format = "mp3",
    } = body;

    const { key: API_KEY, source } = await getProviderKey(userId, "google_tts");
    if (!API_KEY) throw new Error("GOOGLE_TTS_API_KEY is not configured");

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect language code from voice ID if not provided
    const voiceInfo = VOICES.find((v) => v.id === voice);
    const lang = languageCode || voiceInfo?.lang || voice.split("-").slice(0, 2).join("-") || "en-US";

    const fmt = FORMAT_MAP[format.toLowerCase()] || FORMAT_MAP.mp3;

    // Google TTS has 5000 char limit per request — split if needed
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 4800) {
        chunks.push(remaining);
        break;
      }
      // Split at sentence boundary
      let splitIdx = remaining.lastIndexOf(".", 4800);
      if (splitIdx < 2000) splitIdx = remaining.lastIndexOf(" ", 4800);
      if (splitIdx < 1000) splitIdx = 4800;
      chunks.push(remaining.slice(0, splitIdx + 1));
      remaining = remaining.slice(splitIdx + 1).trim();
    }

    const audioChunks: string[] = [];

    for (const chunk of chunks) {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: chunk },
            voice: { languageCode: lang, name: voice },
            audioConfig: {
              audioEncoding: fmt.encoding,
              speakingRate,
              pitch,
              sampleRateHertz: fmt.encoding === "LINEAR16" ? 44100 : 24000,
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("Google TTS error:", res.status, errText);
        return new Response(
          JSON.stringify({ error: `Google TTS error [${res.status}]`, details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      audioChunks.push(data.audioContent);
    }

    // For single chunk, return directly. For multiple, concatenate base64
    const audioContent = audioChunks.length === 1
      ? audioChunks[0]
      : concatenateBase64Audio(audioChunks);

    logUsage({ userId, functionName: "google-tts", provider: "google_tts", capability: "audio", source, metadata: { chars: text.length, voice } });
    return new Response(
      JSON.stringify({
        audioContent,
        format: fmt.ext,
        mimeType: fmt.mime,
        voice: voiceInfo?.name || voice,
        charCount: text.length,
        chunks: chunks.length,
        source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("google-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function concatenateBase64Audio(chunks: string[]): string {
  // Decode all chunks, concatenate raw bytes, re-encode
  const decoded = chunks.map((c) => Uint8Array.from(atob(c), (ch) => ch.charCodeAt(0)));
  const totalLen = decoded.reduce((s, a) => s + a.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of decoded) {
    merged.set(arr, offset);
    offset += arr.length;
  }
  // Use btoa with chunked approach to avoid stack overflow
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < merged.length; i += chunkSize) {
    const slice = merged.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
