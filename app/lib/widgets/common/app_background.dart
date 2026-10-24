import 'package:flutter/material.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/utils/ddragon.dart';

/// The full-page gradient canvas the glass surfaces float over.
///
/// Translucent panels ([AppColors.surfaceDark]) only read correctly against
/// this layered background: a violet glow at the top, a faint champagne glow
/// bottom-right, and an optional atmospheric champion splash art when in-game,
/// over a near-black vertical gradient.
class AppBackground extends StatelessWidget {
  const AppBackground({
    required this.child,
    this.championName,
    super.key,
  });

  final Widget child;

  /// Optional active champion name for an atmospheric top-anchored splash glow.
  final String? championName;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasChamp = championName != null && championName!.trim().isNotEmpty;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.bgDark, colors.bgGradientEnd],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hasChamp)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 420,
              child: IgnorePointer(
                child: ShaderMask(
                  shaderCallback: (rect) => const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, Colors.transparent],
                    stops: [0.1, 0.95],
                  ).createShader(rect),
                  blendMode: BlendMode.dstIn,
                  child: Opacity(
                    opacity: 0.14,
                    child: Image.network(
                      champSplashUrl(championName!),
                      fit: BoxFit.cover,
                      alignment: Alignment.topCenter,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              ),
            ),
          // Violet glow anchored above the top edge.
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -1.15),
                  radius: 1.15,
                  colors: [colors.bgGlow, colors.bgGlow.withValues(alpha: 0)],
                  stops: const [0, 0.6],
                ),
              ),
            ),
          ),
          // Subtle champagne ambient light bottom-right for glass depth.
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.95, 1.1),
                  radius: 0.95,
                  colors: [
                    colors.goldSubtle.withValues(alpha: 0.06),
                    colors.goldSubtle.withValues(alpha: 0),
                  ],
                  stops: const [0, 0.65],
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
