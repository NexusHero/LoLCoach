import 'package:flutter/material.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';

class KdaNum extends StatelessWidget {
  const KdaNum(this.text, this.color, {super.key});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: AppTextStyles.monoLarge.copyWith(color: color),
      );
}

class KdaSep extends StatelessWidget {
  const KdaSep({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Text(
          '/',
          style: AppTextStyles.mono.copyWith(
            color: context.colors.textSecondary,
          ),
        ),
      );
}

class StatChip extends StatelessWidget {
  const StatChip(
    this.label,
    this.value,
    this.color, {
    this.progress,
    super.key,
  });
  final String label;
  final String value;
  final Color color;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.hairlineSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: AppTextStyles.eyebrow.copyWith(
              fontSize: 10,
              letterSpacing: 1.1,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: AppTextStyles.mono.copyWith(color: color),
          ),
          if (progress != null) ...[
            const SizedBox(height: 5),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 3,
                width: 44,
                child: LinearProgressIndicator(
                  value: progress!.clamp(0.0, 1.0),
                  backgroundColor: colors.border,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
