import 'dart:math' as math;

import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:material_ui/material_ui.dart';

/// Line chart of one metric over the shown matches (oldest → newest) with a
/// dashed next-tier benchmark line.
class TrendCard extends StatefulWidget {
  const TrendCard({required this.snapshot, super.key});
  final AnalysisSnapshot snapshot;

  @override
  State<TrendCard> createState() => _TrendCardState();
}

class _TrendCardState extends State<TrendCard> {
  AnalysisMetric _metric = AnalysisMetric.cs10;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = widget.snapshot;
    final values =
        s.matches.reversed.map(_metric.valueOf).toList(growable: false);
    final wins = s.matches.reversed.map((m) => m.win).toList(growable: false);
    final bench = s.benchmarkFor(s.nextTier);
    final benchValue = bench == null ? null : _metric.benchmarkOf(bench);

    return BentoCard(
      title: 'TREND · LAST ${values.length}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final m in AnalysisMetric.values)
                HudChip(
                  label: m.shortLabel,
                  selected: m == _metric,
                  onTap: () => setState(() => _metric = m),
                ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 160,
            width: double.infinity,
            child: CustomPaint(
              painter: TrendPainter(
                values: values,
                wins: wins,
                benchmark: benchValue,
                metric: _metric,
                lineColor: colors.magic,
                benchColor: colors.gold,
                gridColor: colors.hairlineSoft,
                axisColor: colors.border,
                labelColor: colors.textDisabled,
                winColor: colors.success,
                lossColor: colors.errorLight,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              _Legend(color: colors.magic, label: 'You'),
              if (_metric.hasBenchmark)
                _Legend(
                  color: colors.gold,
                  label: benchValue == null
                      ? '${s.nextTier ?? 'Next tier'} · collecting…'
                      : '${s.nextTier} · ${_metric.format(benchValue)}',
                  dashed: true,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({
    required this.color,
    required this.label,
    this.dashed = false,
  });
  final Color color;
  final String label;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 16,
          height: 8,
          child: CustomPaint(
            painter: _LegendLinePainter(color: color, dashed: dashed),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppTextStyles.micro.copyWith(
            color: context.colors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _LegendLinePainter extends CustomPainter {
  const _LegendLinePainter({required this.color, required this.dashed});
  final Color color;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 2;
    final y = size.height / 2;
    if (dashed) {
      drawDashedLine(
        canvas,
        Offset(0, y),
        Offset(size.width, y),
        p,
        dash: 3,
        gap: 2,
      );
    } else {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }

  @override
  bool shouldRepaint(_LegendLinePainter old) =>
      old.color != color || old.dashed != dashed;
}

/// Paints the trend line. Exposed for tests.
class TrendPainter extends CustomPainter {
  const TrendPainter({
    required this.values,
    required this.wins,
    required this.benchmark,
    required this.metric,
    required this.lineColor,
    required this.benchColor,
    required this.gridColor,
    required this.axisColor,
    required this.labelColor,
    required this.winColor,
    required this.lossColor,
  });

  final List<double> values;
  final List<bool> wins;
  final double? benchmark;
  final AnalysisMetric metric;
  final Color lineColor;
  final Color benchColor;
  final Color gridColor;
  final Color axisColor;
  final Color labelColor;
  final Color winColor;
  final Color lossColor;

  @override
  void paint(Canvas canvas, Size size) {
    const leftPad = 40.0;
    const topPad = 8.0;
    const bottomPad = 8.0;
    final chart = Rect.fromLTRB(
      leftPad,
      topPad,
      size.width - 6,
      size.height - bottomPad,
    );
    if (chart.width <= 0 || chart.height <= 0) return;

    final all = [...values, if (benchmark != null) benchmark!];
    var lo = all.isEmpty ? 0.0 : all.reduce(math.min);
    var hi = all.isEmpty ? 1.0 : all.reduce(math.max);
    if (!metric.hasBenchmark) {
      // Lane diffs: keep the zero line in view.
      lo = math.min(lo, 0);
      hi = math.max(hi, 0);
    } else if (metric == AnalysisMetric.earlyDeaths ||
        metric == AnalysisMetric.objectivePresence) {
      lo = math.min(lo, 0);
    }
    if ((hi - lo).abs() < 1e-9) hi = lo + 1;
    final pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;

    double yOf(double v) => chart.bottom - (v - lo) / (hi - lo) * chart.height;

    final grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = chart.top + chart.height * i / 3;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), grid);
    }

    // Labels: max / min.
    _label(canvas, metric.format(hi - pad), Offset(0, chart.top - 2));
    _label(canvas, metric.format(lo + pad), Offset(0, chart.bottom - 12));

    // Zero line for diff metrics.
    if (lo < 0 && hi > 0) {
      final y0 = yOf(0);
      canvas.drawLine(
        Offset(chart.left, y0),
        Offset(chart.right, y0),
        Paint()
          ..color = axisColor
          ..strokeWidth = 1,
      );
    }

    if (benchmark != null) {
      final yb = yOf(benchmark!);
      drawDashedLine(
        canvas,
        Offset(chart.left, yb),
        Offset(chart.right, yb),
        Paint()
          ..color = benchColor
          ..strokeWidth = 1.5,
      );
    }

    if (values.isEmpty) return;
    final step = values.length == 1 ? 0.0 : chart.width / (values.length - 1);
    Offset pt(int i) => Offset(
          values.length == 1 ? chart.center.dx : chart.left + step * i,
          yOf(values[i]),
        );

    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(pt(i).dx, pt(i).dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round,
    );
    for (var i = 0; i < values.length; i++) {
      final win = i < wins.length && wins[i];
      canvas
        ..drawCircle(pt(i), 3.5, Paint()..color = win ? winColor : lossColor)
        ..drawCircle(
          pt(i),
          3.5,
          Paint()
            ..color = lineColor
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1,
        );
    }
  }

  void _label(Canvas canvas, String text, Offset at) {
    TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: labelColor, fontSize: 10),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )
      ..layout(maxWidth: 38)
      ..paint(canvas, at);
  }

  @override
  bool shouldRepaint(TrendPainter old) =>
      old.values != values ||
      old.benchmark != benchmark ||
      old.metric != metric ||
      old.lineColor != lineColor;
}
