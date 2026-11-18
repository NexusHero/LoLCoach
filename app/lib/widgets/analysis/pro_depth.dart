import 'dart:math' as math;

import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
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
            style: AppTextStyles.caption.copyWith(color: colors.textPrimary),
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
            onChanged: (v) => setState(() => _selectedId = v),
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
              height: 150,
              child: CustomPaint(
                painter: MinuteCurvesPainter(
                  minutes: diffs.map((d) => d.minute).toList(),
                  series: [
                    for (final s in series)
                      (color: s.color, values: s.values, max: s.max),
                  ],
                  zeroColor: colors.borderAccent,
                  gridColor: colors.hairlineSoft,
                  labelColor: colors.textDisabled,
                ),
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
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Each line is scaled to its own peak; above the line = ahead.',
            style: AppTextStyles.micro.copyWith(
              color: colors.textDisabled,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

typedef CurveSeries = ({Color color, List<double> values, double max});

class MinuteCurvesPainter extends CustomPainter {
  const MinuteCurvesPainter({
    required this.minutes,
    required this.series,
    required this.zeroColor,
    required this.gridColor,
    required this.labelColor,
  });

  final List<int> minutes;
  final List<CurveSeries> series;
  final Color zeroColor;
  final Color gridColor;
  final Color labelColor;

  @override
  void paint(Canvas canvas, Size size) {
    const bottomPad = 14.0;
    final chart = Rect.fromLTRB(0, 4, size.width, size.height - bottomPad);
    if (chart.width <= 0 || chart.height <= 0 || minutes.isEmpty) return;

    final firstMin = minutes.first;
    final lastMin = math.max(minutes.last, firstMin + 1);
    double xOf(int minute) =>
        chart.left + (minute - firstMin) / (lastMin - firstMin) * chart.width;
    final midY = chart.center.dy;
    final half = chart.height / 2;

    final grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (var m = firstMin; m <= lastMin; m++) {
      if (m % 5 != 0) continue;
      final x = xOf(m);
      canvas.drawLine(Offset(x, chart.top), Offset(x, chart.bottom), grid);
      final tp = TextPainter(
        text: TextSpan(
          text: '$m',
          style: TextStyle(color: labelColor, fontSize: 10),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final lx = (x - tp.width / 2).clamp(0, size.width - tp.width).toDouble();
      tp.paint(canvas, Offset(lx, chart.bottom + 2));
    }

    canvas.drawLine(
      Offset(chart.left, midY),
      Offset(chart.right, midY),
      Paint()
        ..color = zeroColor
        ..strokeWidth = 1,
    );

    for (final s in series) {
      if (s.values.isEmpty) continue;
      final scale = s.max <= 0 ? 0.0 : half * 0.92 / s.max;
      final path = Path();
      for (var i = 0; i < s.values.length && i < minutes.length; i++) {
        final p = Offset(xOf(minutes[i]), midY - s.values[i] * scale);
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
  }

  @override
  bool shouldRepaint(MinuteCurvesPainter old) =>
      old.minutes != minutes || old.series != series;
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
                Text(
                  e.key,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: cell.copyWith(fontWeight: FontWeight.w600),
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
                      child: Text(
                        _shopVisitLabel(v),
                        style: AppTextStyles.micro.copyWith(
                          color: colors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
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

String _shopVisitLabel(ShopVisit v) {
  final head = '${formatGameTime(v.time)} · ${v.goldBefore}g';
  return v.itemsBought.isEmpty ? head : '$head · ${v.itemsBought.join(', ')}';
}
