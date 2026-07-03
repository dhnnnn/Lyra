mod lyrics;
mod media_session;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            media_session::get_now_playing,
            lyrics::fetch_lyrics,
            lyrics::find_active_line,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
