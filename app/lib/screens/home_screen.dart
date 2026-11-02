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
import 'package:lol_coach/widgets/standby_dashboard.dart';

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
        if (!ws.gameActive || ws.gameState == null) {
          return StandbyDashboard(
            autopsy: ws.postGameAutopsy ?? ws.playerProfile?.lastAutopsy,
            profile: ws.playerProfile,
          );
        }
        return GameView(
          gameState: ws.gameState!,
          recommendation: ws.recommendation,
          tacticalInsights: ws.tacticalInsights,
          lastEvent: ws.lastEvent,
          triggerEvent: ws.triggerEvent,
          isAnalyzing: ws.isAnalyzing,
          recommendationTime: ws.recommendationTime,
          tokenUsage: ws.lastTokenUsage,
          isBudgetExceeded: ws.isBudgetExceeded,
          riskLevel: _isAiProvider(ws.activeProviderType) ? ws.riskLevel : null,
          onRiskLevelChanged:
              _isAiProvider(ws.activeProviderType) ? ws.setRiskLevel : null,
          buildFocus: ws.buildFocus,
          onBuildFocusChanged: ws.setBuildFocus,
          preferPassiveItems: ws.preferPassiveItems,
          onPreferPassiveChanged: (v) => ws.setPreferPassiveItems(prefer: v),
          proMode: ws.proMode,
          onProModeChanged: (v) => ws.setProMode(enabled: v),
          onSendCoachCommand: ws.sendCoachCommand,
          onClearOverride: ws.clearTacticalOverride,
          lastCoachExchange: ws.lastCoachExchange,
          voiceEnabled: ws.voiceEnabled,
          onVoiceToggled: (v) => ws.setVoiceEnabled(enabled: v),
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
