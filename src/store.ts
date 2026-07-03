import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  NowPlaying,
  LyricsResult,
  LyricLine,
  ThemeName,
} from "./types";

interface LyraState {
  // Playback (from Windows Media Session)
  currentTrack: NowPlaying | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;

  // Lyrics
  lyrics: LyricsResult | null;
  lyricLines: LyricLine[];
  activeLineIndex: number;
  lyricsLoading: boolean;
  lyricsError: string | null;

  // Theme
  theme: ThemeName;

  // Settings
  opacity: number;
  fontSize: number;

  // Actions
  pollNowPlaying: () => void;
  stopPolling: () => void;
  fetchLyricsForTrack: (track: NowPlaying) => Promise<void>;
  setTheme: (theme: ThemeName) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
}

/** Find the active lyric line index using binary search */
function findActiveLineIndex(lines: LyricLine[], progressMs: number): number {
  if (lines.length === 0) return 0;

  let low = 0;
  let high = lines.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].time_ms <= progressMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low === 0 ? 0 : low - 1;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false; // guard against overlapping polls
let lastPollTime = 0; // timestamp when we last received progress from OS
let lastPollProgress = 0; // progress_ms at that time

export const useLyraStore = create<LyraState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  lyrics: null,
  lyricLines: [],
  activeLineIndex: 0,
  lyricsLoading: false,
  lyricsError: null,
  theme: "classic",
  opacity: 85,
  fontSize: 28,

  pollNowPlaying: () => {
    // Clear existing intervals
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (tickInterval) {
      clearInterval(tickInterval);
    }

    const poll = async () => {
      // Skip if previous poll is still running (prevent stacking)
      if (isPolling) {
        return;
      }
      isPolling = true;

      try {
        const track = await invoke<NowPlaying>("get_now_playing");
        const state = get();
        const prevTrack = state.currentTrack;

        // Check if track changed
        const trackChanged =
          !prevTrack ||
          prevTrack.track_name !== track.track_name ||
          prevTrack.artist_name !== track.artist_name;

        // Store the OS-reported progress and time for local interpolation
        lastPollTime = Date.now();
        lastPollProgress = track.progress_ms;

        // Compute active line
        const lines = state.lyricLines;
        const newActiveIndex = findActiveLineIndex(lines, track.progress_ms);

        set({
          currentTrack: track,
          isPlaying: track.is_playing,
          progressMs: track.progress_ms,
          durationMs: track.duration_ms,
          activeLineIndex: newActiveIndex,
        });

        // If track changed, fetch new lyrics
        if (trackChanged) {
          get().fetchLyricsForTrack(track);
        }
      } catch (error) {
        const state = get();
        if (state.currentTrack !== null) {
          set({ currentTrack: null, isPlaying: false, progressMs: 0, durationMs: 0 });
        }
      } finally {
        isPolling = false;
      }
    };

    // Local tick: interpolate progress between OS polls for smooth lyric sync
    const tick = () => {
      const state = get();
      if (!state.isPlaying || state.lyricLines.length === 0) return;

      // Calculate interpolated progress based on elapsed time since last poll
      const elapsed = Date.now() - lastPollTime;
      const interpolatedProgress = Math.min(
        lastPollProgress + elapsed,
        state.durationMs
      );

      // Find active line based on interpolated progress
      const newActiveIndex = findActiveLineIndex(state.lyricLines, interpolatedProgress);

      // Only update if line changed or progress difference is significant
      if (state.activeLineIndex !== newActiveIndex || Math.abs(state.progressMs - interpolatedProgress) > 500) {
        set({
          progressMs: interpolatedProgress,
          activeLineIndex: newActiveIndex,
        });
      }
    };

    // Poll OS every 5 seconds (media session API is expensive)
    poll();
    pollInterval = setInterval(poll, 5000);

    // Tick locally every 250ms for smooth lyric progression
    tickInterval = setInterval(tick, 250);
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  },

  fetchLyricsForTrack: async (track: NowPlaying) => {
    try {
      set({ lyricsLoading: true, lyricLines: [], activeLineIndex: 0, lyricsError: null });

      console.log(`[Lyra] Fetching lyrics for: "${track.track_name}" by "${track.artist_name}"`);

      const result = await invoke<LyricsResult>("fetch_lyrics", {
        trackName: track.track_name,
        artistName: track.artist_name,
        albumName: track.album_name,
      });

      console.log(`[Lyra] ✅ Got ${result.lines.length} lyric lines from ${result.source}`);

      // Compute initial active line based on current progress
      const activeLineIndex = findActiveLineIndex(result.lines, get().progressMs);

      set({
        lyrics: result,
        lyricLines: result.lines,
        lyricsLoading: false,
        activeLineIndex,
      });
    } catch (error) {
      console.error("[Lyra] ❌ Failed to fetch lyrics:", error);
      set({ lyricsLoading: false, lyrics: null, lyricLines: [], lyricsError: String(error) });
    }
  },

  setTheme: (theme: ThemeName) => set({ theme }),
  setOpacity: (opacity: number) => set({ opacity }),
  setFontSize: (size: number) => set({ fontSize: size }),
}));
