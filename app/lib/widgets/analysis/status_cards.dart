import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:material_ui/material_ui.dart';

/// LLM summary over the backfilled games.
class BackfillSummaryCard extends StatelessWidget {
  const BackfillSummaryCard({required this.summary, super.key});
  final String summary;

  @override
  Widget build(BuildContext context) {
    return BentoCard(
      title: 'HISTORY SUMMARY',
      titleColor: context.colors.gold,
      child: Text(summary, style: AppTextStyles.caption),
    );
  }
}

/// Benchmark collection progress per tier.
class AggregationCard extends StatelessWidget {
  const AggregationCard({required this.aggregation, super.key});
  final AggregationProgress aggregation;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final a = aggregation;
    final (label, color) = switch (a.state) {
      'running' => ('Collecting', colors.magic),
      'paused' => ('Paused', colors.warning),
      'done' => ('Done', colors.success),
      'key_expired' => ('Key expired', colors.errorLight),
      'error' => ('Error', colors.errorLight),
      _ => ('Idle', colors.textSecondary),
    };

    return BentoCard(
      title: a.patch == null ? 'BENCHMARKS' : 'BENCHMARKS · ${a.patch}',
      trailing: StatusChip(label: label, color: color),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final t in a.tiers) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    t.tier,
                    style: AppTextStyles.micro.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                Text(
                  '${t.samples}/${t.target}',
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: t.fraction,
                minHeight: 5,
                backgroundColor: colors.surface2,
                color: t.fraction >= 1 ? colors.success : colors.magic,
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (a.tiers.isEmpty && a.message == null)
            Text(
              'No benchmark collection running.',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
          if (a.message != null)
            Text(
              a.message!,
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }
}
