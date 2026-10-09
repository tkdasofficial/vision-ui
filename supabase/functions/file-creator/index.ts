import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_MIMES: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  css: "text/css",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  js: "text/javascript",
  ts: "text/typescript",
  py: "text/x-python",
  sql: "application/sql",
  yaml: "text/yaml",
  toml: "text/toml",
  sh: "text/x-shellscript",
  pdf: "application/pdf",
  env: "text/plain",
  log: "text/plain",
  ini: "text/plain",
  cfg: "text/plain",
  bat: "text/plain",
  rtf: "text/rtf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

const SYSTEM_PROMPT = `You are a professional file creator AI. You generate well-structured, error-free file content based on user requests.

RESPOND WITH VALID JSON ONLY:
{
  "fileName": "example.txt",
  "content": "The full file content here...",
  "format": "txt",
  "explanation": "Brief description of what was created"
}

## For XLSX/XLS (Excel/Spreadsheet) files:
Return content as a JSON string with this structure:
{
  "fileName": "report.xlsx",
  "content": "{\"sheets\":[{\"name\":\"Sheet1\",\"columns\":[{\"header\":\"Name\",\"key\":\"name\",\"width\":20},{\"header\":\"Email\",\"key\":\"email\",\"width\":30}],\"rows\":[{\"name\":\"John\",\"email\":\"john@example.com\"}],\"styles\":{\"headerBold\":true,\"headerBg\":\"4472C4\",\"headerColor\":\"FFFFFF\",\"alternateRows\":true,\"altRowBg\":\"D9E2F3\",\"borders\":true}}]}",
  "format": "xlsx",
  "explanation": "Created a professional Excel spreadsheet"
}

### Excel-specific rules:
1. The "content" field MUST be a JSON string (stringified) containing a "sheets" array
2. Each sheet has: name, columns (header, key, width), rows (objects matching column keys), and optional styles
3. Support MULTIPLE sheets for complex data (e.g., Summary + Details + Charts Data)
4. Use professional formatting: bold headers, colored header rows, appropriate column widths
5. Include formulas as strings prefixed with "=" (e.g., "=SUM(B2:B10)")
6. For financial data: use number formatting hints in columns (e.g., "format": "currency" or "format": "percentage")
7. Column types: "string", "number", "date", "currency", "percentage", "formula"
8. Styles object per sheet: headerBold, headerBg (hex no #), headerColor, alternateRows, altRowBg, borders, freezeHeader
9. Generate REALISTIC, comprehensive data — at least 10-20 rows for data sheets
10. For budgets/financials: include subtotals and grand totals using formulas

## Rules:
1. Generate COMPLETE, production-quality content — no placeholders, no "add more here" comments
2. Content must be properly formatted for the requested file type
3. For scripts/screenplays: use proper formatting (scene headings, action, dialogue)
4. For code files: include proper syntax, imports, comments, error handling
5. For data files (CSV, JSON, XML): include realistic, well-structured data
6. For documents (TXT, MD): use proper headings, paragraphs, formatting
7. For HTML: include complete valid markup with head, meta, styles
8. File names should be descriptive and use correct extensions
9. Content should be detailed, thorough, and professionally written
10. NEVER include markdown code fences in the content — output raw file content only

## Format-specific guidelines:
- **TXT**: Clean plain text with proper line breaks and paragraphs
- **MD**: Proper Markdown with headings (#), lists (-), bold (**), code blocks
- **HTML**: Complete HTML5 document with <!DOCTYPE>, head, meta viewport, styles
- **CSS**: Well-organized with comments, variables, responsive design
- **CSV**: Header row + data rows, properly quoted fields with commas
- **JSON**: Valid JSON with proper nesting, arrays, types
- **XML**: Valid XML with declaration, proper nesting, attributes
- **JS/TS**: Modern ES6+ syntax, JSDoc comments, proper exports
- **PY**: Python 3 with docstrings, type hints, if __name__ == '__main__'
- **SQL**: Standard SQL with CREATE, INSERT, proper data types
- **PDF**: Return the text content (client will convert to PDF)
- **SH/BAT**: Include shebang, comments, error handling
- **XLSX/XLS**: Return JSON structure with sheets, columns, rows, styles (see Excel rules above)

RESPOND WITH ONLY THE JSON OBJECT.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, format } = await req.json();

    // Gather all Gemini keys for fallback
    const geminiKeys: string[] = [];
    for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
      const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
      if (k) geminiKeys.push(k);
    }
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (geminiKeys.length === 0 && !GROQ_API_KEY) throw new Error("No AI API keys configured");

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMsg = format
      ? `${prompt}\n\n[Output format: ${format.toUpperCase()} file]`
      : prompt;

    // Try each Gemini key
    let response: Response | null = null;
    let lastError = "";

    for (const key of geminiKeys) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: "user", parts: [{ text: userMsg }] }],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 32768,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (r.ok) { response = r; break; }
        lastError = await r.text();
        console.warn(`Gemini key failed (${r.status}):`, lastError.slice(0, 200));
        if (r.status !== 429 && r.status !== 503 && r.status !== 500) break;
      } catch (e) {
        lastError = String(e);
      }
    }

    // Groq fallback
    if (!response?.ok && GROQ_API_KEY) {
      console.log("Falling back to Groq for file-creator");
      try {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            temperature: 0.5,
            max_tokens: 32768,
            response_format: { type: "json_object" },
          }),
        });
        if (groqResp.ok) {
          const groqData = await groqResp.json();
          const groqText = groqData.choices?.[0]?.message?.content;
          if (groqText) {
            // Wrap into Gemini-like structure for unified parsing below
            response = new Response(JSON.stringify({
              candidates: [{ content: { parts: [{ text: groqText }] } }]
            }), { status: 200 });
          }
        } else {
          lastError = await groqResp.text();
          console.error("Groq fallback failed:", lastError.slice(0, 200));
        }
      } catch (e) {
        console.error("Groq error:", e);
      }
    }

    if (!response?.ok) {
      return new Response(
        JSON.stringify({ error: "All AI providers failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      let jsonStr = text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fmt = (parsed.format || format || "txt").toLowerCase();
    const mimeType = FORMAT_MIMES[fmt] || "text/plain";

    return new Response(
      JSON.stringify({
        fileName: parsed.fileName || `file.${fmt}`,
        content: parsed.content || "",
        format: fmt,
        mimeType,
        explanation: parsed.explanation || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("file-creator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
