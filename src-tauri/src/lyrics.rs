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

/// LRCLIB API response (for /api/get)
#[derive(Debug, Deserialize)]
struct LrcLibResponse {
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

/// LRCLIB search response (for /api/search)
#[derive(Debug, Deserialize)]
struct LrcLibSearchItem {
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

/// Clean up track name from browser media sessions
/// Removes things like "(Official Video)", "(Lyric Video)", etc.
fn clean_track_name(name: &str) -> String {
    let cleaned = name.to_string();
    
    // Common patterns to remove
    let patterns = [
        "(Official Video)",
        "(Official Music Video)",
        "(Official Lyric Video)",
        "(Official Audio)",
        "(Lyric Video)",
        "(Lyrics)",
        "(Audio)",
        "(MV)",
        "(Music Video)",
        "[Official Video]",
        "[Official Music Video]",
        "[Official Lyric Video]",
        "[Official Audio]",
        "[Lyric Video]",
        "[Lyrics]",
        "[Audio]",
        "[MV]",
        "[Music Video]",
        "| Official Video",
        "| Official Music Video",
        "| Official Lyric Video",
        "- Official Video",
        "- Official Music Video",
        "- Official Lyric Video",
    ];
    
    let mut result = cleaned;
    for pattern in &patterns {
        // Case-insensitive removal
        let lower = result.to_lowercase();
        let pattern_lower = pattern.to_lowercase();
        if let Some(pos) = lower.find(&pattern_lower) {
            result = format!("{}{}", &result[..pos], &result[pos + pattern.len()..]);
        }
    }
    
    // If title contains " - " (like "Artist - Song"), try to extract song part
    // But only if there's no separate artist info
    result = result.trim().to_string();
    
    // Remove trailing whitespace and dashes
    result = result.trim_end_matches('-').trim_end_matches('|').trim().to_string();
    
    result
}

/// Extract artist and track from a combined title like "Artist - Track"
fn split_artist_track(title: &str, given_artist: &str) -> (String, String) {
    // If the title contains " - " and artist seems to be in the title
    if let Some(dash_pos) = title.find(" - ") {
        let before = title[..dash_pos].trim();
        let after = title[dash_pos + 3..].trim();
        
        // Check if artist name is the part before dash
        if before.to_lowercase().contains(&given_artist.to_lowercase())
            || given_artist.to_lowercase().contains(&before.to_lowercase())
        {
            return (before.to_string(), clean_track_name(after));
        }
    }
    
    (given_artist.to_string(), clean_track_name(title))
}

/// Fetch lyrics from LRCLIB API
#[tauri::command]
pub async fn fetch_lyrics(
    track_name: String,
    artist_name: String,
    album_name: Option<String>,
) -> Result<LyricsResult, String> {
    let client = reqwest::Client::new();
    let ua = "Lyra/0.1.0 (https://github.com/dhnnn/Lyra)";

    // Clean up track name (remove "(Official Video)" etc.)
    let (clean_artist, clean_track) = split_artist_track(&track_name, &artist_name);
    
    eprintln!("[Lyra] Lyrics lookup: '{}' by '{}' (original: '{}' by '{}')", 
        clean_track, clean_artist, track_name, artist_name);

    // === Attempt 1: Exact match with /api/get ===
    let result = try_exact_match(&client, ua, &clean_track, &clean_artist, &album_name).await;
    if let Ok(lyrics) = result {
        eprintln!("[Lyra] ✅ Found lyrics via exact match");
        return Ok(lyrics);
    }

    // === Attempt 2: Search API with cleaned track name ===
    let result = try_search(&client, ua, &clean_track, &clean_artist).await;
    if let Ok(lyrics) = result {
        eprintln!("[Lyra] ✅ Found lyrics via search");
        return Ok(lyrics);
    }

    // === Attempt 3: Search with just the track name (broader search) ===
    let result = try_search(&client, ua, &clean_track, "").await;
    if let Ok(lyrics) = result {
        eprintln!("[Lyra] ✅ Found lyrics via broad search");
        return Ok(lyrics);
    }

    eprintln!("[Lyra] ❌ No lyrics found for '{}' by '{}'", clean_track, clean_artist);
    Err(format!("Lyrics not found for '{}' by '{}'", clean_track, clean_artist))
}

/// Try exact match with LRCLIB /api/get
async fn try_exact_match(
    client: &reqwest::Client,
    ua: &str,
    track_name: &str,
    artist_name: &str,
    album_name: &Option<String>,
) -> Result<LyricsResult, String> {
    let mut params = vec![
        ("track_name", track_name.to_string()),
        ("artist_name", artist_name.to_string()),
    ];

    if let Some(ref album) = album_name {
        if !album.is_empty() {
            params.push(("album_name", album.clone()));
        }
    }

    let response = client
        .get("https://lrclib.net/api/get")
        .query(&params)
        .header("User-Agent", ua)
        .send()
        .await
        .map_err(|e| format!("LRCLIB request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("LRCLIB returned status: {}", response.status()));
    }

    let lrc_resp: LrcLibResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LRCLIB response: {}", e))?;

    build_lyrics_result(
        lrc_resp.track_name,
        lrc_resp.artist_name,
        lrc_resp.album_name,
        lrc_resp.synced_lyrics,
        lrc_resp.plain_lyrics,
        track_name,
        artist_name,
    )
}

/// Try search with LRCLIB /api/search
async fn try_search(
    client: &reqwest::Client,
    ua: &str,
    track_name: &str,
    artist_name: &str,
) -> Result<LyricsResult, String> {
    let mut query = track_name.to_string();
    if !artist_name.is_empty() {
        query = format!("{} {}", artist_name, track_name);
    }

    eprintln!("[Lyra] Searching LRCLIB: q='{}'", query);

    let response = client
        .get("https://lrclib.net/api/search")
        .query(&[("q", &query)])
        .header("User-Agent", ua)
        .send()
        .await
        .map_err(|e| format!("LRCLIB search failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("LRCLIB search returned status: {}", response.status()));
    }

    let results: Vec<LrcLibSearchItem> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LRCLIB search response: {}", e))?;

    eprintln!("[Lyra] Search returned {} results", results.len());

    // Find the first result that has lyrics
    for item in results {
        if item.synced_lyrics.is_some() || item.plain_lyrics.is_some() {
            return build_lyrics_result(
                item.track_name,
                item.artist_name,
                item.album_name,
                item.synced_lyrics,
                item.plain_lyrics,
                track_name,
                artist_name,
            );
        }
    }

    Err("No lyrics found in search results".to_string())
}

/// Build LyricsResult from API response fields
fn build_lyrics_result(
    resp_track: Option<String>,
    resp_artist: Option<String>,
    resp_album: Option<String>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    fallback_track: &str,
    fallback_artist: &str,
) -> Result<LyricsResult, String> {
    let lines = if let Some(synced) = &synced_lyrics {
        parse_lrc(synced)
    } else if let Some(plain) = &plain_lyrics {
        plain
            .lines()
            .enumerate()
            .map(|(i, line)| LyricLine {
                time_ms: (i as u64) * 3000,
                text: line.to_string(),
            })
            .collect()
    } else {
        return Err("No lyrics content".to_string());
    };

    if lines.is_empty() {
        return Err("Empty lyrics".to_string());
    }

    Ok(LyricsResult {
        track_name: resp_track.unwrap_or_else(|| fallback_track.to_string()),
        artist_name: resp_artist.unwrap_or_else(|| fallback_artist.to_string()),
        album_name: resp_album,
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

        if let Some(text_start) = find_closing_bracket(line) {
            let timestamp_part = &line[1..text_start];
            let text = line[text_start + 1..].trim().to_string();

            if let Some(time_ms) = parse_timestamp(timestamp_part) {
                lines.push(LyricLine { time_ms, text });
            }
        }
    }

    lines.sort_by_key(|l| l.time_ms);
    lines
}

fn find_closing_bracket(s: &str) -> Option<usize> {
    s.find(']')
}

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

    if low == 0 {
        Some(0)
    } else {
        Some(low - 1)
    }
}
