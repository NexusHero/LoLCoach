import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/strategy.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/models/token_usage.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/ai_sweeping_border.dart';
import 'package:lol_coach/widgets/common/badge.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/recommendation/recommendation_item_rows.dart';
import 'package:lol_coach/widgets/recommendation/recommendation_meta_strips.dart';

/// The in-game hero: the single "do this now" recommendation, rendered as the
/// app's one striking glass card.
class RecommendationPanel extends StatefulWidget {
  const RecommendationPanel({
    required this.recommendation,
    super.key,
    this.tacticalInsights,
    this.triggerEvent,
    this.localChampion,
    this.opponentChampion,
    this.isAnalyzing = false,
    this.recommendationTime,
    this.tokenUsage,
    this.tokenBudget = 0,
    this.isBudgetExceeded = false,
  });

  final ItemRecommendation recommendation;
  final TacticalInsights? tacticalInsights;
  final String? triggerEvent;
  final String? localChampion;
  final String? opponentChampion;
  final bool isAnalyzing;
  final DateTime? recommendationTime;
  final TokenUsage? tokenUsage;
  final int tokenBudget;
  final bool isBudgetExceeded;

  @override
  State<RecommendationPanel> createState() => _RecommendationPanelState();
}

class _RecommendationPanelState extends State<RecommendationPanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _flash;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _flash = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _syncTicker();
  }

  @override
  void didUpdateWidget(RecommendationPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final t = widget.recommendationTime;
    if (t != null && t != oldWidget.recommendationTime) {
      _flash.forward(from: 0);
    }
    _syncTicker();
  }

  void _syncTicker() {
    final needed = widget.recommendationTime != null;
    if (needed && _ticker == null) {
      _ticker = Timer.periodic(const Duration(seconds: 5), (_) {
        if (mounted) setState(() {});
      });
    } else if (!needed) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _flash.dispose();
    super.dispose();
  }

  String _timeAgo() {
    if (widget.recommendationTime == null) return '';
    final diff = DateTime.now().difference(widget.recommendationTime!);
    if (diff.inSeconds < 10) return 'just now';
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  String get _heroAction {
    final s = widget.recommendation.strategy;
    final action = s?.immediateAction.trim();
    if (action != null && action.isNotEmpty) return action;
    final summary = s?.summary.trim();
    if (summary != null && summary.isNotEmpty) return summary;
    return widget.recommendation.reasoning;
  }

  RecommendedItem? get _heroItem {
    final items = widget.recommendation.items;
    if (items.isEmpty) return null;
    return items.firstWhere(
      (i) => i.isCore,
      orElse: () => items.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    final rec = widget.recommendation;
    final colors = context.colors;
    final isLlm = rec.isLlm;
    final accent = isLlm ? colors.magic : colors.textSecondary;
    final hero = _heroItem;
    final strategy = rec.strategy;
    final rest = rec.items.where((i) => i != hero).toList();
    final nextBuy = widget.tacticalInsights?.nextBestBuy;
    final enemyCds = widget.tacticalInsights?.enemyCooldowns;

    final card = GameCard(
      accent: isLlm ? colors.magic : null,
      glow: isLlm,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Eyebrow(
            label: isLlm ? 'DO THIS NOW' : 'SUGGESTED',
            color: accent,
            trailing: widget.isAnalyzing ? _UpdatingChip(color: accent) : null,
          ),
          const SizedBox(height: 12),
          Text(_heroAction, style: AppTextStyles.hero),
          if (nextBuy != null) ...[
            const SizedBox(height: 14),
            NextBestBuyBanner(buy: nextBuy),
          ],
          if (hero != null) ...[
            const SizedBox(height: 14),
            HeroRecommendationItem(item: hero, accent: accent, isLlm: isLlm),
          ],
          if (rest.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (var idx = 0; idx < rest.length; idx++)
              SecondaryRecommendationItem(
                item: rest[idx],
                stepIndex: idx + 2,
                isLast: idx == rest.length - 1,
                accentColor: accent,
              ),
          ],
          if (strategy != null || widget.opponentChampion != null) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (strategy != null)
                  AppBadge.champagne('• ${_winLabel(strategy.winCondition)}'),
                if (widget.opponentChampion != null)
                  MatchupDuelChip(
                    localChampion: widget.localChampion,
                    opponentChampion: widget.opponentChampion!,
                  ),
              ],
            ),
          ],
          if (enemyCds != null) ...[
            const SizedBox(height: 12),
            EnemyCooldownsStrip(cooldowns: enemyCds),
          ],
          if (strategy?.laneMatchupAnalysis != null ||
              strategy?.counterPlay != null) ...[
            const SizedBox(height: 12),
            StrategyLinesBlock(strategy: strategy!),
          ],
          RecommendationFooter(
            timeAgo: _timeAgo(),
            usage: widget.tokenUsage,
            budget: widget.tokenBudget,
            exceeded: widget.isBudgetExceeded,
          ),
        ],
      ),
    );

    final flashColor = isLlm ? colors.magic : colors.gold;
    final withFlash = AnimatedBuilder(
      animation: _flash,
      builder: (context, child) {
        final v = 1.0 - Curves.easeOut.transform(_flash.value);
        return Stack(
          children: [
            child!,
            if (v > 0)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: flashColor.withValues(alpha: v),
                        width: 2.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: flashColor.withValues(alpha: v * 0.5),
                          blurRadius: 28,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
      child: card,
    );

    if (!isLlm) return withFlash;

    return AiSweepingBorder(
      strokeWidth: 2.5,
      sweepFraction: 0.32,
      duration: const Duration(milliseconds: 1600),
      child: withFlash,
    );
  }
}

String _winLabel(WinCondition w) => switch (w) {
      WinCondition.early => 'Early-game win',
      WinCondition.mid => 'Mid-game win',
      WinCondition.late => 'Late-game win',
    };

class _Eyebrow extends StatelessWidget {
  const _Eyebrow({required this.label, required this.color, this.trailing});
  final String label;
  final Color color;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 14,
          height: 1.5,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(label, style: AppTextStyles.eyebrow.copyWith(color: color)),
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class _UpdatingChip extends StatelessWidget {
  const _UpdatingChip({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 10,
          height: 10,
          child: CircularProgressIndicator(strokeWidth: 1.6, color: color),
        ),
        const SizedBox(width: 6),
        Text('Updating…', style: AppTextStyles.micro.copyWith(color: color)),
      ],
    );
  }
}
