import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLyraStore } from "./store";
import { THEMES } from "./types";

export default function LyricsOverlay() {
  const {
    lyricLines,
    activeLineIndex,
    lyricsLoading,
    currentTrack,
    isPlaying,
    theme,
    opacity,
    fontSize,
  } = useLyraStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const themeConfig = THEMES[theme];

  // Auto-scroll to active line
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      const scrollTop =
        active.offsetTop -
        container.offsetTop -
        containerRect.height / 2 +
        activeRect.height / 2;

      container.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    }
  }, [activeLineIndex]);

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
        <div className="lyra-empty">
          <div className="lyra-empty-icon">♪</div>
          <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
            Play a song on Spotify to see lyrics
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
      {/* Track Info Header */}
      <div className="lyra-header">
        {currentTrack.album_art_url && (
          <img
            src={currentTrack.album_art_url}
            alt={currentTrack.album_name}
            className="lyra-album-art"
          />
        )}
        <div className="lyra-track-info">
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

      {/* Lyrics Container */}
      <div className="lyra-lyrics-container" ref={containerRef}>
        {lyricsLoading ? (
          <div className="lyra-loading">
            <div className="lyra-spinner" style={{ borderColor: themeConfig.highlightColor }} />
            <p style={{ color: themeConfig.dimColor, fontFamily: themeConfig.fontFamily }}>
              Fetching lyrics...
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
            {/* Spacer to center active line */}
            <div className="lyra-spacer" />
            <AnimatePresence>
              {lyricLines.map((line, index) => {
                const isActive = index === activeLineIndex;
                const isPast = index < activeLineIndex;

                return (
                  <motion.div
                    key={`${currentTrack.track_id}-${index}`}
                    ref={isActive ? activeRef : null}
                    className={`lyra-line ${isActive ? "active" : ""} ${isPast ? "past" : ""}`}
                    style={{
                      color: isActive
                        ? themeConfig.highlightColor
                        : isPast
                        ? themeConfig.dimColor
                        : themeConfig.textColor,
                      fontFamily: themeConfig.fontFamily,
                      fontSize: isActive ? fontSize : fontSize * 0.85,
                      fontWeight: isActive ? "700" : themeConfig.fontWeight,
                      textShadow: isActive ? themeConfig.textShadow : "none",
                      opacity: isPast ? 0.4 : 1,
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: isPast ? 0.4 : 1,
                      y: 0,
                      scale: isActive ? 1.05 : 1,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                  >
                    {line.text}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {/* Spacer to center active line */}
            <div className="lyra-spacer" />
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="lyra-progress-container">
        <div
          className="lyra-progress-bar"
          style={{
            width: `${(currentTrack.progress_ms / currentTrack.duration_ms) * 100}%`,
            background: themeConfig.highlightColor,
          }}
        />
      </div>
    </div>
  );
}