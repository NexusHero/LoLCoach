import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/controllers/theme_controller.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/screens/main_screen.dart';
import 'package:lol_coach/services/storage_service.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/utils/ddragon.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final storageService = StorageService();
  await storageService.init();

  // DDragon-Version im Hintergrund holen; Fallback greift falls kein Netz
  unawaited(initDDragonVersion());

  // Auto-start core on Desktop platforms if it exists
  if (!kIsWeb && (Platform.isWindows || Platform.isMacOS || Platform.isLinux)) {
    final exeDir = File(Platform.resolvedExecutable).parent.path;
    final coreName = Platform.isWindows ? 'core.exe' : 'core';
    final corePath = '$exeDir${Platform.pathSeparator}$coreName';

    if (File(corePath).existsSync()) {
      try {
        await Process.start(corePath, ['--parent-pid=$pid']);
      } catch (e) {
        debugPrint('Failed to start core: $e');
      }
    }
  }

  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
      ],
      child: const LolCoachApp(),
    ),
  );
}

class LolCoachApp extends ConsumerWidget {
  const LolCoachApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ref.watch on a generated Notifier provider rebuilds this widget
    // directly on state change — no ListenableBuilder needed.
    final themeMode = ref.watch(themeControllerProvider);
    return MaterialApp(
      title: 'LoL Coach',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      home: const MainScreen(),
    );
  }
}
