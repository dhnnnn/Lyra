import { useEffect, useState } from "react";
import { useLyraStore } from "./store";
import LyricsOverlay from "./LyricsOverlay";
import SettingsPanel from "./components/SettingsPanel";

function App() {
  const { pollNowPlaying } = useLyraStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    pollNowPlaying();
  }, []);

  return (
    <div className="lyra-app">
      <LyricsOverlay />

      <button
        className="lyra-settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        title="Settings"
        aria-label="Toggle settings"
      >
        ⚙
      </button>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
