use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Spotify credentials (read from environment variables or fallback to defaults)
fn get_client_id() -> String {
    std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_else(|_| "YOUR_SPOTIFY_CLIENT_ID".to_string())
}

fn get_client_secret() -> String {
    std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_else(|_| "YOUR_SPOTIFY_CLIENT_SECRET".to_string())
}

fn get_redirect_uri() -> String {
    std::env::var("SPOTIFY_REDIRECT_URI").unwrap_or_else(|_| "https://nonelaborative-pseudomonocyclic-kimberly.ngrok-free.dev".to_string())
}

const SCOPES: &str = "user-read-currently-playing user-read-playback-state";

/// Stored auth state
pub struct AuthState {
    pub access_token: Mutex<Option<String>>,
    pub refresh_token: Mutex<Option<String>>,
    pub expires_at: Mutex<Option<u64>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            access_token: Mutex::new(None),
            refresh_token: Mutex::new(None),
            expires_at: Mutex::new(None),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpotifyAuthUrl {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurrentlyPlaying {
    pub is_playing: bool,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: String,
    pub album_art_url: Option<String>,
    pub progress_ms: u64,
    pub duration_ms: u64,
    pub track_id: String,
}

#[derive(Debug, Deserialize)]
struct SpotifyImage {
    url: String,
}

#[derive(Debug, Deserialize)]
struct SpotifyArtist {
    name: String,
}

#[derive(Debug, Deserialize)]
struct SpotifyAlbum {
    name: String,
    images: Vec<SpotifyImage>,
}

#[derive(Debug, Deserialize)]
struct SpotifyTrack {
    name: String,
    artists: Vec<SpotifyArtist>,
    album: SpotifyAlbum,
    id: String,
    duration_ms: u64,
}

#[derive(Debug, Deserialize)]
struct SpotifyCurrentlyPlayingResponse {
    is_playing: bool,
    progress_ms: Option<u64>,
    item: SpotifyTrack,
}

use tauri_plugin_opener::OpenerExt;

/// Generate Spotify OAuth authorization URL and open it in the default browser
#[tauri::command]
pub fn get_spotify_auth_url(app: tauri::AppHandle) -> Result<SpotifyAuthUrl, String> {
    let url = format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}&show_dialog=true",
        get_client_id(),
        urlencoding::encode(&get_redirect_uri()),
        urlencoding::encode(SCOPES)
    );
    
    // Open the URL in default browser using tauri-plugin-opener
    app.opener()
        .open_url(&url, None::<String>)
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    Ok(SpotifyAuthUrl { url })
}

/// Exchange authorization code for access token
#[tauri::command]
pub async fn exchange_spotify_code(code: String, auth_state: State<'_, AuthState>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let credentials = format!("{}:{}", get_client_id(), get_client_secret());
    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, credentials.as_bytes());

    let redirect_uri = get_redirect_uri();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", &redirect_uri),
    ];

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {}", encoded))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let token_resp: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + token_resp.expires_in;

    *auth_state.access_token.lock().unwrap() = Some(token_resp.access_token);
    *auth_state.refresh_token.lock().unwrap() = Some(token_resp.refresh_token.unwrap_or_default());
    *auth_state.expires_at.lock().unwrap() = Some(expires_at);

    Ok("Authentication successful".to_string())
}

/// Refresh the access token using refresh_token
async fn refresh_access_token(auth_state: &AuthState) -> Result<(), String> {
    let refresh = auth_state.refresh_token.lock().unwrap().clone();
    let refresh = refresh.ok_or("No refresh token available")?;

    let client = reqwest::Client::new();
    let credentials = format!("{}:{}", get_client_id(), get_client_secret());
    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, credentials.as_bytes());

    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", &refresh),
    ];

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {}", encoded))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    let token_resp: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + token_resp.expires_in;

    *auth_state.access_token.lock().unwrap() = Some(token_resp.access_token);
    if let Some(new_refresh) = token_resp.refresh_token {
        *auth_state.refresh_token.lock().unwrap() = Some(new_refresh);
    }
    *auth_state.expires_at.lock().unwrap() = Some(expires_at);

    Ok(())
}

/// Get currently playing track from Spotify
#[tauri::command]
pub async fn get_currently_playing(auth_state: State<'_, AuthState>) -> Result<CurrentlyPlaying, String> {
    // Check if token needs refresh
    let expires_at = *auth_state.expires_at.lock().unwrap();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if expires_at.map_or(true, |exp| exp <= now + 60) {
        refresh_access_token(&auth_state).await?;
    }

    let token = auth_state.access_token.lock().unwrap().clone();
    let token = token.ok_or("Not authenticated. Please login first.")?;

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Spotify API request failed: {}", e))?;

    if response.status() == 204 {
        return Err("Nothing is currently playing".to_string());
    }

    if response.status() == 401 {
        // Token expired, try refresh
        refresh_access_token(&auth_state).await?;
        let new_token = auth_state.access_token.lock().unwrap().clone().ok_or("Refresh failed")?;
        let response = client
            .get("https://api.spotify.com/v1/me/player/currently-playing")
            .header("Authorization", format!("Bearer {}", new_token))
            .send()
            .await
            .map_err(|e| format!("Spotify API request failed after refresh: {}", e))?;

        if response.status() == 204 {
            return Err("Nothing is currently playing".to_string());
        }

        let resp: SpotifyCurrentlyPlayingResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Spotify response: {}", e))?;

        return Ok(CurrentlyPlaying {
            is_playing: resp.is_playing,
            track_name: resp.item.name,
            artist_name: resp.item.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
            album_name: resp.item.album.name,
            album_art_url: resp.item.album.images.first().map(|i| i.url.clone()),
            progress_ms: resp.progress_ms.unwrap_or(0),
            duration_ms: resp.item.duration_ms,
            track_id: resp.item.id,
        });
    }

    let resp: SpotifyCurrentlyPlayingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Spotify response: {}", e))?;

    Ok(CurrentlyPlaying {
        is_playing: resp.is_playing,
        track_name: resp.item.name,
        artist_name: resp.item.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
        album_name: resp.item.album.name,
        album_art_url: resp.item.album.images.first().map(|i| i.url.clone()),
        progress_ms: resp.progress_ms.unwrap_or(0),
        duration_ms: resp.item.duration_ms,
        track_id: resp.item.id,
    })
}

/// Check if user is authenticated
#[tauri::command]
pub fn is_spotify_authenticated(auth_state: State<'_, AuthState>) -> bool {
    auth_state.access_token.lock().unwrap().is_some()
}