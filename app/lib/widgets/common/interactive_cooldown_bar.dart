import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/game_card.dart';

/// Interactive 1-Click Q/W/E/R + Summoner Spell (D/F) Cooldown Grid.
/// Works 100% passively (showing haste-adjusted CDs & key threat highlight)
/// AND supports 1-click mouse tracking (click any spell to start countdown,
/// click again to reset).
class InteractiveCooldownGrid extends StatefulWidget {
  const InteractiveCooldownGrid({
    required this.cooldowns,
    super.key,
    this.compact = false,
    this.activeTimers = const [],
  });

  final EnemyCooldowns cooldowns;
  final bool compact;
  final List<ActiveSpellTimer> activeTimers;

  @override
  State<InteractiveCooldownGrid> createState() =>
      _InteractiveCooldownGridState();
}

class _InteractiveCooldownGridState extends State<InteractiveCooldownGrid> {
  final Map<String, int> _remainingSeconds = {};
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _syncBackendTimers();
  }

  @override
  void didUpdateWidget(InteractiveCooldownGrid oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.cooldowns.championName != widget.cooldowns.championName) {
      _remainingSeconds.clear();
      _stopTickerIfIdle();
    }
    _syncBackendTimers();
  }

  void _syncBackendTimers() {
    final champ = widget.cooldowns.championName.toLowerCase();
    for (final t in widget.activeTimers) {
      if (t.championName.toLowerCase() != champ || t.remainingSeconds <= 0) {
        continue;
      }
      final labelUpper = t.label.toUpperCase();
      if (['Q', 'W', 'E', 'R'].contains(labelUpper)) {
        _remainingSeconds[labelUpper] = t.remainingSeconds;
      } else {
        final sumIdx = widget.cooldowns.summonerSpells.indexWhere(
          (s) => s.name.toUpperCase() == labelUpper,
        );
        if (sumIdx >= 0) {
          _remainingSeconds['SUM_$sumIdx'] = t.remainingSeconds;
        }
      }
    }
    _ensureTicker();
  }

  void _toggleTimer(String key, int maxSeconds) {
    if (maxSeconds <= 0) return;
    setState(() {
      if (_remainingSeconds.containsKey(key)) {
        _remainingSeconds.remove(key);
      } else {
        _remainingSeconds[key] = maxSeconds;
      }
      _ensureTicker();
    });
  }

  void _ensureTicker() {
    if (_remainingSeconds.isNotEmpty && _ticker == null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() {
          final expired = <String>[];
          for (final entry in _remainingSeconds.entries) {
            final next = entry.value - 1;
            if (next <= 0) {
              expired.add(entry.key);
            } else {
              _remainingSeconds[entry.key] = next;
            }
          }
          expired.forEach(_remainingSeconds.remove);
          _stopTickerIfIdle();
        });
      });
    } else {
      _stopTickerIfIdle();
    }
  }

  void _stopTickerIfIdle() {
    if (_remainingSeconds.isEmpty && _ticker != null) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _formatSec(int sec) {
    if (sec >= 100) {
      final m = sec ~/ 60;
      final s = sec % 60;
      return '$m:${s.toString().padLeft(2, '0')}';
    }
    return '${sec}s';
  }

  @override
  Widget build(BuildContext context) {
    final cds = widget.cooldowns;
    final spells = <(String, int)>[
      ('Q', cds.q),
      ('W', cds.w),
      ('E', cds.e),
      ('R', cds.r),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (var i = 0; i < spells.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: _SpellTimerTile(
                  slotKey: spells[i].$1,
                  label: spells[i].$1,
                  maxSeconds: spells[i].$2,
                  remainingSeconds: _remainingSeconds[spells[i].$1],
                  isKeyThreat: cds.keyThreatSpell == spells[i].$1,
                  isSummoner: false,
                  compact: widget.compact,
                  formattedTime: _formatSec(
                    _remainingSeconds[spells[i].$1] ?? spells[i].$2,
                  ),
                  onTap: () => _toggleTimer(spells[i].$1, spells[i].$2),
                ),
              ),
            ],
          ],
        ),
        if (cds.summonerSpells.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 0; i < cds.summonerSpells.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: _SpellTimerTile(
                    slotKey: 'SUM_$i',
                    label: cds.summonerSpells[i].name.toUpperCase(),
                    maxSeconds: cds.summonerSpells[i].cooldown,
                    remainingSeconds: _remainingSeconds['SUM_$i'],
                    isKeyThreat: false,
                    isSummoner: true,
                    compact: widget.compact,
                    formattedTime: _formatSec(
                      _remainingSeconds['SUM_$i'] ??
                          cds.summonerSpells[i].cooldown,
                    ),
                    onTap: () => _toggleTimer(
                      'SUM_$i',
                      cds.summonerSpells[i].cooldown,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _SpellTimerTile extends StatelessWidget {
  const _SpellTimerTile({
    required this.slotKey,
    required this.label,
    required this.maxSeconds,
    required this.remainingSeconds,
    required this.isKeyThreat,
    required this.isSummoner,
    required this.compact,
    required this.formattedTime,
    required this.onTap,
  });

  final String slotKey;
  final String label;
  final int maxSeconds;
  final int? remainingSeconds;
  final bool isKeyThreat;
  final bool isSummoner;
  final bool compact;
  final String formattedTime;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isActive = remainingSeconds != null;
    final borderColor = isActive
        ? colors.gold
        : isKeyThreat
            ? colors.cyan.withValues(alpha: 0.7)
            : isSummoner
                ? colors.champagneLine
                : colors.border;
    final bgColor = isActive
        ? colors.goldSubtle
        : isKeyThreat
            ? colors.cyan.withValues(alpha: 0.1)
            : colors.surface2;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            vertical: compact ? 7 : 10,
            horizontal: 6,
          ),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: borderColor,
              width: isActive || isKeyThreat ? 1.4 : 1.0,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      isActive ? '$label CD' : label,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.micro.copyWith(
                        color: isActive
                            ? colors.gold
                            : isKeyThreat
                                ? colors.cyan
                                : colors.textDisabled,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (isKeyThreat && !isActive) ...[
                    const SizedBox(width: 3),
                    Icon(Icons.bolt_rounded, size: 11, color: colors.cyan),
                  ],
                ],
              ),
              const SizedBox(height: 3),
              Text(
                formattedTime,
                style: AppTextStyles.mono.copyWith(
                  color: isActive ? colors.gold : colors.textPrimary,
                  fontSize: compact ? 13 : 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Full Pro HUD Cooldown & Vulnerability Card.
class ProCooldownCard extends StatelessWidget {
  const ProCooldownCard({
    required this.cooldowns,
    super.key,
    this.counterPlay,
    this.activeTimers = const [],
  });

  final EnemyCooldowns cooldowns;
  final String? counterPlay;
  final List<ActiveSpellTimer> activeTimers;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return GameCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ChampAvatar(
                name: cooldowns.championName,
                isDead: false,
                size: 28,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${cooldowns.championName.toUpperCase()} COOLDOWNS '
                  '(LV ${cooldowns.level} · ${cooldowns.abilityHaste} AH)',
                  style: AppTextStyles.eyebrow.copyWith(color: colors.cyan),
                ),
              ),
              Text(
                '1-CLICK TRACK',
                style: AppTextStyles.micro.copyWith(
                  color: colors.textDisabled,
                  fontSize: 9,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          InteractiveCooldownGrid(
            cooldowns: cooldowns,
            activeTimers: activeTimers,
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colors.surface2,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: colors.cyan.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                Icon(Icons.bolt_rounded, size: 16, color: colors.cyan),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    cooldowns.keyThreatSummary,
                    style: AppTextStyles.bodyBold.copyWith(color: colors.cyan),
                  ),
                ),
              ],
            ),
          ),
          if (counterPlay != null && counterPlay!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'COUNTER: $counterPlay',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
