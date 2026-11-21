import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:material_ui/material_ui.dart';

/// Seconds of game time the briefing stays on screen unless dismissed.
const briefingVisibleUntilSec = 240.0;

/// Pre-lane matchup briefing: up to two matchup facts and one line from the
/// player's own history. Informational only — it states facts, never orders.
class MatchupBriefingCard extends StatelessWidget {
  const MatchupBriefingCard({
    required this.briefing,
    super.key,
    this.onDismiss,
  });

  final MatchupBriefing briefing;
  final VoidCallback? onDismiss;

  static (IconData, String) _style(BriefingKind kind) => switch (kind) {
        BriefingKind.trading => (Icons.swap_horiz_rounded, 'TRADING'),
        BriefingKind.spike => (Icons.trending_up_rounded, 'POWER SPIKE'),
        BriefingKind.history => (Icons.history_rounded, 'YOUR HISTORY'),
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      accent: colors.cyan,
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'MATCHUP BRIEFING · ${briefing.myChampion.toUpperCase()} '
                  'VS ${briefing.opponentChampion.toUpperCase()}',
                  style: AppTextStyles.eyebrow.copyWith(color: colors.cyan),
                ),
              ),
              if (onDismiss != null)
                IconButton(
                  tooltip: 'Dismiss briefing',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.close_rounded,
                    size: 16,
                    color: colors.textDisabled,
                  ),
                  onPressed: onDismiss,
                ),
            ],
          ),
          const SizedBox(height: 6),
          for (final point in briefing.points) ...[
            _BriefingLine(point: point, style: _style(point.kind)),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _BriefingLine extends StatelessWidget {
  const _BriefingLine({required this.point, required this.style});

  final BriefingPoint point;
  final (IconData, String) style;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (icon, label) = style;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: colors.cyan),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textDisabled,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  point.text,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
