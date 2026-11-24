import 'dart:math' as math;

import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:material_ui/material_ui.dart';

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// "Nov 18" style short date from epoch milliseconds.
String formatShortDate(int epochMs) {
  if (epochMs <= 0) return '—';
  final d = DateTime.fromMillisecondsSinceEpoch(epochMs);
  return '${_months[d.month - 1]} ${d.day}';
}

/// Signed integer formatting: +12 / -3 / 0.
String signed(num v) {
  final r = v.round();
  return r > 0 ? '+$r' : '$r';
}

/// Uppercase eyebrow label in the HUD style.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {this.color, super.key});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: AppTextStyles.eyebrow.copyWith(
          color: color ?? context.colors.textDisabled,
        ),
      );
}

/// Glass bento card with an eyebrow title and optional trailing widget.
class BentoCard extends StatelessWidget {
  const BentoCard({
    required this.title,
    required this.child,
    this.trailing,
    this.accent,
    this.titleColor,
    super.key,
  });

  final String title;
  final Widget child;
  final Widget? trailing;
  final Color? accent;
  final Color? titleColor;

  @override
  Widget build(BuildContext context) {
    return GameCard(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Eyebrow(title, color: titleColor)),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// Small selectable pill used as a segmented chip.
class HudChip extends StatelessWidget {
  const HudChip({
    required this.label,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? colors.magicSubtle : colors.surface2,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
            color: selected ? colors.magicLine : colors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.micro.copyWith(
            color: selected ? colors.magic : colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// Inline status pill: coloured dot + label.
class StatusChip extends StatelessWidget {
  const StatusChip({required this.label, required this.color, super.key});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.micro.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Draws a dashed horizontal line.
void drawDashedLine(
  Canvas canvas,
  Offset start,
  Offset end,
  Paint paint, {
  double dash = 5,
  double gap = 4,
}) {
  final total = (end - start).distance;
  if (total <= 0) return;
  final dir = (end - start) / total;
  var d = 0.0;
  while (d < total) {
    final a = start + dir * d;
    final b = start + dir * (d + dash).clamp(0, total);
    canvas.drawLine(a, b, paint);
    d += dash + gap;
  }
}

/// Fixed tier colours (no external emblem images).
Color tierColor(String tier) => switch (tier) {
      'IRON' => const Color(0xFF8C8C8C),
      'BRONZE' => const Color(0xFFB0794F),
      'SILVER' => const Color(0xFFAEB8C2),
      'GOLD' => const Color(0xFFE1B85C),
      'PLATINUM' => const Color(0xFF4FB6A8),
      'EMERALD' => const Color(0xFF3CC37A),
      'DIAMOND' => const Color(0xFF6C9CF0),
      'MASTER' => const Color(0xFFB57BEA),
      'GRANDMASTER' => const Color(0xFFE5605B),
      'CHALLENGER' => const Color(0xFF7FD3F0),
      _ => const Color(0xFF8C8C8C),
    };

/// Styled rank pill: "GOLD II · 45 LP" in the tier colour.
class TierBadge extends StatelessWidget {
  const TierBadge({required this.tier, this.detail, super.key});
  final String tier;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final c = tierColor(tier);
    return Container(
      key: const ValueKey('tierBadge'),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: c.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.shield_rounded, size: 13, color: c),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              detail == null ? tier : '$tier $detail',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.mono.copyWith(
                color: c,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact percentile badge: "Top 32% · EMERALD".
class StandingBadge extends StatelessWidget {
  const StandingBadge({required this.standing, super.key});
  final Standing standing;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final p = standing.percentile;
    final color = p >= 75
        ? colors.success
        : p >= 50
            ? colors.gold
            : colors.errorLight;
    return Container(
      key: ValueKey('standing_${standing.tier}_${standing.metric}'),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        '${standing.label} · ${standing.tier}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.micro.copyWith(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// "Ahri vs Zed" (or just the champion).
String matchTitle(MatchReview m) => m.opponentChampion == null
    ? m.champion
    : '${m.champion} vs ${m.opponentChampion}';

/// Positioned value label used by the chart tooltips.
class ChartValueLabel extends StatelessWidget {
  const ChartValueLabel({
    required this.left,
    required this.top,
    required this.width,
    required this.text,
    required this.color,
    super.key,
  });

  final double left;
  final double top;
  final double width;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Positioned(
      left: left,
      top: top,
      width: width,
      child: IgnorePointer(
        child: Center(
          child: Container(
            key: const ValueKey('chartTooltip'),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: colors.surfaceMedium,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: color.withValues(alpha: 0.6)),
            ),
            child: Text(
              text,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.micro.copyWith(
                color: colors.textPrimary,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Floating value label above a chart point. Shared with the minute curves.
class ChartTooltip extends StatelessWidget {
  const ChartTooltip({
    super.key,
    required this.anchor,
    required this.chartWidth,
    required this.text,
    required this.color,
  });

  final Offset anchor;
  final double chartWidth;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    const w = 200.0;
    final maxW = math.min(w, chartWidth);
    final left = (anchor.dx - maxW / 2).clamp(0, chartWidth - maxW).toDouble();
    final top = math.max(0, anchor.dy - 34).toDouble();
    return ChartValueLabel(
      left: left,
      top: top,
      width: maxW,
      text: text,
      color: color,
    );
  }
}
