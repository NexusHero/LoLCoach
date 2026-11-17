import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:lol_coach/theme/app_colors.dart';
import 'package:material_ui/material_ui.dart';

/// Draws an animated arc sweeping around the border to signal AI activity.
/// [strokeWidth] controls thickness; [sweepFraction] the length of the arc
/// as a fraction of the total perimeter (0.0–1.0).
class AiSweepingBorder extends StatefulWidget {
  const AiSweepingBorder({
    required this.child,
    super.key,
    this.borderRadius = 18.0,
    this.strokeWidth = 2.0,
    this.color,
    this.sweepFraction = 0.28,
    this.duration = const Duration(milliseconds: 1800),
  });

  final Widget child;
  final double borderRadius;
  final double strokeWidth;

  /// Defaults to `context.colors.magic` when null (resolved in build()).
  final Color? color;
  final double sweepFraction;
  final Duration duration;

  @override
  State<AiSweepingBorder> createState() => _AiSweepingBorderState();
}

class _AiSweepingBorderState extends State<AiSweepingBorder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? context.colors.magic;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => CustomPaint(
        foregroundPainter: _SweepPainter(
          progress: _ctrl.value,
          color: color,
          borderRadius: widget.borderRadius,
          strokeWidth: widget.strokeWidth,
          sweepFraction: widget.sweepFraction,
        ),
        child: child,
      ),
      child: widget.child,
    );
  }
}

class _SweepPainter extends CustomPainter {
  const _SweepPainter({
    required this.progress,
    required this.color,
    required this.borderRadius,
    required this.strokeWidth,
    required this.sweepFraction,
  });

  final double progress;
  final Color color;
  final double borderRadius;
  final double strokeWidth;
  final double sweepFraction;

  @override
  void paint(Canvas canvas, Size size) {
    final half = strokeWidth / 2;
    final rect = Rect.fromLTWH(
      half,
      half,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(borderRadius));
    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return;
    final pm = metrics.first;
    final total = pm.length;
    final sweepLen = total * sweepFraction;
    final startDist = (total * progress) % total;
    final endDist = startDist + sweepLen;

    // Draw faint static base border
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * 0.5
        ..color = color.withValues(alpha: 0.18),
    );

    // Draw sweeping arc in segments for a comet-tail fade
    const steps = 12;
    for (var i = 0; i < steps; i++) {
      final segFrac = i / steps;
      final segStart = startDist + sweepLen * segFrac;
      final segEnd = startDist + sweepLen * ((i + 1) / steps);
      final opacity = math.pow(segFrac, 0.5).toDouble() * 0.9 + 0.1;

      final segPath = _extractWrapped(
        pm,
        total,
        segStart % total,
        segEnd % total,
      );
      canvas.drawPath(
        segPath,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeCap = StrokeCap.round
          ..color = color.withValues(alpha: opacity),
      );
    }

    // Bright tip at the head of the arc
    final tipStart = (endDist - sweepLen * 0.06) % total;
    final tipEnd = endDist % total;
    canvas.drawPath(
      _extractWrapped(pm, total, tipStart, tipEnd),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * 1.6
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: 0.7),
    );
  }

  Path _extractWrapped(ui.PathMetric pm, double total, double from, double to) {
    if (to > from) return pm.extractPath(from, to);
    final p = pm.extractPath(from, total)
      ..addPath(pm.extractPath(0, to), Offset.zero);
    return p;
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.progress != progress;
}
