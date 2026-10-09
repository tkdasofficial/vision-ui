import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Download, Play, Pause, Loader2, Volume2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type Voice = { id: string; name: string; lang: string };

type Props = {
  script: string;
};

const FORMATS = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
  { value: "ogg", label: "OGG" },
];

const DEFAULT_VOICES: Voice[] = [
  { id: "en-US-Neural2-D", name: "Daniel (Male)", lang: "en-US" },
  { id: "en-US-Neural2-C", name: "Catherine (Female)", lang: "en-US" },
  { id: "en-US-Neural2-A", name: "Aria (Female)", lang: "en-US" },
  { id: "en-US-Neural2-J", name: "James (Male)", lang: "en-US" },
  { id: "en-US-Studio-O", name: "Oliver (Male, Studio)", lang: "en-US" },
  { id: "en-GB-Neural2-B", name: "Brian (Male, British)", lang: "en-GB" },
  { id: "en-GB-Neural2-A", name: "Alice (Female, British)", lang: "en-GB" },
  { id: "en-AU-Neural2-B", name: "Ben (Male, Australian)", lang: "en-AU" },
  { id: "en-IN-Neural2-A", name: "Aditi (Female, Indian)", lang: "en-IN" },
  { id: "hi-IN-Neural2-A", name: "Ananya (Female, Hindi)", lang: "hi-IN" },
  { id: "hi-IN-Neural2-B", name: "Raj (Male, Hindi)", lang: "hi-IN" },
  { id: "es-ES-Neural2-A", name: "Sofia (Female, Spanish)", lang: "es-ES" },
  { id: "fr-FR-Neural2-A", name: "Marie (Female, French)", lang: "fr-FR" },
  { id: "de-DE-Neural2-B", name: "Hans (Male, German)", lang: "de-DE" },
  { id: "ja-JP-Neural2-B", name: "Kenji (Male, Japanese)", lang: "ja-JP" },
  { id: "zh-CN-Neural2-A", name: "Li (Female, Chinese)", lang: "zh-CN" },
  { id: "ar-XA-Neural2-A", name: "Layla (Female, Arabic)", lang: "ar-XA" },
  { id: "pt-BR-Neural2-A", name: "Ana (Female, Portuguese)", lang: "pt-BR" },
];

const TTSCard = ({ script }: Props) => {
  const [voices] = useState<Voice[]>(DEFAULT_VOICES);
  const [selectedVoice, setSelectedVoice] = useState("en-US-Neural2-D");
  const [selectedFormat, setSelectedFormat] = useState("mp3");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/mpeg");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Truncate display script
  const displayScript = script.length > 200 ? script.slice(0, 200) + "..." : script;
  const charCount = script.length;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setAudioUrl(null);
    setProgress(10);

    try {
      setProgress(30);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: script,
            voice: selectedVoice,
            format: selectedFormat,
            speakingRate: speed,
            pitch,
          }),
        }
      );

      setProgress(70);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "TTS generation failed");

      const mime = data.mimeType || "audio/mpeg";
      const url = `data:${mime};base64,${data.audioContent}`;
      setAudioUrl(url);
      setAudioMime(mime);
      setVoiceName(data.voice || selectedVoice);
      setProgress(100);
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [script, selectedVoice, selectedFormat, speed, pitch]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `voiceover.${selectedFormat}`;
    a.click();
  }, [audioUrl, selectedFormat]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setPlaying(false);
    }
  }, [audioUrl]);

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Mic className="w-4 h-4 text-primary" />
          AI Voice Over Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Script preview */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Script ({charCount} chars)</p>
          <p className="text-sm text-foreground leading-relaxed">{displayScript}</p>
        </div>

        {/* Voice selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Voice</label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={generating}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voices.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Format</label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat} disabled={generating}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Speed & Pitch */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Speed: {speed.toFixed(1)}x</label>
            <Slider
              value={[speed]}
              onValueChange={([v]) => setSpeed(v)}
              min={0.5}
              max={2.0}
              step={0.1}
              disabled={generating}
              className="py-1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Pitch: {pitch > 0 ? "+" : ""}{pitch}</label>
            <Slider
              value={[pitch]}
              onValueChange={([v]) => setPitch(v)}
              min={-10}
              max={10}
              step={1}
              disabled={generating}
              className="py-1"
            />
          </div>
        </div>

        {/* Progress */}
        {generating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Generating voiceover...</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Audio player */}
        {audioUrl && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">voiceover.{selectedFormat}</p>
                <p className="text-xs text-muted-foreground">{voiceName} • {selectedFormat.toUpperCase()}</p>
              </div>
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <audio ref={audioRef} src={audioUrl} />

            <div className="flex gap-2">
              <Button size="sm" onClick={handleDownload} className="flex-1 gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />
                Download {selectedFormat.toUpperCase()}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAudioUrl(null); setError(null); }}
                className="gap-1.5 text-xs"
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}

        {/* Generate button */}
        {!audioUrl && !generating && (
          <Button size="sm" onClick={handleGenerate} className="w-full gap-2 text-xs">
            <Mic className="w-3.5 h-3.5" />
            Generate Voiceover
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TTSCard;
