# DESIGN.md — Lyra (Lyrics Overlay App)

## 1. Problem Statement
Saat bekerja (coding, desain, main game, edit video) sambil dengar musik di Spotify, pengguna tidak bisa melihat lirik tanpa membuka Spotify dan mengganggu fokus kerja. Tidak ada cara untuk menampilkan lirik secara real-time di atas aplikasi lain tanpa berpindah context.

## 2. Product Idea
Lyra adalah aplikasi desktop overlay yang mendeteksi lagu yang sedang diputar di Spotify, mengambil lirik sinkron dari LRCLIB, lalu menampilkannya sebagai overlay transparan yang selalu berada di atas aplikasi lain — mirip gaya lirik Instagram Story / karaoke modern.

## 3. Target Pengguna
- Developer / desainer yang kerja sambil dengar musik
- Streamer & content creator (butuh overlay untuk OBS)
- Pengguna umum yang suka karaoke santai di depan laptop

## 4. User Journey
1. User login Spotify (OAuth).
2. User play lagu di Spotify (web/desktop).
3. Lyra otomatis mendeteksi lagu yang sedang diputar.
4. Lyra mengambil lirik dari LRCLIB.
5. Overlay muncul dan lirik ter-highlight otomatis mengikuti progres lagu.
6. Saat lagu berganti, proses berulang otomatis tanpa aksi user.

## 5. Arsitektur Sistem
```
             User
               │
               ▼
        Spotify Web/Desktop
               │
               ▼
     Spotify Web API (Currently Playing)
               │
               ▼
        Lyrics Engine (Tauri/Rust)
               │
       ┌───────┴───────┐
       ▼               ▼
  LRCLIB API      Local Cache
       │               │
       └───────┬───────┘
               ▼
       Synchronization Engine
               ▼
       Overlay Renderer (React)
               ▼
     Transparent Always-on-Top Window
```
Semua proses berjalan lokal di komputer user. Tidak ada backend/server — hanya berkomunikasi langsung ke Spotify API dan LRCLIB API.

## 6. Tech Stack & Alasan
| Komponen | Pilihan | Alasan |
|---|---|---|
| UI Framework | React + TypeScript | Familiar, ekosistem animasi kuat (Framer Motion) |
| Desktop Shell | Tauri | RAM lebih ringan dari Electron, native window control (transparent, always-on-top, click-through) |
| Data Musik | Spotify Web API | Sumber currently-playing paling reliable |
| Data Lirik | LRCLIB API | Gratis, format LRC sinkron, tanpa perlu API key khusus |
| Animasi | Framer Motion + CSS | Transisi highlight halus |

## 7. Fitur Utama
- 🎵 Deteksi lagu Spotify otomatis
- ✨ Highlight lirik real-time (gaya Instagram Story)
- 🌈 Tema: Spotify, Apple Music, IG Story, Karaoke, Minimal, Neon
- 🎨 Kustomisasi: font, warna, shadow, blur, posisi, ukuran, opacity
- 📌 Always On Top
- 🖱️ Click-through mode
- 🎮 Game Mode (kompatibel di atas fullscreen game)
- 🌍 Terjemahan lirik (opsional, versi lanjutan)

## 8. Roadmap
### MVP (2–3 minggu)
- Login Spotify (OAuth)
- Deteksi lagu real-time
- Ambil & sinkronisasi lirik (LRCLIB + progress_ms)
- Overlay transparan tema dasar
- Pengaturan posisi & ukuran

### v1.1 — UX Polish
- Multi-tema
- Animasi transisi antar baris
- Auto-hide saat musik pause
- Cache lirik lokal
- Hotkey show/hide

### v2.0 — Ekspansi
- Terjemahan lirik real-time
- Romanisasi (lagu JP/KR)
- Dukungan platform musik lain (jika API tersedia)
- Mini player
- Sistem tema komunitas
- Overlay khusus OBS untuk streamer

## 9. Visi Jangka Panjang
Lyra bukan sekadar "penampil lirik", tapi berpotensi menjadi **platform overlay musik** — dengan visualizer audio, mode karaoke, statistik lagu, dan tema buatan komunitas sebagai pengembangan lanjutan.

## 10. Batasan & Risiko
- Bergantung pada rate limit & kebijakan Spotify Web API.
- LRCLIB tidak selalu punya lirik untuk semua lagu (perlu fallback/pesan "lirik tidak ditemukan").
- Perilaku overlay di atas game fullscreen (exclusive fullscreen) bisa terbatas tergantung engine game.
- Distribusi ke publik butuh code signing agar tidak terdeteksi sebagai aplikasi mencurigakan oleh Windows Defender.