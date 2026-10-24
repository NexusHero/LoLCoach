// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/token_usage.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/game_top_bar.dart';
import 'package:lol_coach/widgets/local_player_card.dart';
import 'package:lol_coach/widgets/recommendation_panel.dart';
import 'package:lol_coach/widgets/scoreboard.dart';

class GameView extends StatelessWidget {
  const GameView({
    required this.gameState,
    required this.lastEvent,
    super.key,
    this.recommendation,
    this.triggerEvent,
    this.isAnalyzing = false,
    this.recommendationTime,
    this.tokenUsage,
    this.tokenBudget = 0,
    this.isBudgetExceeded = false,
    this.riskLevel,
    this.onRiskLevelChanged,
    this.onRefresh,
    this.aiEnabled = true,
  });
  final ParsedGameState gameState;
  final ItemRecommendation? recommendation;
  final String lastEvent;
  final String? triggerEvent;
  final bool isAnalyzing;
  final DateTime? recommendationTime;
  final TokenUsage? tokenUsage;
  final int tokenBudget;
  final bool isBudgetExceeded;
  final String? riskLevel;
  final ValueChanged<String>? onRiskLevelChanged;
  final VoidCallback? onRefresh;

  /// Whether an AI provider is active. In Basic rules mode the bridge never
  /// emits a RECOMMENDATION_UPDATE, so the hero slot must not show a loading
  /// spinner that would spin for the whole match.
  final bool aiEnabled;

  /// The enemy laner sharing the local player's position, surfaced as the
  /// "vs <champion>" matchup chip on the recommendation hero.
  String? get _laneOpponent {
    final pos = gameState.localPlayer.position.toLowerCase();
    if (pos.isEmpty) return null;
    for (final e in gameState.enemies) {
      if (e.position.toLowerCase() == pos && e.championName.isNotEmpty) {
        return e.championName;
      }
    }
    return null;
  }

  Widget _buildHeroSection() {
    if (recommendation != null) {
      return RecommendationPanel(
        recommendation: recommendation!,
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
    return LayoutBuilder(
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
                onRefresh: onRefresh,
                isAnalyzing: isAnalyzing,
              ),
              const SizedBox(height: 14),
              if (isWide)
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
