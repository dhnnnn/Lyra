import { useEffect, useRef, useCallback, memo } from "react";
import { useLyraStore } from "./store";
import { THEMES, type Theme } from "./types";

/** Memoized lyric line — only re-renders when isActive or theme changes */
const LyricLine = memo(function LyricLine({
  text,
  isActive,
  distance,
  theme,
  fontSize,
  lineRef,
}: {
  text: string;
  isActive: boolean;
  distance: number;
  theme: Theme;
  fontSize: number;
  lineRef: (el: HTMLDivElement | null) => void;
}) {
  const lineOpacity = isActive ? 1 : Math.max(0.25, 1 - distance * 0.15);

  return (
    <div
      ref={lineRef}
      className={`lyra-line ${isActive ? "active" : ""}`}
      style={{
        color: isActive ? theme.highlightColor : theme.textColor,
        fontFamily: theme.fontFamily,
        fontSize: isActive ? fontSize : fontSize * 0.85,
        fontWeight: isActive ? "700" : theme.fontWeight,
        opacity: lineOpacity,
        textShadow: isActive ? theme.textShadow : "none",
        transform: isActive ? "scale(1.05)" : "scale(1)",
        transition: "all 0.35s ease-out",
      }}
    >
      {text || "♪"}
    </div>
  );
});

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

  // Set line ref callback
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

    // Scroll so active line is roughly centered in the container
    const lineOffsetTop = activeLine.offsetTop;
    const targetScroll = lineOffsetTop - containerRect.height / 2 + lineRect.height / 2;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  }, [activeLineIndex, lyricLines.length]);

  // Reset scroll on track change
  useEffect(() => {
    lineRefs.current = [];
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0 });
    }
  }, [currentTrack?.track_name, currentTrack?.artist_name]);

  // Progress bar percentage
  const progressPercent = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;

  // No track playing
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
        {/* Draggable header area */}
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

  return (
    <div
      className="lyra-overlay"
      style={{
        background: themeConfig.background,
        backdropFilter: themeConfig.backdropBlur,
        opacity: opacity / 100,
      }}
    >
      {/* Track Info Header - also drag region */}
      <div className="lyra-header" data-tauri-drag-region>
        <div className="lyra-track-info" style={{ flex: 1 }}>
          <div
            className="lyra-track-name"
            style={{
              color: themeConfig.textColor,
              fontFamily: themeConfig.fontFamily,
            }}
          >
            {currentTrack.track_name}
          </div>
          <div
            className="lyra-artist-name"
            style={{
              color: themeConfig.dimColor,
              fontFamily: themeConfig.fontFamily,
            }}
          >
            {currentTrack.artist_name}
            {currentTrack.album_name && ` • ${currentTrack.album_name}`}
          </div>
        </div>
        <div className="lyra-play-status">
          {isPlaying ? (
            <span className="lyra-playing-indicator" style={{ color: themeConfig.highlightColor }}>
              ● LIVE
            </span>
          ) : (
            <span style={{ color: themeConfig.dimColor }}>⏸ PAUSED</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="lyra-progress-container">
        <div
          className="lyra-progress-bar"
          style={{
            width: `${progressPercent}%`,
            background: themeConfig.highlightColor,
          }}
        />
      </div>

      {/* Lyrics Container */}
      <div className="lyra-lyrics-container" ref={containerRef}>
        {lyricsLoading ? (
          <div className="lyra-loading">
            <div className="lyra-spinner" style={{ borderColor: themeConfig.highlightColor }} />
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
              Fetching lyrics...
            </p>
          </div>
        ) : lyricsError ? (
          <div className="lyra-no-lyrics">
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
              Could not find lyrics for this track
            </p>
          </div>
        ) : lyricLines.length === 0 ? (
          <div className="lyra-no-lyrics">
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
              No lyrics available for this track
            </p>
          </div>
        ) : (
          <div className="lyra-lines">
            {/* Top spacer so first line can be centered */}
            <div className="lyra-spacer" />
            {lyricLines.map((line, index) => {
              const isActive = index === activeLineIndex;
              const distance = Math.abs(index - activeLineIndex);

              return (
                <LyricLine
                  key={index}
                  text={line.text}
                  isActive={isActive}
                  distance={distance}
                  theme={themeConfig}
                  fontSize={fontSize}
                  lineRef={(el) => setLineRef(el, index)}
                />
              );
            })}
            {/* Bottom spacer so last line can be centered */}
            <div className="lyra-spacer" />
          </div>
        )}
      </div>

      {/* Source indicator */}
      <div
        className="lyra-source-indicator"
        style={{
          color: themeConfig.dimColor,
          fontFamily: themeConfig.fontFamily,
          fontSize: 11,
          padding: "4px 12px",
          textAlign: "right",
          opacity: 0.5,
        }}
      >
        via {currentTrack.source}
      </div>
    </div>
  );
}
