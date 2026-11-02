// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/models/token_usage.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/challenger_pro_hud.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/game_top_bar.dart';
import 'package:lol_coach/widgets/local_player_card.dart';
import 'package:lol_coach/widgets/macro_alert_strip.dart';
import 'package:lol_coach/widgets/recommendation_panel.dart';
import 'package:lol_coach/widgets/scoreboard.dart';
import 'package:lol_coach/widgets/tactical_comms_bar.dart';

class GameView extends StatelessWidget {
  const GameView({
    required this.gameState,
    required this.lastEvent,
    super.key,
    this.recommendation,
    this.tacticalInsights,
    this.triggerEvent,
    this.isAnalyzing = false,
    this.recommendationTime,
    this.tokenUsage,
    this.tokenBudget = 0,
    this.isBudgetExceeded = false,
    this.riskLevel,
    this.onRiskLevelChanged,
    this.buildFocus,
    this.onBuildFocusChanged,
    this.preferPassiveItems = false,
    this.onPreferPassiveChanged,
    this.proMode = false,
    this.onProModeChanged,
    this.onSendCoachCommand,
    this.onClearOverride,
    this.lastCoachExchange,
    this.voiceEnabled = false,
    this.onVoiceToggled,
    this.onRefresh,
    this.aiEnabled = true,
  });
  final ParsedGameState gameState;
  final ItemRecommendation? recommendation;
  final TacticalInsights? tacticalInsights;
  final String lastEvent;
  final String? triggerEvent;
  final bool isAnalyzing;
  final DateTime? recommendationTime;
  final TokenUsage? tokenUsage;
  final int tokenBudget;
  final bool isBudgetExceeded;
  final String? riskLevel;
  final ValueChanged<String>? onRiskLevelChanged;
  final String? buildFocus;
  final ValueChanged<String>? onBuildFocusChanged;
  final bool preferPassiveItems;
  final ValueChanged<bool>? onPreferPassiveChanged;
  final bool proMode;
  final ValueChanged<bool>? onProModeChanged;
  final ValueChanged<String>? onSendCoachCommand;
  final ValueChanged<String>? onClearOverride;
  final CoachExchange? lastCoachExchange;
  final bool voiceEnabled;
  final ValueChanged<bool>? onVoiceToggled;
  final VoidCallback? onRefresh;

  /// Whether an AI provider is active. In Basic rules mode the bridge never
  /// emits a RECOMMENDATION_UPDATE, so the hero slot must not show a loading
  /// spinner that would spin for the whole match.
  final bool aiEnabled;

  /// The enemy laner sharing the local player's position, surfaced as the
  /// "vs <champion>" matchup chip on the recommendation hero.
  String? get _laneOpponent {
    final ov = tacticalInsights?.liveOverrides?.laneOpponentOverride;
    if (ov != null && ov.isNotEmpty) return ov;
    final pos = gameState.localPlayer.position.toLowerCase();
    if (pos.isEmpty) return null;
    for (final e in gameState.enemies) {
      if (e.position.toLowerCase() == pos && e.championName.isNotEmpty) {
        return e.championName;
      }
    }
    return null;
  }

  Map<ShortcutActivator, VoidCallback> _buildHotkeys() {
    final opp = _laneOpponent ??
        tacticalInsights?.enemyCooldowns?.championName ??
        (gameState.enemies.isNotEmpty
            ? gameState.enemies.first.championName
            : 'Enemy');
    final enemies = gameState.enemies;
    String? swapTarget;
    if (enemies.length >= 2) {
      final idx = enemies.indexWhere((e) => e.championName == opp);
      swapTarget = enemies[(idx + 1) % enemies.length].championName;
    }

    return <ShortcutActivator, VoidCallback>{
      if (onSendCoachCommand != null) ...{
        const SingleActivator(LogicalKeyboardKey.f1): () =>
            onSendCoachCommand!('$opp Flash'),
        const SingleActivator(LogicalKeyboardKey.f2): () =>
            onSendCoachCommand!('$opp R'),
        const SingleActivator(LogicalKeyboardKey.f3): () =>
            onSendCoachCommand!('Ich werde gecampt'),
        if (swapTarget != null)
          const SingleActivator(LogicalKeyboardKey.f4): () =>
              onSendCoachCommand!('Swap $swapTarget'),
      },
      if (onProModeChanged != null)
        const SingleActivator(LogicalKeyboardKey.f5): () =>
            onProModeChanged!(!proMode),
    };
  }

  Widget _buildHeroSection() {
    if (recommendation != null) {
      return RecommendationPanel(
        recommendation: recommendation!,
        tacticalInsights: tacticalInsights,
        triggerEvent: triggerEvent,
        localChampion: gameState.localPlayer.championName,
        opponentChampion: _laneOpponent,
        isAnalyzing: isAnalyzing,
        recommendationTime: recommendationTime,
        tokenUsage: tokenUsage,
        tokenBudget: tokenBudget,
        isBudgetExceeded: isBudgetExceeded,
      );
    }
    if (aiEnabled) return const _AwaitingAdvice();
    return const _BasicModeNotice();
  }

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: _buildHotkeys(),
      child: Focus(
        autofocus: true,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 780;

            return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GameTopBar(
                gameState: gameState,
                riskLevel: riskLevel,
                onRiskLevelChanged: onRiskLevelChanged,
                proMode: proMode,
                onProModeChanged: onProModeChanged,
                onRefresh: onRefresh,
                isAnalyzing: isAnalyzing,
              ),
              if (tacticalInsights != null) ...[
                const SizedBox(height: 10),
                MacroAlertStrip(insights: tacticalInsights!),
              ],
              if (onSendCoachCommand != null) ...[
                const SizedBox(height: 10),
                TacticalCommsBar(
                  gameState: gameState,
                  tacticalInsights: tacticalInsights,
                  lastExchange: lastCoachExchange,
                  onSendCommand: onSendCoachCommand!,
                  onClearOverride: onClearOverride,
                  voiceEnabled: voiceEnabled,
                  onVoiceToggled: onVoiceToggled,
                ),
              ],
              const SizedBox(height: 14),
              if (proMode)
                ChallengerProHud(
                  gameState: gameState,
                  recommendation: recommendation,
                  tacticalInsights: tacticalInsights,
                  opponentChampion: _laneOpponent,
                  buildFocus: buildFocus ?? 'auto',
                  onBuildFocusChanged: onBuildFocusChanged,
                  preferPassiveItems: preferPassiveItems,
                  onPreferPassiveChanged: onPreferPassiveChanged,
                )
              else if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 11,
                      child: _buildHeroSection(),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      flex: 9,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LocalPlayerCard(
                            player: gameState.localPlayer,
                            activePlayer: gameState.activePlayer,
                            tacticalInsights: tacticalInsights,
                            buildFocus: buildFocus,
                            onBuildFocusChanged: onBuildFocusChanged,
                            preferPassiveItems: preferPassiveItems,
                            onPreferPassiveChanged: onPreferPassiveChanged,
                          ),
                          const SizedBox(height: 14),
                          ScoreboardSection(
                            allies: gameState.allies,
                            enemies: gameState.enemies,
                            localPlayer: gameState.localPlayer,
                            initiallyExpanded: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                )
              else ...[
                _buildHeroSection(),
                const SizedBox(height: 12),
                LocalPlayerCard(
                  player: gameState.localPlayer,
                  activePlayer: gameState.activePlayer,
                  tacticalInsights: tacticalInsights,
                  buildFocus: buildFocus,
                  onBuildFocusChanged: onBuildFocusChanged,
                  preferPassiveItems: preferPassiveItems,
                  onPreferPassiveChanged: onPreferPassiveChanged,
                ),
                const SizedBox(height: 12),
                ScoreboardSection(
                  allies: gameState.allies,
                  enemies: gameState.enemies,
                  localPlayer: gameState.localPlayer,
                ),
              ],
            ],
          ),
        );
          },
        ),
      ),
    );
  }
}

/// Placeholder hero shown before the first recommendation lands, so the most
/// important slot never sits empty.
class _AwaitingAdvice extends StatelessWidget {
  const _AwaitingAdvice();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      accent: colors.magicLine,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.magic,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'ANALYSING MATCH STATE',
                style: AppTextStyles.eyebrow.copyWith(color: colors.magic),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Reading the match — first advice lands shortly.',
            style: AppTextStyles.body.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Hero slot for Basic rules mode, where no AI provider is configured and the
/// bridge never produces a recommendation. A static, non-loading state — not a
/// spinner — so the slot reads as "nothing pending" rather than "still loading".
class _BasicModeNotice extends StatelessWidget {
  const _BasicModeNotice();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      child: Row(
        children: [
          Icon(
            Icons.insights_outlined,
            size: 18,
            color: colors.textSecondary,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              'Basic rules mode — live game stats only. '
              'Add an AI provider in Settings for item advice.',
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
