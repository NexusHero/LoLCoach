# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

### Removed
- Live features that Riot's third-party policy does not permit: enemy ability and summoner-spell cooldown estimates and 1-click timers, the jungle gank-window, shutdown and level-6 alerts, and the LLM "immediate action" and "counter-play" lines. The live HUD now shows objective countdowns, own unspent gold, the next buy and the build plan only.
- The LLM call on the objective setup window; the LLM now runs on game start, item purchase, death, high gold and manual refresh.

### Fixed
- Objective timers updated to the current season: Voidgrubs spawn at 8:00 as one camp of three and leave at 14:45, Rift Herald spawns at 15:00. Elder Dragon is now tracked after a team takes its fourth dragon.

### Changed
- The app imports Material from the `material_ui` package instead of the deprecated `package:flutter/material.dart` (Flutter is moving Material out of the SDK).
- The coach command bar sets **review markers** (F1, "Marker: …", or any free-text note) that are listed after the match, instead of tracking enemy spells.
- Redesigned the desktop UI to the **Elevated** glass visual language — violet AI accent, champagne win-condition accent, frosted-glass cards over a gradient canvas, a refreshed type scale, and an in-game **hero card** that leads with the single most important action. The palette is exposed as an `AppColors` `ThemeExtension` (dark + light).

### Added
- Role-aware LLM coaching (Claude / OpenAI / Gemini)
- Heuristic counter-item engine covering 170+ champions
- Flutter desktop app (macOS, Windows, Linux)
- WebSocket bridge with live reconnect and exponential backoff
- Event triggers: `GAME_STARTED`, `ITEM_PURCHASED`, `PLAYER_DIED`, manual FAB
- Multi-provider AI support — or fully offline heuristic-only mode
- CI pipeline (lint, type-check, bridge tests, flutter analyze)
- Windows MSIX + macOS/Linux build scripts

---

<!-- Add a new entry when cutting a release:

## [1.0.0] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
-->
