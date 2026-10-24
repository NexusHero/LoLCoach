// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/common/risk_control.dart';

/// The pinned HUD telemetry strip: game time · gold to spend · your champion + KDA,
/// with the risk control integrated inline or beneath, plus an integrated
/// manual refresh button when in-game.
class GameTopBar extends StatelessWidget {
  const GameTopBar({
    required this.gameState,
    super.key,
    this.riskLevel,
    this.onRiskLevelChanged,
    this.onRefresh,
    this.isAnalyzing = false,
  });
  final ParsedGameState gameState;

  /// Both null when no AI provider is active — the risk control only makes
  /// sense when an LLM is actually shaping the recommendation.
  final String? riskLevel;
  final ValueChanged<String>? onRiskLevelChanged;
  final VoidCallback? onRefresh;
  final bool isAnalyzing;

  String _fmt(double sec) {
    final m = (sec / 60).floor();
    final s = (sec % 60).floor();
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final local = gameState.localPlayer;
    final gold = gameState.activePlayer.currentGold.toInt();
    final hasRisk = riskLevel != null && onRiskLevelChanged != null;

    return GameCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      radius: 14,
      child: Wrap(
        spacing: 12,
        runSpacing: 10,
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _HudPill(
                icon: Icons.schedule_rounded,
                iconColor: colors.textSecondary,
                label: _fmt(gameState.gameTime),
                textColor: colors.textPrimary,
              ),
              const SizedBox(width: 8),
              _HudPill(
                icon: Icons.monetization_on_outlined,
                iconColor: colors.gold,
                label: '${gold}g',
                textColor: colors.gold,
                bgColor: colors.goldSubtle,
                borderColor: colors.champagneLine,
              ),
              const SizedBox(width: 12),
              ChampAvatar(
                name: local.championName,
                isDead: local.isDead,
                size: 24,
              ),
              const SizedBox(width: 8),
              _Kda(scores: local.scores),
            ],
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (hasRisk)
                RiskControl(
                  value: riskLevel!,
                  onChanged: onRiskLevelChanged!,
                ),
              if (hasRisk && onRefresh != null) const SizedBox(width: 10),
              if (onRefresh != null)
                _RefreshHudButton(
                  onPressed: isAnalyzing ? null : onRefresh,
                  isAnalyzing: isAnalyzing,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HudPill extends StatelessWidget {
  const _HudPill({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.textColor,
    this.bgColor,
    this.borderColor,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final Color textColor;
  final Color? bgColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor ?? colors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor ?? colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: iconColor),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTextStyles.mono.copyWith(color: textColor),
          ),
        ],
      ),
    );
  }
}

class _RefreshHudButton extends StatelessWidget {
  const _RefreshHudButton({
    required this.onPressed,
    required this.isAnalyzing,
  });

  final VoidCallback? onPressed;
  final bool isAnalyzing;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Tooltip(
      message: 'Manually refresh advice',
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(100),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: colors.magicSubtle,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: colors.magicLine),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isAnalyzing)
                SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.8,
                    color: colors.magic,
                  ),
                )
              else
                Icon(Icons.bolt_rounded, size: 14, color: colors.magic),
              const SizedBox(width: 5),
              Text(
                isAnalyzing ? 'Analysing…' : 'Refresh',
                style: AppTextStyles.micro.copyWith(
                  color: colors.magic,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Kda extends StatelessWidget {
  const _Kda({required this.scores});
  final PlayerScores scores;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sep = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Text(
        '/',
        style: AppTextStyles.mono.copyWith(color: colors.textDisabled),
      ),
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${scores.kills}',
          style: AppTextStyles.mono.copyWith(color: colors.success),
        ),
        sep,
        Text(
          '${scores.deaths}',
          style: AppTextStyles.mono.copyWith(color: colors.error),
        ),
        sep,
        Text(
          '${scores.assists}',
          style: AppTextStyles.mono.copyWith(color: colors.textPrimary),
        ),
      ],
    );
  }
}
