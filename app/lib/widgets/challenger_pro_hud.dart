// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/build_focus_selector.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/common/item_slot.dart';

/// Ultra-focused 0.2s-glance Challenger / High-Elo HUD mode.
/// Strips away all redundant native LoL HUD data (own HP/AD/MR, own inventory,
/// 10-player Tab scoreboard) and surfaces only the 4 invisible high-elo edges:
/// 1. Immediate Play + Component Breakpoint Math
/// 2. Pure Icon Build Strip + BuildFocus Quick-Switch
/// 3. Opponent Q/W/E/R Cooldown Boxes + Vulnerability Window
/// 4. CS/m Tempo Gauge vs Role Benchmark
class ChallengerProHud extends StatelessWidget {
  const ChallengerProHud({
    required this.gameState,
    super.key,
    this.recommendation,
    this.tacticalInsights,
    this.opponentChampion,
    this.buildFocus = 'auto',
    this.onBuildFocusChanged,
    this.preferPassiveItems = false,
    this.onPreferPassiveChanged,
  });

  final ParsedGameState gameState;
  final ItemRecommendation? recommendation;
  final TacticalInsights? tacticalInsights;
  final String? opponentChampion;
  final String buildFocus;
  final ValueChanged<String>? onBuildFocusChanged;
  final bool preferPassiveItems;
  final ValueChanged<bool>? onPreferPassiveChanged;

  String get _immediateAction {
    final s = recommendation?.strategy;
    final a = s?.immediateAction.trim();
    if (a != null && a.isNotEmpty) return a;
    final sum = s?.summary.trim();
    if (sum != null && sum.isNotEmpty) return sum;
    return recommendation?.reasoning ?? 'Play on wave tempo & track jungler.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final nextBuy = tacticalInsights?.nextBestBuy;
    final cds = tacticalInsights?.enemyCooldowns;
    final items = recommendation?.items ?? const [];
    final counterPlay = recommendation?.strategy?.counterPlay;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 720;
        final leftCol = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GameCard(
              accent: colors.magic,
              glow: true,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'IMMEDIATE PLAY',
                    style: AppTextStyles.eyebrow.copyWith(color: colors.magic),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _immediateAction,
                    style: AppTextStyles.hero.copyWith(fontSize: 22),
                  ),
                  if (nextBuy != null) ...[
                    const SizedBox(height: 16),
                    _ProNextBuyBox(buy: nextBuy),
                  ],
                  if (items.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'TARGET SPIKES',
                      style: AppTextStyles.eyebrow.copyWith(
                        color: colors.textDisabled,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 12,
                      runSpacing: 10,
                      children: [
                        for (final item in items)
                          _ProItemTile(item: item),
                      ],
                    ),
                  ],
                  if (onBuildFocusChanged != null) ...[
                    const SizedBox(height: 16),
                    BuildFocusSelector(
                      selectedFocus: buildFocus,
                      onFocusChanged: onBuildFocusChanged!,
                      preferPassive: preferPassiveItems,
                      onPreferPassiveChanged: onPreferPassiveChanged,
                    ),
                  ],
                ],
              ),
            ),
          ],
        );

        final rightCol = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (cds != null)
              _ProCooldownCard(
                cooldowns: cds,
                counterPlay: counterPlay,
              ),
            if (cds != null) const SizedBox(height: 14),
            if (tacticalInsights != null)
              _ProTempoCard(insights: tacticalInsights!),
          ],
        );

        if (isWide) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 6, child: leftCol),
              const SizedBox(width: 14),
              Expanded(flex: 5, child: rightCol),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            leftCol,
            const SizedBox(height: 12),
            rightCol,
          ],
        );
      },
    );
  }
}

class _ProNextBuyBox extends StatelessWidget {
  const _ProNextBuyBox({required this.buy});
  final NextBestBuy buy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.goldSubtle,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.champagneLine, width: 1.5),
      ),
      child: Row(
        children: [
          ItemSlot(
            itemId: buy.itemId,
            displayName: buy.itemName,
            size: 44,
            borderColor: colors.champagneLine,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BUY NOW: ${buy.itemName.toUpperCase()} (${buy.price}g)',
                  style: AppTextStyles.bodyBold.copyWith(color: colors.gold),
                ),
                if (buy.breakpointHint != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    buy.breakpointHint!,
                    style: AppTextStyles.mono.copyWith(
                      color: colors.textPrimary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProItemTile extends StatelessWidget {
  const _ProItemTile({required this.item});
  final RecommendedItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: item.isCore ? colors.magicLine : colors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ItemSlot(itemId: item.id, displayName: item.name, size: 38),
          const SizedBox(width: 10),
          Text(item.name, style: AppTextStyles.bodyBold),
        ],
      ),
    );
  }
}

class _ProCooldownCard extends StatelessWidget {
  const _ProCooldownCard({
    required this.cooldowns,
    this.counterPlay,
  });

  final EnemyCooldowns cooldowns;
  final String? counterPlay;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final spells = <(String, int)>[
      ('Q', cooldowns.q),
      ('W', cooldowns.w),
      ('E', cooldowns.e),
      ('R', cooldowns.r),
    ];

    return GameCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ChampAvatar(
                name: cooldowns.championName,
                isDead: false,
                size: 28,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${cooldowns.championName.toUpperCase()} COOLDOWNS '
                  '(LV ${cooldowns.level} · ${cooldowns.abilityHaste} AH)',
                  style: AppTextStyles.eyebrow.copyWith(color: colors.cyan),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var i = 0; i < spells.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.surface2,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        Text(
                          spells[i].$1,
                          style: AppTextStyles.micro.copyWith(
                            color: colors.textDisabled,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${spells[i].$2}s',
                          style: AppTextStyles.mono.copyWith(
                            color: colors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colors.surface2,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: colors.cyan.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                Icon(Icons.bolt_rounded, size: 16, color: colors.cyan),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    cooldowns.keyThreatSummary,
                    style: AppTextStyles.bodyBold.copyWith(color: colors.cyan),
                  ),
                ),
              ],
            ),
          ),
          if (counterPlay != null && counterPlay!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'COUNTER: $counterPlay',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProTempoCard extends StatelessWidget {
  const _ProTempoCard({required this.insights});
  final TacticalInsights insights;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final onPace = insights.csPerMin >= insights.targetCsPerMin - 0.5;
    final accent = onPace ? colors.success : colors.gold;

    return GameCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(Icons.speed_rounded, size: 20, color: accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CS TEMPO BENCHMARK',
                  style: AppTextStyles.eyebrow.copyWith(
                    color: colors.textDisabled,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  onPace
                      ? 'On Challenger pace — keep catching side waves before grouping'
                      : 'Below target pace — prioritize side wave crash before fights',
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${insights.csPerMin} / ${insights.targetCsPerMin}',
            style: AppTextStyles.mono.copyWith(
              color: accent,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
