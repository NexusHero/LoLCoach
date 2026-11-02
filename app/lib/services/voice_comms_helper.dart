import 'dart:async';
import 'dart:io';

String? loadCoreSecret() {
  final home =
      Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'];
  if (home == null) return null;
  final file = File('$home/.lolcoach/.secret');
  if (!file.existsSync()) return null;
  return file.readAsStringSync().trim();
}

/// Speaks a short F1-Race-Engineer tactical callout via native OS TTS
/// (macOS `say` / Windows SAPI) without external native plugin dependencies.
void speakTacticalBriefing(String text, {required bool enabled}) {
  if (!enabled || text.trim().isEmpty) return;
  if (Platform.environment.containsKey('FLUTTER_TEST')) return;

  final sanitized = text.replaceAll(RegExp('["\'`\\\\]'), '').trim();
  if (sanitized.isEmpty) return;

  unawaited(
    Future<void>(() async {
      try {
        if (Platform.isMacOS) {
          await Process.run('say', ['-r', '215', sanitized]);
        } else if (Platform.isWindows) {
          const psPrefix = 'Add-Type -AssemblyName System.Speech; ';
          const psSynth =
              '(New-Object System.Speech.Synthesis.SpeechSynthesizer)';
          await Process.run('powershell', [
            '-NoProfile',
            '-Command',
            '$psPrefix$psSynth.Speak("$sanitized");',
          ]);
        }
      } catch (_) {
        // Ignore TTS process errors in headless environments
      }
    }),
  );
}
