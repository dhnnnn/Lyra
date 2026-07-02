# SKILL.md — Lyra (Lyrics Overlay App)

Dokumen ini mendaftar kemampuan teknis yang dibutuhkan untuk membangun Lyra, dikelompokkan berdasarkan area dan prioritas.

## 1. Frontend / UI
| Skill | Prioritas | Keterangan |
|---|---|---|
| React + TypeScript | Wajib | UI utama overlay & settings panel |
| CSS (Flexbox/Grid, animasi) | Wajib | Layout overlay, efek glow/blur/glassmorphism |
| Framer Motion | Wajib | Transisi highlight lirik yang halus |
| State management (Zustand/Context API) | Wajib | Menyimpan state lagu, tema, posisi window |
| Design system dasar (spacing, typography, color) | Disarankan | Supaya tema (Minimal, Neon, IG Story) konsisten |

## 2. Desktop / Tauri
| Skill | Prioritas | Keterangan |
|---|---|---|
| Tauri fundamentals (config, window API) | Wajib | Always-on-top, transparent window, click-through |
| Rust dasar (syntax, ownership, async/await) | Wajib | Tauri command & backend logic ringan |
| Tauri IPC (invoke, event) | Wajib | Komunikasi React ↔ Rust |
| Windows-specific window behavior | Disarankan | Perilaku overlay saat fullscreen game/app lain |
| Auto-start & system tray (tauri-plugin-autostart) | Disarankan | Auto start saat Windows nyala |
| Code signing & installer (MSI/NSIS) | Nice to have | Untuk distribusi resmi ke user lain |

## 3. Integrasi API
| Skill | Prioritas | Keterangan |
|---|---|---|
| OAuth 2.0 (Authorization Code Flow) | Wajib | Login Spotify |
| Spotify Web API (Currently Playing endpoint) | Wajib | Ambil artist, track, progress_ms |
| LRCLIB API | Wajib | Ambil lirik sinkron format LRC |
| Parsing format LRC | Wajib | Mengubah timestamp `[mm:ss.xx]` jadi array baris |
| HTTP client di Rust/JS (reqwest / fetch) | Wajib | Request ke Spotify & LRCLIB |
| Token refresh handling | Wajib | Access token Spotify expired ±1 jam |

## 4. Sync Engine (Core Logic)
| Skill | Prioritas | Keterangan |
|---|---|---|
| Algoritma pencarian baris aktif (binary search / linear scan) | Wajib | Mapping `progress_ms` → baris lirik aktif |
| Polling & interval management | Wajib | Update posisi lagu tiap 1 detik tanpa lag/flicker |
| Caching lokal (file system / localStorage-like via Tauri fs) | Disarankan | Simpan lirik yang sudah pernah diambil |
| Debounce/throttle | Disarankan | Hindari request berlebihan ke API |

## 5. Kualitas & Deployment
| Skill | Prioritas | Keterangan |
|---|---|---|
| Git & version control | Wajib | Kolaborasi & rilis versi |
| Testing dasar (unit test sync engine) | Disarankan | Pastikan highlight lirik akurat |
| CI/CD sederhana (GitHub Actions build Tauri) | Nice to have | Build otomatis untuk tiap rilis |
| Analytics/error logging (Sentry, dsb) | Nice to have | Untuk versi publik nanti |

## Ringkasan Prioritas Belajar (kalau baru mulai)
1. Tauri + React setup dasar (window transparan & always-on-top) — ini yang paling menentukan apakah konsepnya feasible.
2. OAuth Spotify — tanpa ini tidak ada data lagu.
3. Parsing LRC + sync engine — ini "otak" produk.
4. Styling/animasi tema — ini yang bikin produk terasa premium.