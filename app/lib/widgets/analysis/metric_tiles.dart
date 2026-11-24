import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:material_ui/material_ui.dart';

/// The four headline metric tiles (2×2 when narrow, 1×4 when wide).
class MetricTiles extends StatelessWidget {
  const MetricTiles({required this.snapshot, super.key});
  final AnalysisSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final perRow = constraints.maxWidth >= 640 ? 4 : 2;
        final w = (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final m in AnalysisMetric.headline)
              SizedBox(
                width: w,
                child: MetricTile(metric: m, snapshot: snapshot),
              ),
          ],
        );
      },
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({required this.metric, required this.snapshot, super.key});

  final AnalysisMetric metric;
  final AnalysisSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final avg = snapshot.average(metric);
    final next = snapshot.benchmarkFor(snapshot.nextTier);
    final master = snapshot.benchmarkFor('MASTER');

    final nextValue = next == null ? null : metric.benchmarkOf(next);
    var valueColor = colors.textPrimary;
    if (avg != null && nextValue != null) {
      valueColor =
          metric.beats(avg, nextValue) ? colors.success : colors.errorLight;
    }
    // Lane diff shown as a secondary line (no benchmark: diffs average to
    // zero over a rank).
    final diffMetric = switch (metric) {
      AnalysisMetric.cs10 => AnalysisMetric.csDiff10,
      AnalysisMetric.gold15 => AnalysisMetric.goldDiff15,
      _ => null,
    };
    final diffAvg = diffMetric == null ? null : snapshot.average(diffMetric);
    final standings = [
      for (final tier in {snapshot.nextTier, 'MASTER'})
        if (snapshot.standingFor(tier, metric) case final st?) st,
    ];

    return GameCard(
      key: ValueKey('metricTile_${metric.key}'),
      padding: const EdgeInsets.all(14),
      radius: 14,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            metric.label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.eyebrow.copyWith(
              color: colors.textDisabled,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              avg == null ? '—' : metric.format(avg),
              style: AppTextStyles.monoLarge.copyWith(
                fontSize: 24,
                color: valueColor,
              ),
            ),
          ),
          if (diffMetric != null && diffAvg != null)
            Text(
              '${diffMetric.format(diffAvg)} vs lane',
              key: ValueKey('metricDiff_${metric.key}'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.micro.copyWith(
                fontSize: 12,
                color: diffAvg > 0
                    ? colors.success
                    : diffAvg < 0
                        ? colors.errorLight
                        : colors.textSecondary,
              ),
            )
          else
            Text(
              metric == AnalysisMetric.objectivePresence
                  ? 'of epic objectives'
                  : 'per game',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.micro.copyWith(
                fontSize: 12,
                color: colors.textDisabled,
              ),
            ),
          const SizedBox(height: 8),
          _BenchRow(
            label: snapshot.nextTier ?? 'NEXT',
            bench: next,
            metric: metric,
          ),
          const SizedBox(height: 2),
          _BenchRow(label: 'MASTER', bench: master, metric: metric),
          if (standings.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final st in standings) StandingBadge(standing: st),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _BenchRow extends StatelessWidget {
  const _BenchRow({
    required this.label,
    required this.bench,
    required this.metric,
  });

  final String label;
  final Benchmark? bench;
  final AnalysisMetric metric;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final value = bench == null ? null : metric.benchmarkOf(bench!);
    final style = AppTextStyles.micro.copyWith(
      color: colors.textSecondary,
      fontSize: 12,
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          flex: 3,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: style,
          ),
        ),
        const SizedBox(width: 6),
        Flexible(
          flex: 2,
          child: Text(
            // An en dash keeps narrow tiles readable; the benchmark card shows
            // the collection progress.
            value == null ? '–' : metric.format(value),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.right,
            style: style.copyWith(
              color: value == null ? colors.textDisabled : colors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
