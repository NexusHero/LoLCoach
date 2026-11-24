import 'dart:math' as math;

import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:material_ui/material_ui.dart';

/// Line chart of one metric over the shown matches (oldest → newest) with a
/// dashed next-tier benchmark line. Tap or hover a point to inspect it.
class TrendCard extends StatefulWidget {
  const TrendCard({required this.snapshot, super.key});
  final AnalysisSnapshot snapshot;

  @override
  State<TrendCard> createState() => _TrendCardState();
}

class _TrendCardState extends State<TrendCard> {
  AnalysisMetric _metric = AnalysisMetric.cs10;
  int? _selected;

  void _select(Offset local, Size size, int n) {
    final i = TrendPainter.indexAt(local.dx, size, n);
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = widget.snapshot;
    final ordered = s.matches.reversed.toList(growable: false);
    final values = ordered.map(_metric.valueOf).toList(growable: false);
    final wins = ordered.map((m) => m.win).toList(growable: false);
    final bench = s.benchmarkFor(s.nextTier);
    final benchValue = bench == null ? null : _metric.benchmarkOf(bench);
    final sel =
        _selected != null && _selected! < values.length ? _selected : null;

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
            height: 180,
            width: double.infinity,
            child: LayoutBuilder(
              builder: (context, c) {
                final size = Size(c.maxWidth, c.maxHeight);
                final painter = TrendPainter(
                  values: values,
                  wins: wins,
                  benchmark: benchValue,
                  metric: _metric,
                  selected: sel,
                  lineColor: colors.magic,
                  benchColor: colors.gold,
                  gridColor: colors.hairlineSoft,
                  axisColor: colors.border,
                  labelColor: colors.textDisabled,
                  labelStyle: DefaultTextStyle.of(context).style,
                  winColor: colors.success,
                  lossColor: colors.errorLight,
                );
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: MouseRegion(
                        onHover: (e) =>
                            _select(e.localPosition, size, values.length),
                        onExit: (_) => setState(() => _selected = null),
                        child: GestureDetector(
                          key: const ValueKey('trendChart'),
                          behavior: HitTestBehavior.opaque,
                          onTapDown: (d) =>
                              _select(d.localPosition, size, values.length),
                          onHorizontalDragUpdate: (d) =>
                              _select(d.localPosition, size, values.length),
                          child: CustomPaint(painter: painter),
                        ),
                      ),
                    ),
                    if (sel != null)
                      ChartTooltip(
                        anchor: painter.pointAt(sel, size),
                        chartWidth: size.width,
                        text: 'Game ${sel + 1} · '
                            '${_metric.format(values[sel])} · '
                            '${matchTitle(ordered[sel])}',
                        color: wins[sel] ? colors.success : colors.errorLight,
                      ),
                  ],
                );
              },
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
    required this.labelStyle,
    required this.winColor,
    required this.lossColor,
    this.selected,
  });

  final List<double> values;
  final List<bool> wins;
  final double? benchmark;
  final AnalysisMetric metric;
  final int? selected;
  final Color lineColor;
  final Color benchColor;
  final Color gridColor;
  final Color axisColor;
  final Color labelColor;

  /// App text style for axis labels, so the canvas uses the same font as
  /// the rest of the UI instead of the engine default.
  final TextStyle labelStyle;
  final Color winColor;
  final Color lossColor;

  static const _leftPad = 46.0;
  static const _topPad = 8.0;
  static const _bottomPad = 20.0;
  static const _rightPad = 8.0;

  static Rect chartRect(Size size) => Rect.fromLTRB(
        _leftPad,
        _topPad,
        size.width - _rightPad,
        size.height - _bottomPad,
      );

  static double xAt(int i, int n, Rect chart) =>
      n <= 1 ? chart.center.dx : chart.left + chart.width * i / (n - 1);

  /// Index of the point nearest to [dx], or null when there are none.
  static int? indexAt(double dx, Size size, int n) {
    if (n == 0) return null;
    final chart = chartRect(size);
    if (n == 1) return 0;
    final t = ((dx - chart.left) / chart.width).clamp(0.0, 1.0);
    return (t * (n - 1)).round();
  }

  (double, double) _range() {
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
    return (lo, hi);
  }

  double _yOf(double v, Rect chart, double lo, double hi) {
    final pad = (hi - lo) * 0.08;
    final l = lo - pad;
    final h = hi + pad;
    return chart.bottom - (v - l) / (h - l) * chart.height;
  }

  /// Canvas position of point [i].
  Offset pointAt(int i, Size size) {
    final chart = chartRect(size);
    final (lo, hi) = _range();
    return Offset(xAt(i, values.length, chart), _yOf(values[i], chart, lo, hi));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final chart = chartRect(size);
    if (chart.width <= 0 || chart.height <= 0) return;
    final (lo, hi) = _range();
    double yOf(double v) => _yOf(v, chart, lo, hi);

    final grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final v in [lo, hi]) {
      final y = yOf(v);
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), grid);
    }

    // Y-axis labels: max, min and zero (when in range).
    _label(canvas, metric.format(hi), Offset(0, yOf(hi) - 7));
    _label(canvas, metric.format(lo), Offset(0, yOf(lo) - 7));
    if (lo < 0 && hi > 0) {
      final y0 = yOf(0);
      canvas.drawLine(
        Offset(chart.left, y0),
        Offset(chart.right, y0),
        Paint()
          ..color = axisColor
          ..strokeWidth = 1,
      );
      if ((y0 - yOf(hi)).abs() > 14 && (y0 - yOf(lo)).abs() > 14) {
        _label(canvas, '0', Offset(0, y0 - 7));
      }
    }

    // X-axis: game index (1 = oldest).
    final n = values.length;
    final every = n <= 10 ? 1 : (n / 8).ceil();
    for (var i = 0; i < n; i++) {
      if (i % every != 0 && i != n - 1) continue;
      final tp = _painter('${i + 1}')..layout();
      final x = (xAt(i, n, chart) - tp.width / 2)
          .clamp(0, size.width - tp.width)
          .toDouble();
      tp.paint(canvas, Offset(x, chart.bottom + 4));
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
    Offset pt(int i) => Offset(xAt(i, n, chart), yOf(values[i]));

    if (selected != null && selected! < n) {
      final x = pt(selected!).dx;
      canvas.drawLine(
        Offset(x, chart.top),
        Offset(x, chart.bottom),
        Paint()
          ..color = axisColor
          ..strokeWidth = 1,
      );
    }

    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (var i = 1; i < n; i++) {
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
    for (var i = 0; i < n; i++) {
      final win = i < wins.length && wins[i];
      final r = i == selected ? 5.5 : 3.5;
      canvas
        ..drawCircle(pt(i), r, Paint()..color = win ? winColor : lossColor)
        ..drawCircle(
          pt(i),
          r,
          Paint()
            ..color = lineColor
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1,
        );
    }
  }

  TextPainter _painter(String text) => TextPainter(
        text: TextSpan(
          text: text,
          style: labelStyle.copyWith(color: labelColor, fontSize: 12),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      );

  void _label(Canvas canvas, String text, Offset at) {
    _painter(text)
      ..layout(maxWidth: _leftPad - 4)
      ..paint(canvas, at);
  }

  @override
  bool shouldRepaint(TrendPainter old) =>
      old.values != values ||
      old.benchmark != benchmark ||
      old.metric != metric ||
      old.selected != selected ||
      old.lineColor != lineColor;
}
