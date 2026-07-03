import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  CurrentlyPlaying,
  LyricsResult,
  LyricLine,
  ThemeName,
} from "./types";

interface LyraState {
  // Auth
  isAuthenticated: boolean;
  authLoading: boolean;

  // Playback
  currentTrack: CurrentlyPlaying | null;
  isPlaying: boolean;

  // Lyrics
  lyrics: LyricsResult | null;
  lyricLines: LyricLine[];
  activeLineIndex: number;
  lyricsLoading: boolean;

  // Theme
  theme: ThemeName;

  // Settings
  opacity: number;
  fontSize: number;

  // Actions
  login: () => Promise<void>;
  handleAuthCode: (code: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  pollCurrentlyPlaying: () => Promise<void>;
  fetchLyricsForTrack: (track: CurrentlyPlaying) => Promise<void>;
  updateActiveLine: (progressMs: number) => void;
  setTheme: (theme: ThemeName) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useLyraStore = create<LyraState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  authLoading: false,
  currentTrack: null,
  isPlaying: false,
  lyrics: null,
  lyricLines: [],
  activeLineIndex: 0,
  lyricsLoading: false,
  theme: "spotify",
  opacity: 85,
  fontSize: 28,

  login: async () => {
    try {
      set({ authLoading: true });
      // Rust backend will open the URL in the default browser natively
      await invoke<{ url: string }>("get_spotify_auth_url");
      set({ authLoading: false });
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      set({ authLoading: false });
    }
  },

  handleAuthCode: async (code: string) => {
    try {
      set({ authLoading: true });
      await invoke("exchange_spotify_code", { code });
      set({ isAuthenticated: true, authLoading: false });
      // Start polling after successful auth
      get().pollCurrentlyPlaying();
    } catch (error) {
      console.error("Failed to exchange code:", error);
      set({ authLoading: false });
    }
  },

  checkAuth: async () => {
    try {
      const isAuth = await invoke<boolean>("is_spotify_authenticated");
      set({ isAuthenticated: isAuth });
      if (isAuth) {
        get().pollCurrentlyPlaying();
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
    }
  },

  pollCurrentlyPlaying: async () => {
    // Clear existing interval
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    const poll = async () => {
      try {
        const track = await invoke<CurrentlyPlaying>("get_currently_playing");
        const prevTrack = get().currentTrack;

        set({
          currentTrack: track,
          isPlaying: track.is_playing,
        });

        // If track changed, fetch new lyrics
        if (!prevTrack || prevTrack.track_id !== track.track_id) {
          get().fetchLyricsForTrack(track);
        } else {
          // Same track, update active line based on progress
          get().updateActiveLine(track.progress_ms);
        }
      } catch (error) {
        // "Nothing is currently playing" or auth error
        console.log("Poll result:", error);
        set({ currentTrack: null, isPlaying: false });
      }
    };

    // Poll immediately
    await poll();

    // Then every 1 second for smooth lyric sync
    pollInterval = setInterval(poll, 1000);
  },

  fetchLyricsForTrack: async (track: CurrentlyPlaying) => {
    try {
      set({ lyricsLoading: true, lyricLines: [], activeLineIndex: 0 });

      const result = await invoke<LyricsResult>("fetch_lyrics", {
        trackName: track.track_name,
        artistName: track.artist_name,
        albumName: track.album_name,
      });

      set({
        lyrics: result,
        lyricLines: result.lines,
        lyricsLoading: false,
      });

      // Set initial active line based on current progress
      get().updateActiveLine(track.progress_ms);
    } catch (error) {
      console.error("Failed to fetch lyrics:", error);
      set({ lyricsLoading: false, lyrics: null, lyricLines: [] });
    }
  },

  updateActiveLine: (progressMs: number) => {
    const { lyricLines } = get();
    if (lyricLines.length === 0) return;

    // Binary search for active line
    let low = 0;
    let high = lyricLines.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (lyricLines[mid].time_ms <= progressMs) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const activeIndex = low === 0 ? 0 : low - 1;

    if (activeIndex !== get().activeLineIndex) {
      set({ activeLineIndex: activeIndex });
    }
  },

  setTheme: (theme: ThemeName) => set({ theme }),
  setOpacity: (opacity: number) => set({ opacity }),
  setFontSize: (size: number) => set({ fontSize: size }),
}));