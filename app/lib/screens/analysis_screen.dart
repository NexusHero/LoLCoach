import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_board.dart';
import 'package:lol_coach/widgets/common/app_background.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:material_ui/material_ui.dart';

/// Post-game review ("Analyse") screen, pushed from the HomeScreen app bar.
class AnalysisScreen extends ConsumerWidget {
  const AnalysisScreen({this.onOpenSettings, super.key});

  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(analysisServiceProvider);
    return ListenableBuilder(
      listenable: service,
      builder: (context, _) {
        final snapshot = service.snapshot;
        final Widget body;
        if (snapshot == null) {
          body = _WaitingView(
            connected: service.isConnected,
            onOpenSettings: onOpenSettings,
            onRetry: service.isConnected ? service.requestAnalysis : null,
          );
        } else {
          body = AnalysisBoard(
            snapshot: snapshot,
            questions: service.questions,
            refreshing: service.isRefreshing,
            connected: service.isConnected,
            onRefresh: service.refresh,
            onAsk: service.ask,
            onOpenSettings: onOpenSettings,
          );
        }
        return Scaffold(
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            title: const Text('Analysis', style: AppTextStyles.heading),
            backgroundColor: Colors.transparent,
            elevation: 0,
          ),
          body: AppBackground(child: SafeArea(child: body)),
        );
      },
    );
  }
}

class _WaitingView extends StatelessWidget {
  const _WaitingView({
    required this.connected,
    this.onOpenSettings,
    this.onRetry,
  });

  final bool connected;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GameCard(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (connected)
                  CircularProgressIndicator(color: colors.magic)
                else
                  Icon(
                    Icons.link_off_rounded,
                    size: 26,
                    color: colors.textDisabled,
                  ),
                const SizedBox(height: 16),
                Text(
                  connected ? 'Loading your analysis…' : 'Not connected',
                  style: AppTextStyles.heading,
                ),
                const SizedBox(height: 6),
                Text(
                  connected
                      ? 'Waiting for the core to send your match history.'
                      : 'Connect to the LoL Coach core to see your '
                          'post-game review.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.body.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                if (connected && onRetry != null)
                  OutlinedButton(onPressed: onRetry, child: const Text('Retry'))
                else if (!connected && onOpenSettings != null)
                  ElevatedButton.icon(
                    onPressed: onOpenSettings,
                    icon: const Icon(Icons.settings_outlined, size: 16),
                    label: const Text('Open Settings'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
