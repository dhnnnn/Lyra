import { useEffect, useRef, useCallback } from "react";
import { useLyraStore } from "./store";
import { THEMES } from "./types";
import LyricLine from "./components/LyricLine";

export default function LyricsOverlay() {
  const {
    lyricLines,
    lyricsLoading,
    lyricsError,
    currentTrack,
    isPlaying,
    activeLineIndex,
    progressMs,
    durationMs,
    theme,
    opacity,
    fontSize,
  } = useLyraStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const themeConfig = THEMES[theme];

  const setLineRef = useCallback((el: HTMLDivElement | null, index: number) => {
    lineRefs.current[index] = el;
  }, []);

  // Auto-scroll to active line
  useEffect(() => {
    const container = containerRef.current;
    const activeLine = lineRefs.current[activeLineIndex];
    if (!container || !activeLine || lyricLines.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const lineOffsetTop = activeLine.offsetTop;
    const targetScroll = lineOffsetTop - containerRect.height / 2 + lineRect.height / 2;

    container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  }, [activeLineIndex, lyricLines.length]);

  // Reset scroll on track change
  useEffect(() => {
    lineRefs.current = [];
    containerRef.current?.scrollTo({ top: 0 });
  }, [currentTrack?.track_name, currentTrack?.artist_name]);

  const progressPercent = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;

  // ─── Empty state ─────────────────────────────────────────────────
  if (!currentTrack) {
    return (
      <div
        className="lyra-overlay"
        style={{
          background: themeConfig.background,
          backdropFilter: themeConfig.backdropBlur,
          opacity: opacity / 100,
        }}
      >
        <div className="lyra-drag-region" data-tauri-drag-region />
        <div className="lyra-empty">
          <div className="lyra-empty-icon">♪</div>
          <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
            Play a song on any media player to see lyrics
          </p>
        </div>
      </div>
    );
  }

  // ─── Main overlay ────────────────────────────────────────────────
  return (
    <div
      className="lyra-overlay"
      style={{
        background: themeConfig.background,
        backdropFilter: themeConfig.backdropBlur,
        opacity: opacity / 100,
      }}
    >
      {/* Header */}
      <div className="lyra-header" data-tauri-drag-region>
        <div className="lyra-track-info">
          <div className="lyra-track-name" style={{ color: themeConfig.textColor, fontFamily: themeConfig.fontFamily }}>
            {currentTrack.track_name}
          </div>
          <div className="lyra-artist-name" style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
            {currentTrack.artist_name}
            {currentTrack.album_name && ` • ${currentTrack.album_name}`}
          </div>
        </div>
        <div className="lyra-play-status">
          {isPlaying ? (
            <span className="lyra-playing-indicator" style={{ color: themeConfig.highlightColor }}>● LIVE</span>
          ) : (
            <span style={{ color: themeConfig.dimColor }}>⏸ PAUSED</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="lyra-progress-container">
        <div className="lyra-progress-bar" style={{ width: `${progressPercent}%`, background: themeConfig.highlightColor }} />
      </div>

      {/* Lyrics */}
      <div className="lyra-lyrics-container" ref={containerRef}>
        {lyricsLoading ? (
          <div className="lyra-loading">
            <div className="lyra-spinner" style={{ borderColor: themeConfig.highlightColor }} />
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>Fetching lyrics...</p>
          </div>
        ) : lyricsError ? (
          <div className="lyra-no-lyrics">
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>Could not find lyrics for this track</p>
          </div>
        ) : lyricLines.length === 0 ? (
          <div className="lyra-no-lyrics">
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>No lyrics available for this track</p>
          </div>
        ) : (
          <div className="lyra-lines">
            <div className="lyra-spacer" />
            {lyricLines.map((line, index) => (
              <LyricLine
                key={index}
                text={line.text}
                isActive={index === activeLineIndex}
                distance={Math.abs(index - activeLineIndex)}
                theme={themeConfig}
                fontSize={fontSize}
                lineRef={(el) => setLineRef(el, index)}
              />
            ))}
            <div className="lyra-spacer" />
          </div>
        )}
      </div>

      {/* Source */}
      <div className="lyra-source-indicator" style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
        via {currentTrack.source}
      </div>
    </div>
  );
}
