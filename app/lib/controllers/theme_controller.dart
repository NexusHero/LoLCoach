import 'package:lol_coach/providers.dart';
import 'package:material_ui/material_ui.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'theme_controller.g.dart';

/// App-global holder for the selected [ThemeMode]. Lives above `MaterialApp`
/// (provided at the root) because it drives `MaterialApp.themeMode` — unlike
/// the screen-scoped `SettingsController`. The choice is persisted via
/// `StorageService` (shared_preferences), like the other settings.
///
/// `keepAlive: true` — this must survive for the app's lifetime, not be
/// disposed when no widget happens to be watching it (riverpod's default
/// for generated providers is autoDispose).
@Riverpod(keepAlive: true)
class ThemeController extends _$ThemeController {
  @override
  ThemeMode build() => _decode(ref.watch(storageServiceProvider).themeMode);

  Future<void> setMode(ThemeMode mode) async {
    if (mode == state) return;
    state = mode;
    await ref.read(storageServiceProvider).setThemeMode(_encode(mode));
  }

  static ThemeMode _decode(String? raw) => switch (raw) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        'system' => ThemeMode.system,
        _ => ThemeMode.dark, // first-launch default
      };

  static String _encode(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
}
