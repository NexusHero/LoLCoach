import 'package:flutter/material.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/badge.dart';
import 'package:lol_coach/widgets/common/item_slot.dart';

/// The headline item, rendered in a tinted rounded row with a subtle glow.
class HeroRecommendationItem extends StatelessWidget {
  const HeroRecommendationItem({
    required this.item,
    required this.accent,
    required this.isLlm,
    super.key,
  });

  final RecommendedItem item;
  final Color accent;
  final bool isLlm;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isLlm
              ? [
                  colors.magicSubtle,
                  colors.magicSubtle.withValues(alpha: 0.04),
                ]
              : [colors.surface2, colors.surface2],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isLlm ? colors.magicLine : colors.border,
        ),
      ),
      child: Row(
        children: [
          ItemSlot(
            itemId: item.id,
            displayName: item.name,
            size: 52,
            borderColor: isLlm ? colors.magicLine : colors.border,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: AppTextStyles.heading),
                const SizedBox(height: 3),
                Text(
                  item.reason,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (isLlm)
            AppBadge.violet(item.isCore ? 'Core' : 'Buy')
          else
            AppBadge.neutral(item.isCore ? 'Core' : 'Buy'),
        ],
      ),
    );
  }
}

/// A compact secondary (situational) pick connected as a build timeline node.
class SecondaryRecommendationItem extends StatelessWidget {
  const SecondaryRecommendationItem({
    required this.item,
    required this.stepIndex,
    required this.isLast,
    required this.accentColor,
    super.key,
  });

  final RecommendedItem item;
  final int stepIndex;
  final bool isLast;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colors.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.hairlineSoft),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withValues(alpha: 0.14),
                border: Border.all(color: accentColor.withValues(alpha: 0.35)),
              ),
              child: Text(
                '$stepIndex',
                style: AppTextStyles.micro.copyWith(
                  color: accentColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            ItemSlot(itemId: item.id, displayName: item.name, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.name, style: AppTextStyles.bodyBold),
                  Text(
                    item.reason,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            AppBadge.neutral(item.isCore ? 'Core' : 'Situational'),
          ],
        ),
      ),
    );
  }
}

/// Smart Single-Best-Buy + Breakpoint-Hint component calculator strip.
class NextBestBuyBanner extends StatelessWidget {
  const NextBestBuyBanner({required this.buy, super.key});

  final NextBestBuy buy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: colors.goldSubtle,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.champagneLine),
      ),
      child: Row(
        children: [
          ItemSlot(
            itemId: buy.itemId,
            displayName: buy.itemName,
            size: 30,
            borderColor: colors.champagneLine,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BUY NOW: ${buy.itemName.toUpperCase()} (${buy.price}g)',
                  style: AppTextStyles.micro.copyWith(
                    color: colors.gold,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
                if (buy.breakpointHint != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    buy.breakpointHint!,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textSecondary,
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

/// Key-Threat-Diff + Compact Q/W/E/R Cooldown Bar for the lane opponent.
class EnemyCooldownsStrip extends StatelessWidget {
  const EnemyCooldownsStrip({required this.cooldowns, super.key});

  final EnemyCooldowns cooldowns;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.hairlineSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_outlined, size: 14, color: colors.cyan),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  cooldowns.keyThreatSummary,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${cooldowns.championName} CDs · '
            'Q: ${cooldowns.q}s · W: ${cooldowns.w}s · '
            'E: ${cooldowns.e}s · R: ${cooldowns.r}s',
            style: AppTextStyles.mono.copyWith(
              color: colors.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
