// ignore_for_file: lines_longer_than_80_chars
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
import 'package:material_ui/material_ui.dart';

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
              'id': 'obj_spawn_dragon',
              'priority': 'warning',
              'category': 'objective',
              'title': 'DRAGON IN 55s',
              'detail': 'Spawns soon — you hold 1600g',
            },
            {
              'id': 'gold_hoarding',
              'priority': 'info',
              'category': 'economy',
              'title': 'UNSPENT GOLD: 1600g',
              'detail': 'Enough gold for your next item component',
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

        expect(find.text('DRAGON IN 55s'), findsOneWidget);
        expect(find.text('UNSPENT GOLD: 1600g'), findsOneWidget);
        expect(find.text('Dragon: 0:55'), findsOneWidget);
        expect(find.textContaining('Fed Threat: Zed'), findsOneWidget);
        expect(find.text('COMP 70% AD'), findsOneWidget);
        expect(find.text('HEAVY HEAL → BUY ANTI-HEAL'), findsOneWidget);
        expect(find.text('ARMOR STACK → BUY %PEN'), findsOneWidget);
      },
    );

    testWidgets(
      'RecommendationPanel_WithNextBestBuy_RendersComponentAndBuildPlanWithoutCooldowns',
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

        expect(find.text('NEXT BUY: SHEEN (900g)'), findsOneWidget);
        expect(find.text('or +120g (1 wave) for Phage'), findsOneWidget);
        expect(find.text('BUILD PLAN'), findsOneWidget);
        expect(find.text('Win mid-game'), findsOneWidget);
        expect(find.textContaining('vulnerable'), findsNothing);
        expect(find.text('FLASH'), findsNothing);
      },
    );

    testWidgets(
      'ChallengerProHud_Rendered_ShowsBuildPlanNextBuyAndTempoWithoutCooldowns',
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
            lateGamePlan: 'Pick side lane',
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

        expect(find.text('BUILD PLAN'), findsOneWidget);
        expect(find.text('Play around Charm'), findsOneWidget);
        expect(
          find.text('NEXT BUY: NEEDLESSLY LARGE ROD (1200g)'),
          findsOneWidget,
        );
        expect(find.text('8.4 / 8.0'), findsOneWidget);
        expect(find.textContaining('CD'), findsNothing);
      },
    );

    testWidgets(
      'TacticalCommsBar_RendersReplyOverrideAndMarkerChipsAndSendsMarker',
      (tester) async {
        final sentCommands = <String>[];
        final clearedKeys = <String>[];

        const insights = TacticalInsights(
          teamDamageProfile: TeamDamageProfile(adPercent: 50, apPercent: 50),
          liveOverrides: LiveTacticalOverrides(
            laneOpponentOverride: 'Vayne',
            campedStatus: 'camped',
            enemyBuildOverrides: {'KaiSa': 'ap'},
          ),
          reviewMarkers: [
            ReviewMarker(id: 'm_1', gameTime: 425, note: 'bad trade'),
          ],
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

        expect(find.text('COACH'), findsOneWidget);
        expect(
          find.text('Anti-Camp aktiv: Freeze vor eigenem Turm gegen Vayne.'),
          findsOneWidget,
        );
        expect(find.text('🔄 Lane vs Vayne'), findsOneWidget);

        // The marker pill sends the marker command; no enemy spell callouts exist
        await tester.tap(find.text('Marker'));
        await tester.pump();
        expect(sentCommands, contains('Marker'));
        expect(find.text('[F1]'), findsOneWidget);
        expect(find.text('[F2]'), findsNothing);
        expect(find.textContaining('Flash'), findsNothing);

        // 1-Click on a review marker chip removes that marker
        expect(find.text('📍 7:05 bad trade'), findsOneWidget);
        await tester.tap(find.text('📍 7:05 bad trade'));
        await tester.pump();
        expect(clearedKeys, contains('marker:m_1'));

        // 1-Click on Active Override Chip removes override
        await tester.tap(find.text('🔄 Lane vs Vayne'));
        await tester.pump();
        expect(clearedKeys, contains('laneOpponent'));
      },
    );
  });
}
