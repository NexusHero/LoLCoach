import 'dart:math' as math;

import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/item_slot.dart';
import 'package:material_ui/material_ui.dart';

/// Collapsible "Pro depth" section (closed by default): minute curves,
/// matchup table, item & recall timing.
class ProDepthSection extends StatefulWidget {
  const ProDepthSection({required this.matches, this.wide = false, super.key});
  final List<MatchReview> matches;
  final bool wide;

  @override
  State<ProDepthSection> createState() => _ProDepthSectionState();
}

class _ProDepthSectionState extends State<ProDepthSection> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final header = Material(
      type: MaterialType.transparency,
      child: InkWell(
        key: const ValueKey('proDepthToggle'),
        onTap: () => setState(() => _open = !_open),
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            children: [
              Icon(Icons.science_outlined, size: 18, color: colors.cyan),
              const SizedBox(width: 8),
              Eyebrow('PRO DEPTH', color: colors.cyan),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Minute curves · matchups · item timing',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
              Icon(
                _open ? Icons.expand_less : Icons.expand_more,
                color: colors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );

    Widget body() {
      final curves = MinuteCurvesCard(matches: widget.matches);
      final table = MatchupTableCard(matches: widget.matches);
      final timing = ItemTimingCard(matches: widget.matches);
      if (widget.wide) {
        return Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: curves),
                const SizedBox(width: 16),
                Expanded(child: table),
              ],
            ),
            const SizedBox(height: 16),
            timing,
          ],
        );
      }
      return Column(
        children: [
          curves,
          const SizedBox(height: 16),
          table,
          const SizedBox(height: 16),
          timing,
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: _open
              ? Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: body(),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

String _matchLabel(MatchReview m) {
  final vs = m.opponentChampion == null ? '' : ' vs ${m.opponentChampion}';
  return '${m.champion}$vs · ${formatShortDate(m.gameStart)}';
}

/// Gold / XP / CS diff vs lane opponent per minute for one match.
class MinuteCurvesCard extends StatefulWidget {
  const MinuteCurvesCard({required this.matches, super.key});
  final List<MatchReview> matches;

  @override
  State<MinuteCurvesCard> createState() => _MinuteCurvesCardState();
}

class _MinuteCurvesCardState extends State<MinuteCurvesCard> {
  String? _selectedId;
  int? _hover;

  void _inspect(Offset local, Size size, List<int> minutes) {
    final i = MinuteCurvesPainter.indexAt(local.dx, size, minutes);
    if (i != _hover) setState(() => _hover = i);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final matches = widget.matches;
    if (matches.isEmpty) {
      return const BentoCard(title: 'MINUTE CURVES', child: SizedBox.shrink());
    }
    final selected = matches.firstWhere(
      (m) => m.matchId == _selectedId,
      orElse: () => matches.first,
    );
    final diffs = selected.minuteDiffs;
    double maxAbs(double Function(MinuteDiff) f) =>
        diffs.fold<double>(0, (a, d) => math.max(a, f(d).abs()));

    final series = [
      (
        label: 'Gold',
        color: colors.gold,
        values: diffs.map((d) => d.gold).toList(),
        max: maxAbs((d) => d.gold),
      ),
      (
        label: 'XP',
        color: colors.cyan,
        values: diffs.map((d) => d.xp).toList(),
        max: maxAbs((d) => d.xp),
      ),
      (
        label: 'CS',
        color: colors.magic,
        values: diffs.map((d) => d.cs).toList(),
        max: maxAbs((d) => d.cs),
      ),
    ];

    return BentoCard(
      title: 'MINUTE CURVES · VS LANE',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButton<String>(
            value: selected.matchId,
            isExpanded: true,
            isDense: true,
            underline: const SizedBox.shrink(),
            // Merge with the inherited style: a dropdown's style replaces it,
            // which would drop the app font.
            style: DefaultTextStyle.of(context)
                .style
                .merge(
                  AppTextStyles.caption.copyWith(color: colors.textPrimary),
                ),
            items: [
              for (final m in matches)
                DropdownMenuItem(
                  value: m.matchId,
                  child: Text(
                    _matchLabel(m),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: (v) => setState(() {
              _selectedId = v;
              _hover = null;
            }),
          ),
          const SizedBox(height: 10),
          if (diffs.isEmpty)
            Text(
              'No timeline data for this match.',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            )
          else
            SizedBox(
              height: 170,
              child: LayoutBuilder(
                builder: (context, c) {
                  final size = Size(c.maxWidth, c.maxHeight);
                  final minutes = diffs.map((d) => d.minute).toList();
                  final painter = MinuteCurvesPainter(
                    minutes: minutes,
                    series: [
                      for (final s in series)
                        (color: s.color, values: s.values, max: s.max),
                    ],
                    deathMinutes: [
                      for (final d in selected.earlyDeaths) d.time / 60,
                    ],
                    objectives: [
                      for (final o in selected.objectiveEvents)
                        (
                          minute: o.time / 60,
                          ownTeam: o.ownTeam,
                          present: o.present,
                        ),
                    ],
                    selected: _hover,
                    zeroColor: colors.borderAccent,
                    gridColor: colors.hairlineSoft,
                    labelColor: colors.textDisabled,
                    labelStyle: DefaultTextStyle.of(context).style,
                    axisLabelColor: colors.gold,
                    deathColor: colors.errorLight,
                    ownColor: colors.success,
                    enemyColor: colors.errorLight,
                  );
                  final h = _hover;
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned.fill(
                        child: MouseRegion(
                          onHover: (e) =>
                              _inspect(e.localPosition, size, minutes),
                          onExit: (_) => setState(() => _hover = null),
                          child: GestureDetector(
                            key: const ValueKey('minuteChart'),
                            behavior: HitTestBehavior.opaque,
                            onTapDown: (d) =>
                                _inspect(d.localPosition, size, minutes),
                            onHorizontalDragUpdate: (d) =>
                                _inspect(d.localPosition, size, minutes),
                            child: CustomPaint(painter: painter),
                          ),
                        ),
                      ),
                      if (h != null && h < diffs.length)
                        ChartTooltip(
                          anchor: painter.anchorAt(h, size),
                          chartWidth: size.width,
                          text: '${diffs[h].minute}:00 · '
                              'Gold ${signed(diffs[h].gold)} · '
                              'XP ${signed(diffs[h].xp)} · '
                              'CS ${signed(diffs[h].cs)}',
                          color: colors.gold,
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
              for (final s in series)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 10, height: 3, color: s.color),
                    const SizedBox(width: 6),
                    Text(
                      '${s.label} ±${s.max.round()}',
                      style: AppTextStyles.micro.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              _MarkerLegend(
                icon: Icon(
                  Icons.close_rounded,
                  size: 12,
                  color: colors.errorLight,
                ),
                label: 'Early death',
              ),
              _MarkerLegend(
                icon: _Dot(color: colors.success, filled: true),
                label: 'Objective (ours)',
              ),
              _MarkerLegend(
                icon: _Dot(color: colors.errorLight, filled: true),
                label: 'Objective (theirs)',
              ),
              _MarkerLegend(
                icon: _Dot(color: colors.textSecondary, filled: false),
                label: 'Hollow = absent',
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Axis shows gold; XP and CS are scaled to their own peak. '
            'Above the line = ahead. Tap the chart for exact values.',
            style: AppTextStyles.micro.copyWith(
              color: colors.textDisabled,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _MarkerLegend extends StatelessWidget {
  const _MarkerLegend({required this.icon, required this.label});
  final Widget icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.micro.copyWith(
                color: context.colors.textSecondary,
              ),
            ),
          ),
        ],
      );
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.filled});
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? color : Colors.transparent,
          border: Border.all(color: color, width: 1.5),
        ),
      );
}

typedef CurveSeries = ({Color color, List<double> values, double max});
typedef ObjectiveMarker = ({double minute, bool ownTeam, bool present});

class MinuteCurvesPainter extends CustomPainter {
  const MinuteCurvesPainter({
    required this.minutes,
    required this.series,
    required this.zeroColor,
    required this.gridColor,
    required this.labelColor,
    required this.labelStyle,
    required this.axisLabelColor,
    required this.deathColor,
    required this.ownColor,
    required this.enemyColor,
    this.deathMinutes = const [],
    this.objectives = const [],
    this.selected,
  });

  /// Series order: gold first (the y-axis labels use its scale).
  final List<int> minutes;
  final List<CurveSeries> series;
  final List<double> deathMinutes;
  final List<ObjectiveMarker> objectives;
  final int? selected;
  final Color zeroColor;
  final Color gridColor;
  final Color labelColor;

  /// App text style for axis labels, so the canvas uses the same font as
  /// the rest of the UI instead of the engine default.
  final TextStyle labelStyle;
  final Color axisLabelColor;
  final Color deathColor;
  final Color ownColor;
  final Color enemyColor;

  static const _leftPad = 40.0;
  static const _topPad = 12.0;
  static const _bottomPad = 18.0;

  static Rect chartRect(Size size) => Rect.fromLTRB(
        _leftPad,
        _topPad,
        size.width - 4,
        size.height - _bottomPad,
      );

  static (int, int) _span(List<int> minutes) {
    final first = minutes.first;
    return (first, math.max(minutes.last, first + 1));
  }

  static double _x(double minute, List<int> minutes, Rect chart) {
    final (first, last) = _span(minutes);
    final t = ((minute - first) / (last - first)).clamp(0.0, 1.0);
    return chart.left + t * chart.width;
  }

  /// Index into [minutes] nearest to [dx].
  static int? indexAt(double dx, Size size, List<int> minutes) {
    if (minutes.isEmpty) return null;
    final chart = chartRect(size);
    var best = 0;
    var bestDist = double.infinity;
    for (var i = 0; i < minutes.length; i++) {
      final d = (_x(minutes[i].toDouble(), minutes, chart) - dx).abs();
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /// Anchor for the tooltip at index [i] (top of the chart).
  Offset anchorAt(int i, Size size) {
    final chart = chartRect(size);
    return Offset(_x(minutes[i].toDouble(), minutes, chart), chart.top + 30);
  }

  TextPainter _text(String t, Color c) => TextPainter(
        text: TextSpan(
          text: t,
          style: labelStyle.copyWith(color: c, fontSize: 12),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      )..layout(maxWidth: _leftPad - 4);

  static String _compact(double v) {
    final a = v.abs();
    final s = a >= 1000 ? '${(a / 1000).toStringAsFixed(1)}k' : '${a.round()}';
    return v < 0 ? '-$s' : '+$s';
  }

  @override
  void paint(Canvas canvas, Size size) {
    final chart = chartRect(size);
    if (chart.width <= 0 || chart.height <= 0 || minutes.isEmpty) return;

    final (firstMin, lastMin) = _span(minutes);
    double xOf(double minute) => _x(minute, minutes, chart);
    final midY = chart.center.dy;
    final half = chart.height / 2;

    final grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    canvas
      ..drawLine(
        Offset(chart.left, chart.top),
        Offset(chart.right, chart.top),
        grid,
      )
      ..drawLine(
        Offset(chart.left, chart.bottom),
        Offset(chart.right, chart.bottom),
        grid,
      );

    // X-axis: minutes every 5 (plus the last).
    for (var m = firstMin; m <= lastMin; m++) {
      if (m % 5 != 0 && m != lastMin) continue;
      final x = xOf(m.toDouble());
      if (m % 5 == 0) {
        canvas.drawLine(Offset(x, chart.top), Offset(x, chart.bottom), grid);
      }
      final tp = TextPainter(
        text: TextSpan(
          text: '$m',
          style: labelStyle.copyWith(color: labelColor, fontSize: 12),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final lx = (x - tp.width / 2).clamp(0, size.width - tp.width).toDouble();
      tp.paint(canvas, Offset(lx, chart.bottom + 3));
    }

    canvas.drawLine(
      Offset(chart.left, midY),
      Offset(chart.right, midY),
      Paint()
        ..color = zeroColor
        ..strokeWidth = 1,
    );

    // Y-axis labels on the gold scale.
    final goldMax = series.isEmpty ? 0.0 : series.first.max;
    _text(_compact(goldMax), axisLabelColor)
        .paint(canvas, Offset(0, chart.top + half * 0.08 - 7));
    _text('0', labelColor).paint(canvas, Offset(0, midY - 7));
    _text(_compact(-goldMax), axisLabelColor)
        .paint(canvas, Offset(0, chart.bottom - half * 0.08 - 7));

    if (selected != null && selected! < minutes.length) {
      final x = xOf(minutes[selected!].toDouble());
      canvas.drawLine(
        Offset(x, chart.top),
        Offset(x, chart.bottom),
        Paint()
          ..color = zeroColor
          ..strokeWidth = 1,
      );
    }

    for (final s in series) {
      if (s.values.isEmpty) continue;
      final scale = s.max <= 0 ? 0.0 : half * 0.92 / s.max;
      final path = Path();
      for (var i = 0; i < s.values.length && i < minutes.length; i++) {
        final p = Offset(
          xOf(minutes[i].toDouble()),
          midY - s.values[i] * scale,
        );
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = s.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round,
      );
    }

    // Objective markers along the top edge.
    for (final o in objectives) {
      final c = Offset(xOf(o.minute), chart.top);
      final color = o.ownTeam ? ownColor : enemyColor;
      canvas.drawCircle(
        c,
        4,
        Paint()
          ..color = color
          ..style = o.present ? PaintingStyle.fill : PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }

    // Early deaths as red crosses along the bottom edge.
    final cross = Paint()
      ..color = deathColor
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (final m in deathMinutes) {
      final c = Offset(xOf(m), chart.bottom - 6);
      canvas
        ..drawLine(c + const Offset(-4, -4), c + const Offset(4, 4), cross)
        ..drawLine(c + const Offset(-4, 4), c + const Offset(4, -4), cross);
    }
  }

  @override
  bool shouldRepaint(MinuteCurvesPainter old) =>
      old.minutes != minutes ||
      old.series != series ||
      old.selected != selected ||
      old.deathMinutes != deathMinutes ||
      old.objectives != objectives;
}

/// Results grouped by lane opponent.
class MatchupTableCard extends StatelessWidget {
  const MatchupTableCard({required this.matches, super.key});
  final List<MatchReview> matches;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final groups = <String, List<MatchReview>>{};
    for (final m in matches) {
      groups.putIfAbsent(m.opponentChampion ?? 'Unknown', () => []).add(m);
    }
    final rows = groups.entries.toList()
      ..sort((a, b) => b.value.length.compareTo(a.value.length));

    final head = AppTextStyles.micro.copyWith(
      color: colors.textDisabled,
      fontWeight: FontWeight.w700,
    );
    final cell = AppTextStyles.micro.copyWith(color: colors.textPrimary);
    Color diffColor(double v) => v > 0
        ? colors.success
        : v < 0
            ? colors.errorLight
            : colors.textPrimary;

    TableRow row(List<Widget> cells) => TableRow(
          children: [
            for (final c in cells)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: c,
              ),
          ],
        );

    return BentoCard(
      title: 'MATCHUPS',
      child: Table(
        columnWidths: const {
          0: FlexColumnWidth(2.2),
          1: FlexColumnWidth(),
          2: FlexColumnWidth(),
          3: FlexColumnWidth(1.2),
          4: FlexColumnWidth(1.2),
        },
        border: TableBorder(
          horizontalInside: BorderSide(color: colors.hairlineSoft),
        ),
        children: [
          row([
            Text('OPPONENT', style: head),
            Text('G', style: head, textAlign: TextAlign.right),
            Text('W', style: head, textAlign: TextAlign.right),
            Text('CS@10', style: head, textAlign: TextAlign.right),
            Text('G@15', style: head, textAlign: TextAlign.right),
          ]),
          for (final e in rows)
            () {
              final games = e.value;
              final n = games.length;
              final wins = games.where((m) => m.win).length;
              final cs = games.fold<double>(0, (a, m) => a + m.csDiff10) / n;
              final gold =
                  games.fold<double>(0, (a, m) => a + m.goldDiff15) / n;
              return row([
                Row(
                  children: [
                    if (e.key != 'Unknown') ...[
                      ChampAvatar(name: e.key, isDead: false, size: 20),
                      const SizedBox(width: 6),
                    ],
                    Expanded(
                      child: Text(
                        e.key,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: cell.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                Text('$n', style: cell, textAlign: TextAlign.right),
                Text('$wins', style: cell, textAlign: TextAlign.right),
                Text(
                  signed(cs),
                  style: cell.copyWith(color: diffColor(cs)),
                  textAlign: TextAlign.right,
                ),
                Text(
                  signed(gold),
                  style: cell.copyWith(color: diffColor(gold)),
                  textAlign: TextAlign.right,
                ),
              ]);
            }(),
        ],
      ),
    );
  }
}

/// First core item + shop visits per match.
class ItemTimingCard extends StatelessWidget {
  const ItemTimingCard({required this.matches, super.key});
  final List<MatchReview> matches;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return BentoCard(
      title: 'ITEM & RECALL TIMING',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final m in matches) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    _matchLabel(m),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.captionBold,
                  ),
                ),
                const SizedBox(width: 8),
                if (m.firstCoreItemId != null && m.firstCoreItem != null) ...[
                  ItemSlot(
                    itemId: m.firstCoreItemId!,
                    displayName: m.firstCoreItem!,
                    size: 22,
                  ),
                  const SizedBox(width: 6),
                ],
                Flexible(
                  child: Text(
                    _coreItemLabel(m),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: AppTextStyles.micro.copyWith(color: colors.gold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (m.shopVisits.isEmpty)
              Text(
                'No shop visits recorded.',
                style: AppTextStyles.micro.copyWith(
                  color: colors.textDisabled,
                ),
              )
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final v in m.shopVisits)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surface2,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.hairlineSoft),
                      ),
                      child: _ShopVisitChip(visit: v),
                    ),
                ],
              ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

String _coreItemLabel(MatchReview m) {
  final item = m.firstCoreItem;
  if (item == null) return 'No core item';
  final minute = m.firstCoreItemMinute;
  return minute == null ? item : '$item @ ${minute.toStringAsFixed(1)}m';
}

/// Shop visit as time and gold, followed by item icons when ids are known
/// (falls back to the item names for reviews from older cores).
class _ShopVisitChip extends StatelessWidget {
  const _ShopVisitChip({required this.visit});

  final ShopVisit visit;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasIcons = visit.itemIds.length == visit.itemsBought.length &&
        visit.itemIds.every((id) => id > 0);
    final style = AppTextStyles.micro.copyWith(color: colors.textSecondary);
    if (!hasIcons) return Text(_shopVisitLabel(visit), style: style);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${formatGameTime(visit.time)} · ${visit.goldBefore}g',
          style: style,
        ),
        for (var i = 0; i < visit.itemIds.length; i++) ...[
          const SizedBox(width: 4),
          Tooltip(
            message: visit.itemsBought[i],
            child: ItemSlot(
              itemId: visit.itemIds[i],
              displayName: visit.itemsBought[i],
              size: 22,
            ),
          ),
        ],
      ],
    );
  }
}

String _shopVisitLabel(ShopVisit v) {
  final head = '${formatGameTime(v.time)} · ${v.goldBefore}g';
  return v.itemsBought.isEmpty ? head : '$head · ${v.itemsBought.join(', ')}';
}
