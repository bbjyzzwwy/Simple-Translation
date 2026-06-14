# Changelog

## 0.1.2 (2026-06-14)

- Fix sidebar panel incorrectly entering dictionary mode for Chinese sentences (now only 1–4 character Chinese words use dictionary mode)

## 0.1.1 (2026-06-14)

- Add system dependency check for ffmpeg + pacat (TTS playback)
- Add README install guide for required dependencies

## 0.1.0 (2026-06-14)

### ✨ Features

- **Hover Translation** — Hover to see translation in a Markdown tooltip. Single words get dictionary definitions (multiple meanings with POS) and IPA phonetics.
- **Shortcut Translation** — `Ctrl+Shift+T` on selected text shows the same translation tooltip.
- **Sidebar Translation Panel** — Full translation panel with auto language detection, Enter to translate, Alt+Enter for newline.
- **Dictionary Mode** — Single words (Chinese ≤4 chars or single English word) get rich dictionary definitions via DeepSeek.
- **IPA Phonetics** — Single English words display IPA pronunciation (DeepSeek), shown next to original text.
- **Neural TTS** — 🔊 Read Aloud via Youdao neural TTS. Supports multiple voices. Status bar shows "朗读中..." during playback. Click-guard prevents overlapping speech.
- **DeepSeek Translation** — Primary translation engine (fast, high quality). Falls back to MyMemory when not configured.
- **Auto Language Detection** — CJK character ratio detection for Chinese vs English.
- **Configurable** — Hover mode, translation API, TTS engine, voice selection, source/target language.
