use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NowPlaying {
    pub is_playing: bool,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: String,
    pub source: String,
    pub progress_ms: u64,
    pub duration_ms: u64,
}

#[cfg(windows)]
mod win {
    use super::NowPlaying;
    use windows::core::Interface;
    use windows::Foundation::{
        AsyncOperationCompletedHandler, AsyncStatus, IAsyncOperation,
    };
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::Duration;

    /// Wait for a WinRT IAsyncOperation using SetCompleted callback + Condvar.
    /// This is the correct non-blocking approach for the windows crate.
    fn wait_for_async<T: windows::core::RuntimeType + 'static>(
        op: &IAsyncOperation<T>,
        timeout: Duration,
    ) -> Result<T, String> {
        // Check if already completed (fast path)
        if let Ok(status) = op.Status() {
            if status == AsyncStatus::Completed {
                return op.GetResults().map_err(|e| format!("GetResults: {}", e));
            }
            if status == AsyncStatus::Error {
                let code = op.ErrorCode().map(|hr| hr.0).unwrap_or(0);
                return Err(format!("Error HRESULT 0x{:08X}", code));
            }
        }

        let pair = Arc::new((Mutex::new(false), Condvar::new()));
        let pair_clone = pair.clone();

        let handler = AsyncOperationCompletedHandler::<T>::new(move |_, _| {
            let (lock, cvar) = &*pair_clone;
            *lock.lock().unwrap() = true;
            cvar.notify_one();
            Ok(())
        });

        op.SetCompleted(&handler)
            .map_err(|e| format!("SetCompleted: {}", e))?;

        // Wait for callback or timeout
        let (lock, cvar) = &*pair;
        let completed = lock.lock().unwrap();
        if !*completed {
            let (_guard, timeout_result) = cvar.wait_timeout(completed, timeout).unwrap();
            if timeout_result.timed_out() {
                // Try to cancel
                if let Ok(info) = op.cast::<windows::Foundation::IAsyncInfo>() {
                    let _ = info.Cancel();
                }
                return Err(format!("Timeout ({}ms)", timeout.as_millis()));
            }
        }

        let status = op.Status().map_err(|e| format!("Status: {}", e))?;
        match status {
            AsyncStatus::Completed => op.GetResults().map_err(|e| format!("GetResults: {}", e)),
            AsyncStatus::Error => {
                let code = op.ErrorCode().map(|hr| hr.0).unwrap_or(0);
                Err(format!("Async error HRESULT 0x{:08X}", code))
            }
            AsyncStatus::Canceled => Err("Canceled".to_string()),
            _ => Err(format!("Unexpected status after wait: {:?}", status)),
        }
    }

    pub fn get_now_playing_inner() -> Result<NowPlaying, String> {
        let timeout = Duration::from_secs(3);

        // Get session manager
        let manager_op = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .map_err(|e| format!("RequestAsync: {}", e))?;
        let manager = wait_for_async(&manager_op, timeout)?;

        // Get current session
        let session = manager
            .GetCurrentSession()
            .map_err(|_| "No active media session".to_string())?;

        // Source app
        let source = session
            .SourceAppUserModelId()
            .map(|s| s.to_string_lossy())
            .unwrap_or_else(|_| "Unknown".to_string());

        // Playback status (synchronous)
        let playback_info = session
            .GetPlaybackInfo()
            .map_err(|e| format!("GetPlaybackInfo: {}", e))?;
        let playback_status = playback_info
            .PlaybackStatus()
            .unwrap_or(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped);
        let is_playing = playback_status
            == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

        // Timeline (synchronous)
        // Use LastUpdatedTime + Position to calculate actual current position
        // Browser media sessions often don't update Position in real-time,
        // but LastUpdatedTime tells us WHEN the Position was valid
        let (progress_ms, duration_ms) = match session.GetTimelineProperties() {
            Ok(timeline) => {
                let pos = timeline
                    .Position()
                    .map(|d| (d.Duration / 10_000) as u64)
                    .unwrap_or(0);
                let end = timeline
                    .EndTime()
                    .map(|d| (d.Duration / 10_000) as u64)
                    .unwrap_or(0);
                
                // Calculate real position: reported_position + time_elapsed_since_last_update
                let real_pos = if is_playing {
                    if let Ok(last_updated) = timeline.LastUpdatedTime() {
                        // LastUpdatedTime is a DateTime (100-ns ticks since 1601-01-01)
                        let last_updated_ticks = last_updated.UniversalTime;
                        // Get current time as FILETIME (100-ns intervals since 1601-01-01)
                        let sys_time = unsafe {
                            windows::Win32::System::SystemInformation::GetSystemTimeAsFileTime()
                        };
                        let now_100ns = ((sys_time.dwHighDateTime as i64) << 32) | (sys_time.dwLowDateTime as i64);
                        let elapsed_ms = ((now_100ns - last_updated_ticks) / 10_000).max(0) as u64;
                        
                        let calculated = pos + elapsed_ms;
                        calculated.min(end)
                    } else {
                        pos
                    }
                } else {
                    pos
                };
                
                (real_pos, end)
            }
            Err(_) => (0, 0),
        };

        // Media properties (async)
        let properties_op = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| format!("TryGetMediaPropertiesAsync: {}", e))?;
        let properties = wait_for_async(&properties_op, timeout)?;

        let track_name = properties
            .Title()
            .map(|s| s.to_string_lossy())
            .unwrap_or_else(|_| "Unknown".to_string());
        let artist_name = properties
            .Artist()
            .map(|s| s.to_string_lossy())
            .unwrap_or_else(|_| "Unknown".to_string());
        let album_name = properties
            .AlbumTitle()
            .map(|s| s.to_string_lossy())
            .unwrap_or_else(|_| "Unknown".to_string());

        // Clean source name
        let source_lower = source.to_lowercase();
        let source_display = if source_lower.contains("spotify") {
            "Spotify".to_string()
        } else if source_lower.contains("chrome") {
            "Chrome".to_string()
        } else if source_lower.contains("firefox") {
            "Firefox".to_string()
        } else if source_lower.contains("edge") {
            "Edge".to_string()
        } else if source_lower.contains("vlc") {
            "VLC".to_string()
        } else if source_lower.contains("wmplayer") || source_lower.contains("media player") {
            "Windows Media Player".to_string()
        } else if source_lower.contains("foobar") {
            "foobar2000".to_string()
        } else if source_lower.contains("musicbee") {
            "MusicBee".to_string()
        } else {
            source.clone()
        };

        if track_name.is_empty() || track_name == "Unknown" {
            return Err("No track info available".to_string());
        }

        Ok(NowPlaying {
            is_playing,
            track_name,
            artist_name,
            album_name,
            source: source_display,
            progress_ms,
            duration_ms,
        })
    }
}

#[cfg(not(windows))]
mod win {
    use super::NowPlaying;

    pub fn get_now_playing_inner() -> Result<NowPlaying, String> {
        Err("Windows Media Session API is only available on Windows".to_string())
    }
}

/// Tauri command: Get currently playing media from Windows Media Session.
#[tauri::command]
pub async fn get_now_playing() -> Result<NowPlaying, String> {
    // Spawn on a dedicated OS thread (not from tokio pool) to avoid COM conflicts
    let (tx, rx) = tokio::sync::oneshot::channel();

    std::thread::Builder::new()
        .name("media-session".to_string())
        .spawn(move || {
            let result = win::get_now_playing_inner();
            let _ = tx.send(result);
        })
        .map_err(|e| format!("Thread spawn: {}", e))?;

    match tokio::time::timeout(tokio::time::Duration::from_secs(5), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Worker thread dropped".to_string()),
        Err(_) => Err("Timeout (>5s)".to_string()),
    }
}
