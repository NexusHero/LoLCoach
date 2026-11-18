// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/screens/analysis_screen.dart';
import 'package:lol_coach/screens/home_screen.dart';
import 'package:lol_coach/screens/settings_screen.dart';
import 'package:lol_coach/services/ws_client.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  @override
  void initState() {
    super.initState();
    _maybeOpenSettingsOnFirstRun();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(coachServiceProvider).addListener(_onWsChanged);
    });
  }

  @override
  void dispose() {
    ref.read(coachServiceProvider).removeListener(_onWsChanged);
    super.dispose();
  }

  Future<void> _maybeOpenSettingsOnFirstRun() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted && prefs.getString('host') == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openSettings());
    }
  }

  void _onWsChanged() {
    if (!mounted) return;
    final ws = ref.read(coachServiceProvider);

    if (ws.status == ConnectionStatus.error && ws.lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Connection Error: ${ws.lastError}'),
          backgroundColor: context.colors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }

    if (ws.lastLlmError != null) {
      final errorMsg = ws.lastLlmError!;
      ws.clearLlmError();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('AI error: $errorMsg')),
            ],
          ),
          backgroundColor: context.colors.warning,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 6),
        ),
      );
    }
  }

  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SettingsScreen(
          onConnected: () => Navigator.of(context).pop(),
        ),
      ),
    );
  }

  void _openAnalysis() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AnalysisScreen(onOpenSettings: _openSettings),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return HomeScreen(
      onOpenSettings: _openSettings,
      onOpenAnalysis: _openAnalysis,
    );
  }
}
