// ignore_for_file: lines_longer_than_80_chars
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/build_focus_selector.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/common/item_slot.dart';
import 'package:lol_coach/widgets/recommendation/recommendation_item_rows.dart'
    show buildPlanInnerSurface;
import 'package:material_ui/material_ui.dart';

/// Reduced glance HUD. Shows only what the app can state as fact and what
/// Riot's third-party policy permits live:
/// 1. Build plan + next component with gold math
/// 2. Icon build strip + BuildFocus quick-switch
/// 3. CS/m tempo against the role benchmark
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

  String get _buildPlan {
    final summary = recommendation?.strategy?.summary.trim();
    if (summary != null && summary.isNotEmpty) return summary;
    return recommendation?.reasoning ?? 'Waiting for the first build plan.';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final nextBuy = tacticalInsights?.nextBestBuy;
    final items = recommendation?.items ?? const [];

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
                    'BUILD PLAN',
                    style: AppTextStyles.eyebrow.copyWith(color: colors.magic),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _buildPlan,
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
                        for (final item in items) _ProItemTile(item: item),
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
        color: buildPlanInnerSurface(colors),
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
                  'NEXT BUY: ${buy.itemName.toUpperCase()} (${buy.price}g)',
                  style: AppTextStyles.bodyBold.copyWith(color: colors.gold),
                ),
                if (buy.breakpointHint != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    buy.breakpointHint!,
                    style: AppTextStyles.mono.copyWith(
                      color: colors.textSecondary,
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
        color: buildPlanInnerSurface(colors),
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
                  onPace ? 'On target pace' : 'Below target pace',
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
