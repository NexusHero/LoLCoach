import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:lol_coach/theme/app_colors.dart';

/// The frosted-glass panel primitive every card flows through.
///
/// A translucent fill over a backdrop blur, a 1px specular gradient hairline
/// (or [accent]) border, rounded corners, and a soft drop shadow. Pass [glow]
/// to add the violet AI halo (the recommendation hero). Requires a non-flat
/// background behind it (see `AppBackground`) for the blur and translucency
/// to read.
class GameCard extends StatelessWidget {
  const GameCard({
    required this.child,
    super.key,
    this.accent,
    this.glow = false,
    this.padding = const EdgeInsets.all(18),
    this.radius = 18,
  });

  final Widget child;

  /// Border tint. Defaults to `context.colors.border` (hairline) when null.
  final Color? accent;

  /// Adds the violet glow halo — reserve for the AI recommendation hero.
  final bool glow;

  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final br = BorderRadius.circular(radius);
    final baseBorderColor = accent ?? colors.border;
    final highlightColor = accent ?? colors.borderAccent;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceDark,
        borderRadius: br,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: br,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: CustomPaint(
            foregroundPainter: _SpecularBorderPainter(
              radius: radius,
              topLeftColor: highlightColor,
              middleColor: baseBorderColor,
              bottomRightColor: baseBorderColor.withValues(alpha: 0.04),
            ),
            child: Container(
              width: double.infinity,
              padding: padding,
              decoration: BoxDecoration(
                borderRadius: br,
                gradient: glow
                    ? RadialGradient(
                        center: const Alignment(-0.7, -0.8),
                        radius: 1.5,
                        colors: [
                          colors.magicSubtle,
                          Colors.transparent,
                        ],
                      )
                    : null,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class _SpecularBorderPainter extends CustomPainter {
  const _SpecularBorderPainter({
    required this.radius,
    required this.topLeftColor,
    required this.middleColor,
    required this.bottomRightColor,
  });

  final double radius;
  final Color topLeftColor;
  final Color middleColor;
  final Color bottomRightColor;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(
      rect.deflate(0.5),
      Radius.circular(radius),
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [topLeftColor, middleColor, bottomRightColor],
        stops: const [0.0, 0.45, 1.0],
      ).createShader(rect);

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(_SpecularBorderPainter oldDelegate) =>
      oldDelegate.radius != radius ||
      oldDelegate.topLeftColor != topLeftColor ||
      oldDelegate.middleColor != middleColor ||
      oldDelegate.bottomRightColor != bottomRightColor;
}
