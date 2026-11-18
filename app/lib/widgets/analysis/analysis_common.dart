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
