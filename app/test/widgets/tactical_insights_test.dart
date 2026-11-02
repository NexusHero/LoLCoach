// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/strategy.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/challenger_pro_hud.dart';
import 'package:lol_coach/widgets/macro_alert_strip.dart';
import 'package:lol_coach/widgets/recommendation_panel.dart';
import 'package:lol_coach/widgets/tactical_comms_bar.dart';

void main() {
  group('Challenger Coaching Engine HUD widgets', () {
    testWidgets(
      'MacroAlertStrip_PriorityCappedAlertsAndObjectives_RendersMaxTwoAlertsAndTimers',
      (tester) async {
        final insights = TacticalInsights.fromJson(const {
          'teamDamageProfile': {
            'adPercent': 70,
            'apPercent': 30,
            'heavyHealing': true,
            'armorStacking': true,
          },
          'primaryThreat': {
            'championName': 'Zed',
            'reason': '8/1/2 · 160 CS · Lvl 12',
            'kills': 8,
            'cs': 160,
            'level': 12,
          },
          'macroAlerts': [
            {
              'id': 'shutdown_protection',
              'priority': 'critical',
              'category': 'danger',
              'title': 'PROTECT SHUTDOWN (5/0/2)',
              'detail': 'High bounty on your head',
            },
            {
              'id': 'obj_setup_dragon',
              'priority': 'warning',
              'category': 'objective',
              'title': 'DRAGON IN 55s — RESET NOW',
              'detail': 'Push wave & recall',
            },
          ],
          'objectives': [
            {
              'type': 'dragon',
              'label': 'Dragon',
              'secondsUntilSpawn': 55,
              'status': 'spawning_soon',
            },
          ],
        });

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: Scaffold(
              body: MacroAlertStrip(insights: insights),
            ),
          ),
        );

        expect(find.text('PROTECT SHUTDOWN (5/0/2)'), findsOneWidget);
        expect(find.text('DRAGON IN 55s — RESET NOW'), findsOneWidget);
        expect(find.text('Dragon: 0:55'), findsOneWidget);
        expect(find.textContaining('Fed Threat: Zed'), findsOneWidget);
        expect(find.text('COMP 70% AD'), findsOneWidget);
        expect(find.text('HEAVY HEAL → BUY ANTI-HEAL'), findsOneWidget);
        expect(find.text('ARMOR STACK → BUY %PEN'), findsOneWidget);
      },
    );

    testWidgets(
      'RecommendationPanel_WithNextBestBuyAndEnemyCooldowns_RendersComponentAndCdBar',
      (tester) async {
        const rec = ItemRecommendation(
          items: [
            RecommendedItem(
              id: 3078,
              name: 'Trinity Force',
              reason: 'Core dueling spike',
              priority: ItemPriority.core,
            ),
          ],
          reasoning: 'Build Trinity Force',
          source: RecommendationSource.llm,
          provider: 'claude',
          strategy: Strategy(
            winCondition: WinCondition.mid,
            summary: 'Win mid-game',
            immediateAction: 'Short trade after Zed W',
            lateGamePlan: 'Split push',
          ),
        );

        const insights = TacticalInsights(
          teamDamageProfile: TeamDamageProfile(adPercent: 60, apPercent: 40),
          nextBestBuy: NextBestBuy(
            itemId: 3057,
            itemName: 'Sheen',
            price: 900,
            targetItemId: 3078,
            targetItemName: 'Trinity Force',
            breakpointHint: 'or +120g (1 wave) for Phage',
          ),
          enemyCooldowns: EnemyCooldowns(
            championName: 'Zed',
            level: 9,
            abilityHaste: 20,
            q: 5,
            w: 16,
            e: 4,
            r: 85,
            keyThreatSpell: 'W',
            summonerSpells: [
              EnemySummonerCooldown(name: 'Flash', cooldown: 254),
              EnemySummonerCooldown(name: 'Ignite', cooldown: 153),
            ],
            keyThreatSummary: 'His W (16s) vs your W (18s) -> 2s vulnerable!',
          ),
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: RecommendationPanel(
                recommendation: rec,
                tacticalInsights: insights,
                localChampion: 'Ahri',
                opponentChampion: 'Zed',
              ),
            ),
          ),
        );

        expect(find.text('BUY NOW: SHEEN (900g)'), findsOneWidget);
        expect(find.text('or +120g (1 wave) for Phage'), findsOneWidget);
        expect(
          find.text('His W (16s) vs your W (18s) -> 2s vulnerable!'),
          findsOneWidget,
        );
        expect(find.text('16s'), findsOneWidget);
        expect(find.text('FLASH'), findsOneWidget);
        expect(find.text('4:14'), findsOneWidget);

        // 1-Click on W starts live countdown ("W CD") and ticks down after 1s
        await tester.tap(find.text('16s'));
        await tester.pump(const Duration(seconds: 1));
        expect(find.text('W CD'), findsOneWidget);
        expect(find.text('15s'), findsOneWidget);

        // Second click resets the timer back to ready ("W" / "16s")
        await tester.tap(find.text('15s'));
        await tester.pump();
        expect(find.text('16s'), findsOneWidget);
      },
    );

    testWidgets(
      'ChallengerProHud_Rendered_ShowsHighContrastPlayCooldownsAndTempoWithoutRedundantStats',
      (tester) async {
        const state = ParsedGameState(
          gameTime: 600,
          gameMode: 'CLASSIC',
          localPlayer: Player(
            championName: 'Ahri',
            isBot: false,
            isDead: false,
            items: [],
            level: 9,
            position: 'MID',
            scores: PlayerScores(
              kills: 3,
              deaths: 0,
              assists: 2,
              creepScore: 84,
              wardScore: 8,
            ),
            summonerName: 'Player1',
            team: 'ORDER',
          ),
          allies: [],
          enemies: [],
          activePlayer: ActivePlayer(
            summonerName: 'Player1',
            level: 9,
            currentGold: 1150,
            championStats: ActivePlayerStats(
              abilityPower: 180,
              armor: 55,
              attackDamage: 70,
              critChance: 0,
              healthMax: 1450,
              magicResist: 42,
            ),
          ),
        );

        const rec = ItemRecommendation(
          items: [
            RecommendedItem(
              id: 3157,
              name: "Zhonya's Hourglass",
              reason: 'Survive Zed R',
              priority: ItemPriority.core,
            ),
          ],
          reasoning: 'Rush Seeker',
          source: RecommendationSource.llm,
          provider: 'claude',
          strategy: Strategy(
            winCondition: WinCondition.mid,
            summary: 'Play around Charm',
            immediateAction: 'Hold E until Zed exits R behind you',
            lateGamePlan: 'Pick side lane',
            counterPlay: 'Never use R1 forward while Zed W is up',
          ),
        );

        const insights = TacticalInsights(
          teamDamageProfile: TeamDamageProfile(adPercent: 75, apPercent: 25),
          nextBestBuy: NextBestBuy(
            itemId: 1058,
            itemName: 'Needlessly Large Rod',
            price: 1200,
            targetItemId: 3157,
            targetItemName: "Zhonya's Hourglass",
            breakpointHint: '+50g (1 wave) needed',
          ),
          enemyCooldowns: EnemyCooldowns(
            championName: 'Zed',
            level: 9,
            abilityHaste: 15,
            q: 5,
            w: 17,
            e: 4,
            r: 90,
            keyThreatSummary: 'Punish Zed W (17s CD) after cast!',
          ),
          csPerMin: 8.4,
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: ChallengerProHud(
                gameState: state,
                recommendation: rec,
                tacticalInsights: insights,
                opponentChampion: 'Zed',
              ),
            ),
          ),
        );

        expect(
          find.text('Hold E until Zed exits R behind you'),
          findsOneWidget,
        );
        expect(find.text('Punish Zed W (17s CD) after cast!'), findsOneWidget);
        expect(find.text('8.4 / 8.0'), findsOneWidget);
        expect(find.text('17s'), findsOneWidget);
      },
    );

    testWidgets(
      'TacticalCommsBar_RendersRadioReplyActiveChipsAndExecutes1ClickCallouts',
      (tester) async {
        final sentCommands = <String>[];
        final clearedKeys = <String>[];

        const insights = TacticalInsights(
          teamDamageProfile: TeamDamageProfile(adPercent: 50, apPercent: 50),
          enemyCooldowns: EnemyCooldowns(
            championName: 'Ahri',
            level: 8,
            abilityHaste: 10,
            q: 6,
            w: 8,
            e: 11,
            r: 95,
            keyThreatSummary: 'Punish Ahri E (11s CD) after cast!',
          ),
          liveOverrides: LiveTacticalOverrides(
            laneOpponentOverride: 'Vayne',
            campedStatus: 'camped',
            enemyBuildOverrides: {'KaiSa': 'ap'},
          ),
          lastCoachExchange: CoachExchange(
            id: 'cmd_1',
            userText: 'Vayne ist Top und ich werde gecampt',
            replyText: 'Anti-Camp aktiv: Freeze vor eigenem Turm gegen Vayne.',
            actionsExecuted: ['🔄 Lane → Vayne', '⛺ Camped → Safe'],
            timestamp: 1000,
          ),
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: Scaffold(
              body: TacticalCommsBar(
                tacticalInsights: insights,
                onSendCommand: sentCommands.add,
                onClearOverride: clearedKeys.add,
              ),
            ),
          ),
        );

        expect(find.text('RACE ENGINEER RADIO'), findsOneWidget);
        expect(
          find.text('Anti-Camp aktiv: Freeze vor eigenem Turm gegen Vayne.'),
          findsOneWidget,
        );
        expect(find.text('🔄 Lane vs Vayne'), findsOneWidget);

        // 1-Click on Quick Callout Pill ("Vayne Flash") sends command
        await tester.tap(find.text('Vayne Flash'));
        await tester.pump();
        expect(sentCommands, contains('Vayne Flash'));

        // 1-Click on Active Override Chip removes override
        await tester.tap(find.text('🔄 Lane vs Vayne'));
        await tester.pump();
        expect(clearedKeys, contains('laneOpponent'));
      },
    );
  });
}
