import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:lol_coach/widgets/common/badge.dart';
import 'package:material_ui/material_ui.dart';

/// Number of games in one training block.
const goalBlockSize = 5;

/// The active training goal with its 5-game block progress.
class GoalCard extends StatelessWidget {
  const GoalCard({required this.goal, super.key});
  final TrainingGoal goal;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final badge = switch (goal.status) {
      GoalStatus.achieved => const AppBadge.success('Achieved'),
      GoalStatus.repeat => const AppBadge.champagne('Repeat block'),
      GoalStatus.active => const AppBadge.violet('Active'),
    };
    final cmp = goal.metric.lowerIsBetter ? '≤' : '≥';
    final met = goal.results.where((r) => r).length;

    return BentoCard(
      title: 'TRAINING GOAL',
      titleColor: colors.magic,
      accent: colors.magicLine,
      trailing: badge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            goal.text.isEmpty ? 'Keep improving your lane phase.' : goal.text,
            style: AppTextStyles.heading,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${goal.metric.shortLabel} $cmp '
                // A per-game death target is a whole number, unlike the averages.
                '${goal.metric == AnalysisMetric.earlyDeaths ? goal.target.round() : goal.metric.format(goal.target)}',
                style: AppTextStyles.mono.copyWith(color: colors.gold),
              ),
              if (goal.basedOnTier.isNotEmpty)
                Text(
                  'from ${goal.basedOnTier} benchmark',
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var i = 0; i < goalBlockSize; i++) ...[
                _GoalDot(
                  key: ValueKey('goalDot$i'),
                  result: i < goal.results.length ? goal.results[i] : null,
                ),
                const SizedBox(width: 8),
              ],
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  '$met/${goal.results.length} met',
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One block dot: true = met (green), false = missed (red), null = not
/// played yet (empty).
class _GoalDot extends StatelessWidget {
  const _GoalDot({required this.result, super.key});
  final bool? result;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = switch (result) {
      true => colors.success,
      false => colors.errorLight,
      null => colors.textDisabled,
    };
    return Semantics(
      label: switch (result) {
        true => 'Goal met',
        false => 'Goal missed',
        null => 'Not played yet',
      },
      child: Container(
        width: 14,
        height: 14,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: result == null ? Colors.transparent : color,
          border: Border.all(color: color, width: 1.5),
          boxShadow: result == null
              ? null
              : [
                  BoxShadow(
                    color: color.withValues(alpha: 0.4),
                    blurRadius: 6,
                  ),
                ],
        ),
      ),
    );
  }
}

/// Shown until the core creates the first goal (needs ≥ 100 next-tier
/// benchmark samples).
class GoalPlaceholderCard extends StatelessWidget {
  const GoalPlaceholderCard({
    required this.nextTier,
    this.progress,
    super.key,
  });

  final String? nextTier;
  final TierProgress? progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tier = nextTier ?? 'your next rank';
    final p = progress;
    return BentoCard(
      key: const ValueKey('goalPlaceholder'),
      title: 'TRAINING GOAL',
      titleColor: colors.magic,
      trailing: const AppBadge.neutral('Pending'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Your first goal appears once benchmarks for $tier are collected',
            style: AppTextStyles.body.copyWith(color: colors.textSecondary),
          ),
          if (p != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    p.tier,
                    style: AppTextStyles.micro.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                Text(
                  '${p.samples}/${p.target}',
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: p.fraction,
                minHeight: 5,
                backgroundColor: colors.surface2,
                color: colors.magic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
