// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';

/// Priority-Capped Macro Alert Strip (max 2 pills) + Objective Timers +
/// Enemy Comp & Counter-Matrix row.
class MacroAlertStrip extends StatelessWidget {
  const MacroAlertStrip({
    required this.insights,
    super.key,
  });

  final TacticalInsights insights;

  @override
  Widget build(BuildContext context) {
    final alerts = insights.macroAlerts.take(2).toList();
    final objectives = insights.objectives;
    final threat = insights.primaryThreat;
    final dmg = insights.teamDamageProfile;
    final hasCounterFlags =
        dmg.heavyHealing || dmg.armorStacking || dmg.mrStacking;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (alerts.isNotEmpty) ...[
          Row(
            children: [
              for (var i = 0; i < alerts.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(child: _MacroAlertPill(alert: alerts[i])),
              ],
            ],
          ),
          const SizedBox(height: 8),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _EnemyCompMatrixChip(profile: dmg),
            if (dmg.heavyHealing)
              const _CounterTagPill(
                label: 'HEAVY HEAL → BUY ANTI-HEAL',
                isWarning: true,
              ),
            if (dmg.armorStacking)
              const _CounterTagPill(
                label: 'ARMOR STACK → BUY %PEN',
                isWarning: false,
              ),
            if (dmg.mrStacking)
              const _CounterTagPill(
                label: 'MR STACK → BUY VOID/MPEN',
                isWarning: false,
              ),
            for (final obj in objectives) _ObjectiveTimerChip(timer: obj),
            if (threat != null) _PrimaryThreatChip(threat: threat),
            if (!hasCounterFlags && objectives.isEmpty && threat == null)
              const SizedBox.shrink(),
          ],
        ),
      ],
    );
  }
}

class _MacroAlertPill extends StatefulWidget {
  const _MacroAlertPill({required this.alert});

  final MacroAlert alert;

  @override
  State<_MacroAlertPill> createState() => _MacroAlertPillState();
}

class _MacroAlertPillState extends State<_MacroAlertPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2100),
    );
    _pulse = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: 1), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1, end: 0.2), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.2, end: 1), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 1, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    if (widget.alert.priority == 'critical') {
      _pulseCtrl.forward(from: 0);
    }
  }

  @override
  void didUpdateWidget(_MacroAlertPill oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.alert.id != oldWidget.alert.id &&
        widget.alert.priority == 'critical') {
      _pulseCtrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final alert = widget.alert;
    final (Color accent, Color bg, IconData icon) = switch (alert.priority) {
      'critical' => (
          colors.errorLight,
          colors.errorSubtle,
          Icons.warning_amber_rounded,
        ),
      'warning' => (
          colors.gold,
          colors.goldSubtle,
          Icons.timer_outlined,
        ),
      _ => (
          colors.cyan,
          colors.surface2,
          Icons.savings_outlined,
        ),
    };

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final glow = alert.priority == 'critical' ? _pulse.value : 0.0;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: accent.withValues(alpha: 0.45 + glow * 0.55),
              width: 1 + glow * 1.2,
            ),
            boxShadow: glow > 0
                ? [
                    BoxShadow(
                      color: accent.withValues(alpha: glow * 0.45),
                      blurRadius: 18 * glow,
                      spreadRadius: 1.5 * glow,
                    ),
                  ]
                : null,
          ),
          child: child,
        );
      },
      child: Row(
        children: [
          Icon(icon, size: 16, color: accent),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.title,
                  style: AppTextStyles.micro.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  alert.detail,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EnemyCompMatrixChip extends StatelessWidget {
  const _EnemyCompMatrixChip({required this.profile});

  final TeamDamageProfile profile;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'COMP ${profile.adPercent}% AD',
            style: AppTextStyles.mono.copyWith(
              color: colors.warning,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            width: 36,
            height: 5,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: Row(
                children: [
                  Expanded(
                    flex: profile.adPercent.clamp(5, 95),
                    child: Container(color: colors.warning),
                  ),
                  Expanded(
                    flex: profile.apPercent.clamp(5, 95),
                    child: Container(color: colors.magic),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${profile.apPercent}% AP',
            style: AppTextStyles.mono.copyWith(
              color: colors.magic,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CounterTagPill extends StatelessWidget {
  const _CounterTagPill({required this.label, required this.isWarning});

  final String label;
  final bool isWarning;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = isWarning ? colors.gold : colors.cyan;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: AppTextStyles.micro.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _ObjectiveTimerChip extends StatelessWidget {
  const _ObjectiveTimerChip({required this.timer});

  final ObjectiveTimer timer;

  String _fmtCountdown(int sec) {
    if (sec <= 0) return 'ALIVE';
    final m = sec ~/ 60;
    final s = sec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isSoon = timer.status == 'spawning_soon';
    final isAlive = timer.status == 'alive';
    final color = isSoon
        ? colors.gold
        : isAlive
            ? colors.success
            : colors.textSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isSoon ? colors.champagneLine : colors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.shield_moon_outlined,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 5),
          Text(
            '${timer.label}: ${_fmtCountdown(timer.secondsUntilSpawn)}',
            style: AppTextStyles.mono.copyWith(
              color: color,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryThreatChip extends StatelessWidget {
  const _PrimaryThreatChip({required this.threat});

  final PrimaryThreat threat;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: colors.errorSubtle,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.error.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.gps_fixed_rounded, size: 12, color: colors.errorLight),
          const SizedBox(width: 5),
          Text(
            'Fed Threat: ${threat.championName} (${threat.reason})',
            style: AppTextStyles.micro.copyWith(
              color: colors.errorLight,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
