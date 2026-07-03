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
let isPolling = false;

// Interpolation state — tracks playback position locally
let anchorTime = 0;      // Date.now() when we anchored the position
let anchorProgress = 0;  // progress_ms at anchor time
let lastOsProgress = -1; // last progress_ms reported by OS (to detect changes)

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
    if (pollInterval) clearInterval(pollInterval);
    if (tickInterval) clearInterval(tickInterval);

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const track = await invoke<NowPlaying>("get_now_playing");
        const state = get();
        const prevTrack = state.currentTrack;

        const trackChanged =
          !prevTrack ||
          prevTrack.track_name !== track.track_name ||
          prevTrack.artist_name !== track.artist_name;

        // Detect if OS actually gave us a new progress value
        const osProgressChanged = track.progress_ms !== lastOsProgress;
        lastOsProgress = track.progress_ms;

        if (osProgressChanged || trackChanged) {
          // OS gave us a real position update — re-anchor our interpolation
          anchorTime = Date.now();
          anchorProgress = track.progress_ms;
        }
        // If OS progress didn't change but song is playing,
        // we DON'T reset the anchor — let local interpolation continue

        // Handle play/pause transitions
        if (!track.is_playing && state.isPlaying) {
          // Just paused — freeze current interpolated position as anchor
          const elapsed = Date.now() - anchorTime;
          anchorProgress = anchorProgress + elapsed;
          anchorTime = Date.now();
        } else if (track.is_playing && !state.isPlaying) {
          // Just resumed — re-anchor from OS position
          anchorTime = Date.now();
          anchorProgress = track.progress_ms;
        }

        // Calculate current interpolated progress
        const now = Date.now();
        const currentProgress = track.is_playing
          ? Math.min(anchorProgress + (now - anchorTime), track.duration_ms)
          : anchorProgress;

        const lines = state.lyricLines;
        const newActiveIndex = findActiveLineIndex(lines, currentProgress);

        set({
          currentTrack: track,
          isPlaying: track.is_playing,
          progressMs: currentProgress,
          durationMs: track.duration_ms,
          activeLineIndex: newActiveIndex,
        });

        if (trackChanged) {
          // Reset anchor for new track
          anchorTime = Date.now();
          anchorProgress = track.progress_ms;
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

    // Local tick: advance progress smoothly between polls
    const tick = () => {
      const state = get();
      if (!state.isPlaying || state.lyricLines.length === 0) return;

      const now = Date.now();
      const interpolatedProgress = Math.min(
        anchorProgress + (now - anchorTime),
        state.durationMs
      );

      const newActiveIndex = findActiveLineIndex(state.lyricLines, interpolatedProgress);

      // Update if line index changed or progress moved enough for progress bar
      if (state.activeLineIndex !== newActiveIndex || Math.abs(state.progressMs - interpolatedProgress) > 300) {
        set({
          progressMs: interpolatedProgress,
          activeLineIndex: newActiveIndex,
        });
      }
    };

    // Initial poll
    poll();

    // Poll OS every 5s (just to detect track changes & pause/play)
    pollInterval = setInterval(poll, 5000);

    // Tick every 200ms for smooth lyric sync
    tickInterval = setInterval(tick, 200);
  },

  stopPolling: () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
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

      // Compute initial active line based on current interpolated progress
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
