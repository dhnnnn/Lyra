// ─── Media Session Types ───────────────────────────────────────────

export interface NowPlaying {
  is_playing: boolean;
  track_name: string;
  artist_name: string;
  album_name: string;
  source: string;
  progress_ms: number;
  duration_ms: number;
}

// ─── Lyrics Types ──────────────────────────────────────────────────

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface LyricsResult {
  track_name: string;
  artist_name: string;
  album_name: string | null;
  lines: LyricLine[];
  source: string;
}

// ─── Theme Types ───────────────────────────────────────────────────

export type ThemeName = "classic" | "neon" | "minimal" | "story";

export interface Theme {
  name: ThemeName;
  label: string;
  background: string;
  textColor: string;
  highlightColor: string;
  dimColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textShadow: string;
  backdropBlur: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  classic: {
    name: "classic",
    label: "Purple",
    background: "rgba(11, 13, 26, 0.85)",
    textColor: "#ffffff",
    highlightColor: "#C77DFF",
    dimColor: "rgba(255, 255, 255, 0.35)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 28,
    fontWeight: "500",
    textShadow: "0 0 12px rgba(199, 125, 255, 0.4)",
    backdropBlur: "blur(20px)",
  },
  neon: {
    name: "neon",
    label: "Cyan",
    background: "rgba(11, 13, 26, 0.9)",
    textColor: "#e0e0ff",
    highlightColor: "#59E1FF",
    dimColor: "rgba(224, 224, 255, 0.3)",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 26,
    fontWeight: "500",
    textShadow: "0 0 10px #59E1FF, 0 0 20px rgba(89, 225, 255, 0.3)",
    backdropBlur: "blur(16px)",
  },
  minimal: {
    name: "minimal",
    label: "White",
    background: "rgba(27, 31, 59, 0.6)",
    textColor: "#ffffff",
    highlightColor: "#ffffff",
    dimColor: "rgba(255, 255, 255, 0.3)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 24,
    fontWeight: "400",
    textShadow: "none",
    backdropBlur: "blur(12px)",
  },
  story: {
    name: "story",
    label: "Gradient",
    background: "linear-gradient(135deg, rgba(108,92,231,0.7), rgba(199,125,255,0.5), rgba(89,225,255,0.4))",
    textColor: "#ffffff",
    highlightColor: "#ffffff",
    dimColor: "rgba(255, 255, 255, 0.4)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: "700",
    textShadow: "0 2px 12px rgba(0,0,0,0.4)",
    backdropBlur: "blur(20px)",
  },
};
