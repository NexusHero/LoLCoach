// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';

/// Tri-Modal Tactical Comms Bar ('F1 Race Engineer'):
/// 1. Hands-Free Voice / TTS Toggle
/// 2. 1-Click Quick-Callout Pills for mouse-click players (Flash, Ult, Camped, Swap)
/// 3. Active Context Override Chips (1-click removable)
/// 4. F1-Radio Response Banner + Action Execution Pills
/// 5. Compact Command / Question input
class TacticalCommsBar extends StatefulWidget {
  const TacticalCommsBar({
    required this.onSendCommand,
    super.key,
    this.gameState,
    this.tacticalInsights,
    this.lastExchange,
    this.onClearOverride,
    this.voiceEnabled = false,
    this.onVoiceToggled,
  });

  final ParsedGameState? gameState;
  final TacticalInsights? tacticalInsights;
  final CoachExchange? lastExchange;
  final ValueChanged<String> onSendCommand;
  final ValueChanged<String>? onClearOverride;
  final bool voiceEnabled;
  final ValueChanged<bool>? onVoiceToggled;

  @override
  State<TacticalCommsBar> createState() => _TacticalCommsBarState();
}

class _TacticalCommsBarState extends State<TacticalCommsBar> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSendCommand(text);
    _controller.clear();
  }

  String get _currentOpponent {
    final ov = widget.tacticalInsights?.liveOverrides?.laneOpponentOverride;
    if (ov != null && ov.isNotEmpty) return ov;
    final cds = widget.tacticalInsights?.enemyCooldowns?.championName;
    if (cds != null && cds.isNotEmpty) return cds;
    final enemies = widget.gameState?.enemies ?? const [];
    return enemies.isNotEmpty ? enemies.first.championName : 'Enemy';
  }

  String? get _nextSwapCandidate {
    final enemies = widget.gameState?.enemies ?? const [];
    if (enemies.length < 2) return null;
    final idx = enemies.indexWhere((e) => e.championName == _currentOpponent);
    return enemies[(idx + 1) % enemies.length].championName;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final exchange =
        widget.lastExchange ?? widget.tacticalInsights?.lastCoachExchange;
    final overrides = widget.tacticalInsights?.liveOverrides;
    final opp = _currentOpponent;
    final swapTarget = _nextSwapCandidate;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(color: colors.border),
    );

    return GameCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (exchange != null) ...[
            _RadioReplyBanner(exchange: exchange),
            const SizedBox(height: 10),
          ],
          if (overrides != null && overrides.hasAny) ...[
            _ActiveOverridesStrip(
              overrides: overrides,
              onClear: widget.onClearOverride,
            ),
            const SizedBox(height: 10),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _VoiceToggleButton(
                enabled: widget.voiceEnabled,
                onTap: () => widget.onVoiceToggled?.call(!widget.voiceEnabled),
              ),
              _QuickCalloutPill(
                icon: Icons.flash_on_rounded,
                label: '$opp Flash',
                accent: colors.gold,
                onTap: () => widget.onSendCommand('$opp Flash'),
              ),
              _QuickCalloutPill(
                icon: Icons.bolt_rounded,
                label: '$opp Ult',
                accent: colors.cyan,
                onTap: () => widget.onSendCommand('$opp R'),
              ),
              _QuickCalloutPill(
                icon: Icons.shield_outlined,
                label: 'Camped',
                accent: colors.errorLight,
                onTap: () => widget.onSendCommand('Ich werde gecampt'),
              ),
              if (swapTarget != null)
                _QuickCalloutPill(
                  icon: Icons.swap_horiz_rounded,
                  label: 'Swap → $swapTarget',
                  accent: colors.magic,
                  onTap: () => widget.onSendCommand('Swap $swapTarget'),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 36,
                  child: TextField(
                    controller: _controller,
                    onSubmitted: (_) => _submit(),
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText:
                          'Callout or ask Coach (e.g. "$opp Flash", "Kaisa AP", "Merk dir: ...")',
                      hintStyle: AppTextStyles.caption.copyWith(
                        color: colors.textDisabled,
                      ),
                      filled: true,
                      fillColor: colors.surface2,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      border: border,
                      enabledBorder: border,
                      focusedBorder: border.copyWith(
                        borderSide: BorderSide(color: colors.magic),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              MouseRegion(
                cursor: SystemMouseCursors.click,
                child: GestureDetector(
                  onTap: _submit,
                  child: Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colors.magicSubtle,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: colors.magicLine),
                    ),
                    child: Text(
                      'SEND',
                      style: AppTextStyles.micro.copyWith(
                        color: colors.magic,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
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

class _RadioReplyBanner extends StatelessWidget {
  const _RadioReplyBanner({required this.exchange});
  final CoachExchange exchange;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.magicLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.headset_mic_rounded, size: 14, color: colors.magic),
              const SizedBox(width: 6),
              Text(
                'RACE ENGINEER RADIO',
                style: AppTextStyles.micro.copyWith(
                  color: colors.magic,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                '"${exchange.userText}"',
                style: AppTextStyles.micro.copyWith(color: colors.textDisabled),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            exchange.replyText,
            style: AppTextStyles.bodyBold.copyWith(color: colors.textPrimary),
          ),
          if (exchange.actionsExecuted.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                for (final act in exchange.actionsExecuted)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: colors.cyan.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: colors.cyan.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Text(
                      act,
                      style: AppTextStyles.micro.copyWith(
                        color: colors.cyan,
                        fontWeight: FontWeight.w700,
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

class _ActiveOverridesStrip extends StatelessWidget {
  const _ActiveOverridesStrip({required this.overrides, this.onClear});
  final LiveTacticalOverrides overrides;
  final ValueChanged<String>? onClear;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final chips = <(String, String)>[
      if (overrides.laneOpponentOverride?.isNotEmpty ?? false)
        ('laneOpponent', '🔄 Lane vs ${overrides.laneOpponentOverride}'),
      if (overrides.campedStatus != null && overrides.campedStatus != 'normal')
        ('campedStatus', '⛺ ${overrides.campedStatus!.toUpperCase()}'),
      for (final e in overrides.enemyBuildOverrides.entries)
        ('enemyBuild:${e.key}', '🎯 ${e.key} = ${e.value.toUpperCase()}'),
      for (final t in overrides.activeTimers)
        ('timer:${t.key}', '⏱ ${t.championName} ${t.label} (${t.remainingSeconds}s)'),
      for (final n in overrides.tacticalNotes) ('note:$n', '📌 $n'),
    ];

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final c in chips)
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: GestureDetector(
              onTap: () => onClear?.call(c.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.goldSubtle,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.champagneLine),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      c.$2,
                      style: AppTextStyles.micro.copyWith(
                        color: colors.gold,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.close_rounded, size: 11, color: colors.gold),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _VoiceToggleButton extends StatelessWidget {
  const _VoiceToggleButton({required this.enabled, required this.onTap});
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = enabled ? colors.success : colors.textSecondary;
    return _QuickCalloutPill(
      icon: enabled ? Icons.mic_rounded : Icons.mic_none_rounded,
      label: enabled ? 'VOICE ON' : 'VOICE TTS',
      accent: accent,
      onTap: onTap,
    );
  }
}

class _QuickCalloutPill extends StatelessWidget {
  const _QuickCalloutPill({
    required this.icon,
    required this.label,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          decoration: BoxDecoration(
            color: colors.surface2,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: accent.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: accent),
              const SizedBox(width: 4),
              Text(
                label,
                style: AppTextStyles.micro.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
