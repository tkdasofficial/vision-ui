/**
 * Detects aspect ratio from user prompt text.
 * Returns the detected ratio or defaults to "1:1".
 */
export function detectAspectRatio(prompt: string): string {
  const supported = ["16:9", "9:16", "4:3", "3:4", "1:1", "3:2", "2:3", "2:1", "1:2", "4:5"];

  // Direct ratio match like "16:9", "4:3", etc.
  const ratioMatch = prompt.match(/\b(\d{1,2}:\d{1,2})\b/);
  if (ratioMatch && supported.includes(ratioMatch[1])) {
    return ratioMatch[1];
  }

  // Keyword-based detection
  const lower = prompt.toLowerCase();

  if (/\b(widescreen|wide\s*screen|cinematic|landscape|banner|thumbnail|youtube|desktop\s*wallpaper)\b/.test(lower)) {
    return "16:9";
  }
  if (/\b(portrait|vertical|story|stories|reel|reels|tiktok|mobile\s*wallpaper|phone\s*wallpaper)\b/.test(lower)) {
    return "9:16";
  }
  if (/\b(4\s*by\s*3|standard|classic)\b/.test(lower)) {
    return "4:3";
  }
  if (/\b(3\s*by\s*4)\b/.test(lower)) {
    return "3:4";
  }
  if (/\b(square)\b/.test(lower)) {
    return "1:1";
  }

  return "1:1";
}
