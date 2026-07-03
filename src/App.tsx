import { useEffect, useState } from "react";
import { useLyraStore } from "./store";
import { THEMES, type ThemeName } from "./types";
import LyricsOverlay from "./LyricsOverlay";

function App() {
  const {
    isAuthenticated,
    authLoading,
    theme,
    opacity,
    fontSize,
    login,
    handleAuthCode,
    checkAuth,
    setTheme,
    setOpacity,
    setFontSize,
  } = useLyraStore();

  const [showSettings, setShowSettings] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");

  useEffect(() => {
    checkAuth();

    // Check URL for auth callback code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      handleAuthCode(code);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    }
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

          {/* Auth Section */}
          <div className="lyra-settings-section">
            <h3>Spotify Connection</h3>
            {isAuthenticated ? (
              <div className="lyra-auth-status connected">
                <span className="lyra-status-dot" /> Connected to Spotify
              </div>
            ) : (
              <div className="lyra-auth-section">
                <p className="lyra-auth-hint">
                  1. Click "Login" below<br />
                  2. Authorize in browser<br />
                  3. Copy the code from the redirect URL<br />
                  4. Paste it below
                </p>
                <button
                  className="lyra-btn lyra-btn-primary"
                  onClick={login}
                  disabled={authLoading}
                >
                  {authLoading ? "Loading..." : "Login with Spotify"}
                </button>
                <div className="lyra-code-input-group">
                  <input
                    type="text"
                    className="lyra-input"
                    placeholder="Paste auth code here..."
                    value={authCodeInput}
                    onChange={(e) => setAuthCodeInput(e.target.value)}
                  />
                  <button
                    className="lyra-btn lyra-btn-secondary"
                    onClick={() => {
                      if (authCodeInput.trim()) {
                        handleAuthCode(authCodeInput.trim());
                        setAuthCodeInput("");
                      }
                    }}
                    disabled={!authCodeInput.trim() || authLoading}
                  >
                    Submit
                  </button>
                </div>
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