// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/services/coach_service.dart';
import 'package:lol_coach/services/ws_client.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/app_background.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/game_view.dart';

String _providerLabel(String type) => switch (type) {
      'claude' => 'Claude',
      'openai' => 'GPT-4o',
      'gemini' => 'Gemini',
      _ => 'Basic',
    };

bool _isAiProvider(String type) => type != 'none' && type.isNotEmpty;

class HomeScreen extends ConsumerWidget {
  const HomeScreen({this.onOpenSettings, super.key});

  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ws = ref.watch(coachServiceProvider);
    return ListenableBuilder(
      listenable: ws,
      builder: (context, _) {
        final activeChamp = ws.gameActive && ws.gameState != null
            ? ws.gameState!.localPlayer.championName
            : null;

        return Scaffold(
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            titleSpacing: 20,
            title: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.shield_outlined,
                  size: 18,
                  color: context.colors.magic,
                ),
                const SizedBox(width: 8),
                const Text('LoL Coach', style: AppTextStyles.heading),
              ],
            ),
            actions: [
              if (ws.isConnected)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: _LivePill(
                    providerType: ws.activeProviderType,
                    llmFailed: ws.llmFailed,
                  ),
                ),
              if (ws.status != ConnectionStatus.disconnected)
                IconButton(
                  icon: const Icon(Icons.link_off),
                  tooltip: 'Disconnect',
                  onPressed: ws.disconnect,
                ),
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                tooltip: 'Settings',
                onPressed: onOpenSettings,
              ),
              const SizedBox(width: 4),
            ],
          ),
          body: AppBackground(
            championName: activeChamp,
            child: SafeArea(child: _buildBody(context, ws)),
          ),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, CoachService ws) {
    switch (ws.status) {
      case ConnectionStatus.disconnected:
      case ConnectionStatus.error:
        return _buildNotConnectedView(context);
      case ConnectionStatus.connecting:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: context.colors.magic),
              const SizedBox(height: 16),
              Text(
                'Connecting to core…',
                style: AppTextStyles.caption.copyWith(
                  color: context.colors.textSecondary,
                ),
              ),
            ],
          ),
        );
      case ConnectionStatus.connected:
        if (!ws.gameActive || ws.gameState == null) return const _WaitingView();
        return GameView(
          gameState: ws.gameState!,
          recommendation: ws.recommendation,
          lastEvent: ws.lastEvent,
          triggerEvent: ws.triggerEvent,
          isAnalyzing: ws.isAnalyzing,
          recommendationTime: ws.recommendationTime,
          tokenUsage: ws.lastTokenUsage,
          isBudgetExceeded: ws.isBudgetExceeded,
          riskLevel: _isAiProvider(ws.activeProviderType) ? ws.riskLevel : null,
          onRiskLevelChanged:
              _isAiProvider(ws.activeProviderType) ? ws.setRiskLevel : null,
          onRefresh: ws.triggerAnalysis,
          aiEnabled: _isAiProvider(ws.activeProviderType),
        );
    }
  }

  Widget _buildNotConnectedView(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: GameCard(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.surface2,
                    border: Border.all(color: colors.border),
                  ),
                  child: Icon(
                    Icons.link_off_rounded,
                    size: 26,
                    color: colors.textDisabled,
                  ),
                ),
                const SizedBox(height: 18),
                const Text('Not connected', style: AppTextStyles.title),
                const SizedBox(height: 8),
                Text(
                  'Open Settings to connect to the local LoL Coach core.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.body.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                if (onOpenSettings != null) ...[
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: onOpenSettings,
                    icon: const Icon(Icons.settings_outlined, size: 16),
                    label: const Text('Open Settings'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Live pill ───────────────────────────────────────────────────────────────

/// Compact header pill mirroring the design's "<Provider> · live" indicator,
/// with a breathing violet dot while the AI is coaching.
class _LivePill extends StatefulWidget {
  const _LivePill({required this.providerType, required this.llmFailed});
  final String providerType;
  final bool llmFailed;

  @override
  State<_LivePill> createState() => _LivePillState();
}

class _LivePillState extends State<_LivePill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.4, end: 1).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isAi = _isAiProvider(widget.providerType);
    final failed = isAi && widget.llmFailed;
    final label = _providerLabel(widget.providerType);
    final Color color;
    final String text;
    if (failed) {
      color = colors.warning;
      text = '$label unavailable';
    } else if (isAi) {
      color = colors.magic;
      text = '$label · live';
    } else {
      color = colors.textSecondary;
      text = 'Basic rules';
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(9, 5, 11, 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (failed)
            Icon(Icons.warning_amber_rounded, size: 13, color: color)
          else
            AnimatedBuilder(
              animation: _pulse,
              builder: (_, __) => Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withValues(alpha: isAi ? _pulse.value : 0.5),
                  boxShadow: isAi
                      ? [
                          BoxShadow(
                            color: colors.magic.withValues(
                              alpha: _pulse.value * 0.8,
                            ),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
              ),
            ),
          const SizedBox(width: 7),
          Text(
            text,
            style: AppTextStyles.micro.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Waiting view ────────────────────────────────────────────────────────────

class _WaitingView extends StatefulWidget {
  const _WaitingView();

  @override
  State<_WaitingView> createState() => _WaitingViewState();
}

class _WaitingViewState extends State<_WaitingView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: GameCard(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AnimatedBuilder(
                      animation: _pulseCtrl,
                      builder: (_, child) => Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.magicSubtle,
                          border: Border.all(
                            color: colors.magic.withValues(
                              alpha: 0.3 + _pulseCtrl.value * 0.4,
                            ),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: colors.magic.withValues(
                                alpha: _pulseCtrl.value * 0.25,
                              ),
                              blurRadius: 16,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: child,
                      ),
                      child: Icon(
                        Icons.radar_rounded,
                        size: 22,
                        color: colors.magic,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'STANDBY',
                            style: AppTextStyles.eyebrow.copyWith(
                              color: colors.magic,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Ready to coach',
                            style: AppTextStyles.title,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const _StepRow(
                  done: true,
                  text: 'Core connected',
                ),
                const SizedBox(height: 14),
                const _StepRow(
                  done: false,
                  text: 'Start a League of Legends match',
                ),
                const SizedBox(height: 14),
                const _StepRow(
                  done: false,
                  text: 'Advice appears automatically as the match unfolds',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.done, required this.text});
  final bool done;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = done ? colors.success : colors.textDisabled;
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? colors.successSubtle : Colors.transparent,
            border: Border.all(color: color, width: 1.5),
          ),
          child: done ? Icon(Icons.check, size: 12, color: color) : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: AppTextStyles.body.copyWith(
              color: done ? colors.textPrimary : colors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
