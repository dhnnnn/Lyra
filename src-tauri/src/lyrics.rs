use serde::{Deserialize, Serialize};

/// A single line of synchronized lyrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

/// Full lyrics response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResult {
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub lines: Vec<LyricLine>,
    pub source: String,
}

/// LRCLIB API response
#[derive(Debug, Deserialize)]
struct LrcLibResponse {
    track_name: Option<String>,
    artist_name: Option<String>,
    album_name: Option<String>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

/// Fetch lyrics from LRCLIB API
#[tauri::command]
pub async fn fetch_lyrics(
    track_name: String,
    artist_name: String,
    album_name: Option<String>,
) -> Result<LyricsResult, String> {
    let client = reqwest::Client::new();

    let mut params = vec![
        ("track_name", track_name.clone()),
        ("artist_name", artist_name.clone()),
    ];

    if let Some(ref album) = album_name {
        params.push(("album_name", album.clone()));
    }

    let response = client
        .get("https://lrclib.net/api/get")
        .query(&params)
        .header("User-Agent", "Lyra/0.1.0 (https://github.com/dhnnn/Lyra)")
        .send()
        .await
        .map_err(|e| format!("LRCLIB request failed: {}", e))?;

    if response.status() == 404 {
        return Err("Lyrics not found on LRCLIB".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("LRCLIB returned status: {}", response.status()));
    }

    let lrc_resp: LrcLibResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LRCLIB response: {}", e))?;

    // Prefer synced lyrics, fall back to plain lyrics
    let lines = if let Some(synced) = &lrc_resp.synced_lyrics {
        parse_lrc(synced)
    } else if let Some(plain) = &lrc_resp.plain_lyrics {
        plain
            .lines()
            .enumerate()
            .map(|(i, line)| LyricLine {
                time_ms: (i as u64) * 3000, // rough estimate: 3s per line
                text: line.to_string(),
            })
            .collect()
    } else {
        return Err("No lyrics available".to_string());
    };

    Ok(LyricsResult {
        track_name: lrc_resp.track_name.unwrap_or(track_name),
        artist_name: lrc_resp.artist_name.unwrap_or(artist_name),
        album_name: lrc_resp.album_name.or(album_name),
        lines,
        source: "LRCLIB".to_string(),
    })
}

/// Parse LRC format lyrics into structured lines
/// LRC format: [mm:ss.xx] text
pub fn parse_lrc(lrc_text: &str) -> Vec<LyricLine> {
    let mut lines: Vec<LyricLine> = Vec::new();

    for line in lrc_text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Try to parse timestamp tags: [mm:ss.xx] or [mm:ss.xxx] or [mm:ss]
        if let Some(text_start) = find_closing_bracket(line) {
            let timestamp_part = &line[1..text_start];
            let text = line[text_start + 1..].trim().to_string();

            if let Some(time_ms) = parse_timestamp(timestamp_part) {
                lines.push(LyricLine { time_ms, text });
            }
        }
    }

    // Sort by time
    lines.sort_by_key(|l| l.time_ms);
    lines
}

/// Find the index of the closing bracket ']'
fn find_closing_bracket(s: &str) -> Option<usize> {
    s.find(']')
}

/// Parse a timestamp like "01:23.45" or "01:23.456" or "01:23" into milliseconds
fn parse_timestamp(ts: &str) -> Option<u64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let minutes: u64 = parts[0].parse().ok()?;
    let seconds_part: Vec<&str> = parts[1].split('.').collect();
    let seconds: u64 = seconds_part[0].parse().ok()?;

    let millis = if seconds_part.len() > 1 {
        let frac_str = seconds_part[1];
        // Pad or truncate to 3 digits
        let padded = format!("{:0<3}", frac_str);
        let padded = &padded[..3.min(padded.len())];
        padded.parse::<u64>().unwrap_or(0)
    } else {
        0
    };

    Some(minutes * 60 * 1000 + seconds * 1000 + millis)
}

/// Find the active lyric line index based on current playback position
#[tauri::command]
pub fn find_active_line(lines: Vec<LyricLine>, progress_ms: u64) -> Option<usize> {
    if lines.is_empty() {
        return None;
    }

    // Binary search for the active line
    let mut low = 0;
    let mut high = lines.len();

    while low < high {
        let mid = (low + high) / 2;
        if lines[mid].time_ms <= progress_ms {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    // low is now the first line whose time_ms > progress_ms
    // So the active line is low - 1
    if low == 0 {
        Some(0)
    } else {
        Some(low - 1)
    }
}