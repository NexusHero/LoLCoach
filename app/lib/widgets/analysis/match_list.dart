import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:material_ui/material_ui.dart';

/// Newest-first list of reviewed matches; tap a row to expand it.
class MatchListCard extends StatefulWidget {
  const MatchListCard({required this.matches, super.key});
  final List<MatchReview> matches;

  @override
  State<MatchListCard> createState() => _MatchListCardState();
}

class _MatchListCardState extends State<MatchListCard> {
  final Set<String> _expanded = {};

  @override
  Widget build(BuildContext context) {
    return BentoCard(
      title: 'MATCHES',
      child: Column(
        children: [
          for (final m in widget.matches) ...[
            MatchRow(
              match: m,
              expanded: _expanded.contains(m.matchId),
              onTap: () => setState(() {
                if (!_expanded.remove(m.matchId)) _expanded.add(m.matchId);
              }),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class MatchRow extends StatelessWidget {
  const MatchRow({
    required this.match,
    required this.expanded,
    required this.onTap,
    super.key,
  });

  final MatchReview match;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final m = match;
    final accent = m.win ? colors.success : colors.errorLight;
    final stat = AppTextStyles.micro.copyWith(color: colors.textSecondary);

    Widget kv(String k, String v, {Color? color}) => Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '$k ', style: stat),
              TextSpan(
                text: v,
                style: AppTextStyles.micro.copyWith(
                  color: color ?? colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        );

    Color diffColor(num v) => v > 0
        ? colors.success
        : v < 0
            ? colors.errorLight
            : colors.textPrimary;

    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        key: ValueKey('matchRow_${m.matchId}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              color: colors.surface2,
              border: Border(left: BorderSide(color: accent, width: 3)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              m.win ? 'WIN' : 'LOSS',
                              style: AppTextStyles.eyebrow.copyWith(
                                color: accent,
                                fontSize: 10,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                m.opponentChampion == null
                                    ? m.champion
                                    : '${m.champion} vs ${m.opponentChampion}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyBold,
                              ),
                            ),
                            Icon(
                              expanded ? Icons.expand_less : Icons.expand_more,
                              size: 18,
                              color: colors.textSecondary,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 12,
                          runSpacing: 4,
                          children: [
                            kv('KDA', m.kda),
                            kv(
                              'CS@10',
                              signed(m.csDiff10),
                              color: diffColor(m.csDiff10),
                            ),
                            kv(
                              'G@15',
                              signed(m.goldDiff15),
                              color: diffColor(m.goldDiff15),
                            ),
                            kv(
                              'Deaths<14',
                              '${m.earlyDeaths.length}',
                              color: m.earlyDeaths.isEmpty
                                  ? colors.success
                                  : colors.errorLight,
                            ),
                            Text(
                              '${m.patch.isEmpty ? '' : '${m.patch} · '}'
                              '${formatShortDate(m.gameStart)}',
                              style: stat,
                            ),
                          ],
                        ),
                        if (expanded) _MatchDetails(match: m),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MatchDetails extends StatelessWidget {
  const _MatchDetails({required this.match});
  final MatchReview match;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final m = match;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Divider(height: 1, color: colors.hairlineSoft),
          const SizedBox(height: 10),
          if (m.aiReview != null) ...[
            Eyebrow('COACH REVIEW', color: colors.magic),
            const SizedBox(height: 4),
            Text(m.aiReview!, style: AppTextStyles.caption),
            const SizedBox(height: 10),
          ],
          const Eyebrow('EARLY DEATHS (<14:00)'),
          const SizedBox(height: 4),
          if (m.earlyDeaths.isEmpty)
            Text(
              'No deaths before 14:00.',
              style: AppTextStyles.caption.copyWith(color: colors.success),
            )
          else
            for (final d in m.earlyDeaths)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 42,
                      child: Text(
                        formatGameTime(d.time),
                        style: AppTextStyles.mono.copyWith(
                          color: colors.errorLight,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        [
                          if (d.zone.isNotEmpty) d.zone,
                          if (d.killerChampion.isNotEmpty)
                            'killed by ${d.killerChampion}',
                          _enemies(d.enemiesInvolved),
                        ].join(' · '),
                        style: AppTextStyles.caption.copyWith(
                          color: colors.textSecondary,
                        ),
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

String _enemies(int n) => '$n ${n == 1 ? 'enemy' : 'enemies'}';
