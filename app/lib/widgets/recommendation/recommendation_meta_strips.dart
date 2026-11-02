import 'package:flutter/material.dart';
import 'package:lol_coach/models/strategy.dart';
import 'package:lol_coach/models/token_usage.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';

/// Visual matchup duel pill with champion mini-avatars when available.
class MatchupDuelChip extends StatelessWidget {
  const MatchupDuelChip({
    required this.opponentChampion,
    super.key,
    this.localChampion,
  });

  final String? localChampion;
  final String opponentChampion;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasLocal = localChampion != null && localChampion!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasLocal) ...[
            ChampAvatar(name: localChampion!, isDead: false, size: 16),
            const SizedBox(width: 5),
          ],
          ChampAvatar(name: opponentChampion, isDead: false, size: 16),
          const SizedBox(width: 6),
          Text(
            'vs $opponentChampion',
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

/// The labelled supporting lines (Matchup / Counter).
class StrategyLinesBlock extends StatelessWidget {
  const StrategyLinesBlock({required this.strategy, super.key});

  final Strategy strategy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final lines = <(String, String, IconData)>[
      if (strategy.laneMatchupAnalysis != null)
        (
          'Matchup',
          strategy.laneMatchupAnalysis!,
          Icons.compare_arrows_rounded,
        ),
      if (strategy.counterPlay != null)
        ('Counter', strategy.counterPlay!, Icons.shield_outlined),
    ];
    return Column(
      children: [
        for (var i = 0; i < lines.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: colors.hairlineSoft),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(lines[i].$3, size: 14, color: colors.textDisabled),
                const SizedBox(width: 6),
                SizedBox(
                  width: 64,
                  child: Text(
                    lines[i].$1.toUpperCase(),
                    style: AppTextStyles.eyebrow.copyWith(
                      color: colors.textDisabled,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    lines[i].$2,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Footer strip: session token usage on the left, freshness on the right.
class RecommendationFooter extends StatelessWidget {
  const RecommendationFooter({
    required this.timeAgo,
    super.key,
    this.usage,
    this.budget = 0,
    this.exceeded = false,
  });

  final String timeAgo;
  final TokenUsage? usage;
  final int budget;
  final bool exceeded;

  String _fmt(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final String? left;
    if (exceeded) {
      left = 'Token budget exhausted';
    } else if (usage != null) {
      left = '${_fmt(usage!.sessionInput)} in · ${_fmt(usage!.sessionOutput)}'
          ' out';
    } else {
      left = null;
    }
    if (left == null && timeAgo.isEmpty) return const SizedBox.shrink();

    final color = exceeded ? colors.error : colors.textDisabled;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.only(top: 14),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.hairlineSoft)),
      ),
      child: Row(
        children: [
          if (left != null)
            Text(left, style: AppTextStyles.micro.copyWith(color: color)),
          const Spacer(),
          if (timeAgo.isNotEmpty)
            Text(
              timeAgo,
              style: AppTextStyles.micro.copyWith(color: colors.textDisabled),
            ),
        ],
      ),
    );
  }
}
