mod lyrics;
mod spotify;

use spotify::AuthState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file
    // Try multiple locations for .env file
    let env_loaded = dotenvy::dotenv().is_ok();
    if !env_loaded {
        // Try parent directory (workspace root)
        let parent_env = std::path::Path::new("../.env");
        if parent_env.exists() {
            dotenvy::from_path(parent_env).ok();
        }
    }

    // Debug: print loaded env vars to console
    eprintln!("[Lyra] SPOTIFY_CLIENT_ID = {:?}", std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_else(|_| "NOT SET".into()));
    eprintln!("[Lyra] SPOTIFY_REDIRECT_URI = {:?}", std::env::var("SPOTIFY_REDIRECT_URI").unwrap_or_else(|_| "NOT SET".into()));
    eprintln!("[Lyra] Current dir = {:?}", std::env::current_dir().unwrap_or_default());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AuthState::new())
        .invoke_handler(tauri::generate_handler![
            spotify::get_spotify_auth_url,
            spotify::exchange_spotify_code,
            spotify::get_currently_playing,
            spotify::is_spotify_authenticated,
            lyrics::fetch_lyrics,
            lyrics::find_active_line,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}