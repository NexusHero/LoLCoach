// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/utils/ddragon.dart';
import 'package:lol_coach/widgets/common/badge.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/common/item_row.dart';
import 'package:lol_coach/widgets/common/kda_stats.dart';

class LocalPlayerCard extends StatefulWidget {
  const LocalPlayerCard({
    required this.player,
    required this.activePlayer,
    super.key,
  });
  final Player player;
  final ActivePlayer activePlayer;

  @override
  State<LocalPlayerCard> createState() => _LocalPlayerCardState();
}

class _LocalPlayerCardState extends State<LocalPlayerCard> {
  bool _showAllStats = false;

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final activePlayer = widget.activePlayer;
    final scores = player.scores;
    final stats = activePlayer.championStats;
    final isApChamp = stats.abilityPower >= stats.attackDamage;
    final colors = context.colors;

    return GameCard(
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          if (player.championName.isNotEmpty)
            Positioned(
              top: 0,
              right: 0,
              bottom: 0,
              width: 220,
              child: IgnorePointer(
                child: ShaderMask(
                  shaderCallback: (rect) => const LinearGradient(
                    colors: [Colors.transparent, Colors.white],
                    stops: [0.05, 1.0],
                  ).createShader(rect),
                  blendMode: BlendMode.dstIn,
                  child: Opacity(
                    opacity: 0.16,
                    child: Image.network(
                      champSplashUrl(player.championName),
                      fit: BoxFit.cover,
                      alignment: Alignment.topRight,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ChampAvatar(
                      name: player.championName,
                      isDead: player.isDead,
                      size: 50,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  player.championName,
                                  style: AppTextStyles.heading,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              AppBadge.violet('Lv ${player.level}'),
                              if (player.position.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                AppBadge.neutral(player.position.toUpperCase()),
                              ],
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              KdaNum('${scores.kills}', colors.success),
                              const KdaSep(),
                              KdaNum('${scores.deaths}', colors.errorLight),
                              const KdaSep(),
                              KdaNum('${scores.assists}', colors.textPrimary),
                              const SizedBox(width: 14),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: colors.surface2,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'CS ${scores.creepScore}',
                                  style: AppTextStyles.mono.copyWith(
                                    color: colors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatChip(
                      'HP',
                      '${stats.healthMax.toInt()}',
                      colors.success,
                      progress: stats.healthMax / 4000,
                    ),
                    if (isApChamp)
                      StatChip(
                        'AP',
                        '${stats.abilityPower.toInt()}',
                        colors.magic,
                        progress: stats.abilityPower / 700,
                      )
                    else
                      StatChip(
                        'AD',
                        '${stats.attackDamage.toInt()}',
                        colors.warning,
                        progress: stats.attackDamage / 400,
                      ),
                    StatChip(
                      'ARM',
                      '${stats.armor.toInt()}',
                      colors.gold,
                      progress: stats.armor / 300,
                    ),
                    StatChip(
                      'MR',
                      '${stats.magicResist.toInt()}',
                      colors.cyan,
                      progress: stats.magicResist / 250,
                    ),
                    if (_showAllStats) ...[
                      if (isApChamp)
                        StatChip(
                          'AD',
                          '${stats.attackDamage.toInt()}',
                          colors.warning,
                          progress: stats.attackDamage / 400,
                        )
                      else
                        StatChip(
                          'AP',
                          '${stats.abilityPower.toInt()}',
                          colors.magic,
                          progress: stats.abilityPower / 700,
                        ),
                      StatChip(
                        'CRIT',
                        '${(stats.critChance * 100).toInt()}%',
                        colors.errorLight,
                        progress: stats.critChance,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (player.items.isNotEmpty)
                      Expanded(child: ItemRow(items: player.items))
                    else
                      const Spacer(),
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 4,
                        ),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () =>
                          setState(() => _showAllStats = !_showAllStats),
                      child: Text(
                        _showAllStats ? 'Less' : 'More stats',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.magic,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
