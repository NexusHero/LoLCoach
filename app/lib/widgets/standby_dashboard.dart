// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';

/// Standby dashboard shown while connected to the Core and waiting for a match.
/// Displays historical player habit benchmarks and the Post-Game Autopsy card.
class StandbyDashboard extends StatefulWidget {
  const StandbyDashboard({
    super.key,
    this.autopsy,
    this.profile,
  });

  final PostGameAutopsy? autopsy;
  final PlayerHabitProfile? profile;

  @override
  State<StandbyDashboard> createState() => _StandbyDashboardState();
}

class _StandbyDashboardState extends State<StandbyDashboard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final autopsy = widget.autopsy;
    final profile = widget.profile;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GameCard(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        AnimatedBuilder(
                          animation: _pulseCtrl,
                          builder: (_, child) => Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: colors.magicSubtle,
                              border: Border.all(
                                color: colors.magic.withValues(
                                  alpha: 0.3 + _pulseCtrl.value * 0.4,
                                ),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: colors.magic.withValues(
                                    alpha: _pulseCtrl.value * 0.25,
                                  ),
                                  blurRadius: 16,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: child,
                          ),
                          child: Icon(
                            Icons.radar_rounded,
                            size: 22,
                            color: colors.magic,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'STANDBY',
                                style: AppTextStyles.eyebrow.copyWith(
                                  color: colors.magic,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Ready to coach',
                                style: AppTextStyles.title,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const _StepRow(
                      done: true,
                      text: 'Core connected',
                    ),
                    const SizedBox(height: 14),
                    const _StepRow(
                      done: false,
                      text: 'Start a League of Legends match',
                    ),
                    const SizedBox(height: 14),
                    const _StepRow(
                      done: false,
                      text: 'Advice appears automatically as the match unfolds',
                    ),
                    if (profile != null && profile.gamesTracked > 0) ...[
                      const SizedBox(height: 20),
                      HabitBenchmarksStrip(profile: profile),
                    ],
                  ],
                ),
              ),
              if (autopsy != null) ...[
                const SizedBox(height: 16),
                PostGameAutopsyCard(autopsy: autopsy),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class HabitBenchmarksStrip extends StatelessWidget {
  const HabitBenchmarksStrip({required this.profile, super.key});

  final PlayerHabitProfile profile;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.hairlineSoft),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _MetricCol(
            label: 'GAMES',
            value: '${profile.gamesTracked}',
            color: colors.textPrimary,
          ),
          _MetricCol(
            label: 'AVG CS/M',
            value: '${profile.avgCsPerMin}',
            color: colors.gold,
          ),
          _MetricCol(
            label: 'EARLY DEATHS',
            value: '${profile.earlyDeathRate}/g',
            color: profile.earlyDeathRate > 0.8
                ? colors.errorLight
                : colors.success,
          ),
        ],
      ),
    );
  }
}

class _MetricCol extends StatelessWidget {
  const _MetricCol({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: AppTextStyles.micro.copyWith(
            color: context.colors.textDisabled,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTextStyles.mono.copyWith(
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class PostGameAutopsyCard extends StatelessWidget {
  const PostGameAutopsyCard({required this.autopsy, super.key});

  final PostGameAutopsy autopsy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      accent: colors.magicLine,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'LAST MATCH AUTOPSY',
                style: AppTextStyles.eyebrow.copyWith(color: colors.magic),
              ),
              const Spacer(),
              Text(
                '${autopsy.championName} · ${autopsy.kda} · ${autopsy.csPerMin} CS/m',
                style: AppTextStyles.mono.copyWith(
                  color: colors.textSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.check_circle_outline, size: 16, color: colors.success),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  autopsy.praise,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          for (final mistake in autopsy.mistakes) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.trending_up_rounded,
                  size: 16,
                  color: colors.gold,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    mistake,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.done, required this.text});
  final bool done;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = done ? colors.success : colors.textDisabled;
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? colors.successSubtle : Colors.transparent,
            border: Border.all(color: color, width: 1.5),
          ),
          child: done ? Icon(Icons.check, size: 12, color: color) : null,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: AppTextStyles.body.copyWith(
              color: done ? colors.textPrimary : colors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
