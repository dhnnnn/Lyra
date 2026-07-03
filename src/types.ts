export interface CurrentlyPlaying {
  is_playing: boolean;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string | null;
  progress_ms: number;
  duration_ms: number;
  track_id: string;
}

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

export type ThemeName = "spotify" | "neon" | "minimal" | "story";

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
  spotify: {
    name: "spotify",
    label: "Spotify",
    background: "rgba(0, 0, 0, 0.6)",
    textColor: "#ffffff",
    highlightColor: "#1db954",
    dimColor: "rgba(255, 255, 255, 0.4)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 28,
    fontWeight: "600",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    backdropBlur: "blur(20px)",
  },
  neon: {
    name: "neon",
    label: "Neon",
    background: "rgba(10, 10, 30, 0.7)",
    textColor: "#e0e0ff",
    highlightColor: "#ff00ff",
    dimColor: "rgba(224, 224, 255, 0.3)",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 26,
    fontWeight: "500",
    textShadow: "0 0 10px #ff00ff, 0 0 20px #ff00ff, 0 0 40px #ff00ff",
    backdropBlur: "blur(16px)",
  },
  minimal: {
    name: "minimal",
    label: "Minimal",
    background: "rgba(255, 255, 255, 0.1)",
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
    label: "IG Story",
    background: "linear-gradient(135deg, rgba(131,58,180,0.6), rgba(253,29,29,0.6), rgba(252,176,69,0.6))",
    textColor: "#ffffff",
    highlightColor: "#ffffff",
    dimColor: "rgba(255, 255, 255, 0.4)",
    fontFamily: "'Georgia', serif",
    fontSize: 30,
    fontWeight: "700",
    textShadow: "0 2px 12px rgba(0,0,0,0.4)",
    backdropBlur: "blur(20px)",
  },
};