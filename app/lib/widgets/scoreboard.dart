// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/champ_avatar.dart';
import 'package:lol_coach/widgets/common/game_card.dart';

class ScoreboardSection extends StatefulWidget {
  const ScoreboardSection({
    required this.allies,
    required this.enemies,
    required this.localPlayer,
    this.initiallyExpanded = false,
    super.key,
  });
  final List<Player> allies;
  final List<Player> enemies;
  final Player localPlayer;
  final bool initiallyExpanded;

  @override
  State<ScoreboardSection> createState() => _ScoreboardSectionState();
}

class _ScoreboardSectionState extends State<ScoreboardSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  int _teamKills(Iterable<Player> players) =>
      players.fold(0, (sum, p) => sum + p.scores.kills);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final allAllies = [widget.localPlayer, ...widget.allies];
    final allyKills = _teamKills(allAllies);
    final enemyKills = _teamKills(widget.enemies);
    final totalKills = allyKills + enemyKills;
    final allyRatio = totalKills == 0 ? 0.5 : allyKills / totalKills;

    return GameCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        'Scoreboard',
                        style: AppTextStyles.captionBold.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '$allyKills',
                        style: AppTextStyles.mono.copyWith(
                          color: colors.allyBlue,
                        ),
                      ),
                      Text(
                        ' – ',
                        style: AppTextStyles.mono.copyWith(
                          color: colors.textDisabled,
                        ),
                      ),
                      Text(
                        '$enemyKills',
                        style: AppTextStyles.mono.copyWith(
                          color: colors.enemyRed,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Icon(
                        _expanded ? Icons.expand_less : Icons.expand_more,
                        color: colors.textDisabled,
                        size: 20,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Tug-of-war team kills bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: SizedBox(
                      height: 4,
                      child: Row(
                        children: [
                          Expanded(
                            flex: (allyRatio * 100).round().clamp(5, 95),
                            child: ColoredBox(
                              color: colors.allyBlue,
                              child: const SizedBox.expand(),
                            ),
                          ),
                          const SizedBox(width: 2),
                          Expanded(
                            flex: ((1 - allyRatio) * 100).round().clamp(5, 95),
                            child: ColoredBox(
                              color: colors.enemyRed,
                              child: const SizedBox.expand(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            Divider(color: colors.hairlineSoft, height: 1),
            LayoutBuilder(
              builder: (context, constraints) {
                if (constraints.maxWidth >= 480) {
                  return IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: TeamBlock(
                            label: 'ALLIES',
                            players: allAllies,
                            accentColor: colors.allyBlue,
                            highlightName: widget.localPlayer.summonerName,
                          ),
                        ),
                        VerticalDivider(
                          color: colors.hairlineSoft,
                          width: 1,
                        ),
                        Expanded(
                          child: TeamBlock(
                            label: 'ENEMIES',
                            players: widget.enemies,
                            accentColor: colors.enemyRed,
                            highlightName: null,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                return Column(
                  children: [
                    TeamBlock(
                      label: 'ALLIES',
                      players: allAllies,
                      accentColor: colors.allyBlue,
                      highlightName: widget.localPlayer.summonerName,
                    ),
                    TeamBlock(
                      label: 'ENEMIES',
                      players: widget.enemies,
                      accentColor: colors.enemyRed,
                      highlightName: null,
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class TeamBlock extends StatelessWidget {
  const TeamBlock({
    required this.label,
    required this.players,
    required this.accentColor,
    required this.highlightName,
    super.key,
  });
  final String label;
  final List<Player> players;
  final Color accentColor;
  final String? highlightName;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text(
            label,
            style: AppTextStyles.eyebrow.copyWith(
              color: accentColor,
              letterSpacing: 1.2,
            ),
          ),
        ),
        ...players.map(
          (p) => PlayerRow(
            player: p,
            isHighlighted: p.summonerName == highlightName,
          ),
        ),
      ],
    );
  }
}

class PlayerRow extends StatelessWidget {
  const PlayerRow({
    required this.player,
    required this.isHighlighted,
    super.key,
  });
  final Player player;
  final bool isHighlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = player.scores;
    return Container(
      color: isHighlighted ? colors.magicSubtle : Colors.transparent,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          ChampAvatar(
            name: player.championName,
            isDead: player.isDead,
            size: 24,
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: Text(
              player.championName,
              style: AppTextStyles.captionBold.copyWith(
                color: isHighlighted ? colors.magic : colors.textPrimary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            '${s.kills}/${s.deaths}/${s.assists}',
            style: AppTextStyles.micro.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 44,
            child: Text(
              '${s.creepScore} cs',
              style: AppTextStyles.micro.copyWith(color: colors.textDisabled),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
