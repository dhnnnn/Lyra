import { useEffect, useState } from "react";
import { useLyraStore } from "./store";
import { THEMES, type ThemeName } from "./types";
import LyricsOverlay from "./LyricsOverlay";

function App() {
  const {
    theme,
    opacity,
    fontSize,
    currentTrack,
    pollNowPlaying,
    setTheme,
    setOpacity,
    setFontSize,
  } = useLyraStore();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Start polling Windows Media Session immediately - no auth needed!
    console.log("[Lyra] Starting media session polling...");
    pollNowPlaying();
  }, []);

  return (
    <div className="lyra-app">
      {/* Lyrics Overlay - always rendered */}
      <LyricsOverlay />

      {/* Settings Toggle Button */}
      <button
        className="lyra-settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        title="Settings"
      >
        ⚙
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="lyra-settings-panel">
          <div className="lyra-settings-header">
            <h2>Lyra Settings</h2>
            <button className="lyra-close-btn" onClick={() => setShowSettings(false)}>
              ✕
            </button>
          </div>

          {/* Status Section */}
          <div className="lyra-settings-section">
            <h3>Now Playing</h3>
            {currentTrack ? (
              <div className="lyra-auth-status connected">
                <span className="lyra-status-dot" /> {currentTrack.track_name} — {currentTrack.artist_name}
                <br />
                <small style={{ opacity: 0.6 }}>via {currentTrack.source}</small>
              </div>
            ) : (
              <div className="lyra-auth-status">
                <span style={{ opacity: 0.6 }}>No media playing. Play a song in any media player to get started!</span>
              </div>
            )}
          </div>

          {/* Theme Section */}
          <div className="lyra-settings-section">
            <h3>Theme</h3>
            <div className="lyra-theme-grid">
              {(Object.keys(THEMES) as ThemeName[]).map((themeName) => (
                <button
                  key={themeName}
                  className={`lyra-theme-btn ${theme === themeName ? "active" : ""}`}
                  onClick={() => setTheme(themeName)}
                  style={{
                    background: THEMES[themeName].background,
                    color: THEMES[themeName].textColor,
                    border: `2px solid ${theme === themeName ? THEMES[themeName].highlightColor : "transparent"}`,
                  }}
                >
                  {THEMES[themeName].label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Section */}
          <div className="lyra-settings-section">
            <h3>Opacity: {opacity}%</h3>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="lyra-slider"
            />
          </div>

          {/* Font Size Section */}
          <div className="lyra-settings-section">
            <h3>Font Size: {fontSize}px</h3>
            <input
              type="range"
              min="16"
              max="48"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="lyra-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
