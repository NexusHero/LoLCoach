import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/models/ws_message.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/matchup_briefing_card.dart';
import 'package:material_ui/material_ui.dart';

const _briefingJson = <String, dynamic>{
  'myChampion': 'Malzahar',
  'opponentChampion': 'Hwei',
  'role': 'MIDDLE',
  'createdAt': 1,
  'points': [
    {'kind': 'trading', 'text': 'Hwei pokes from long range.'},
    {'kind': 'spike', 'text': 'Hwei level 6 zone control.'},
    {'kind': 'history', 'text': 'Last time (loss): CS +22 at 10:00.'},
    {'kind': 'history', 'text': ''},
  ],
};

void main() {
  group('MatchupBriefing', () {
    test('fromJson_ViaWsMessage_ParsesPointsAndDropsEmptyLines', () {
      final msg = WsMessage.fromJson({
        'event': 'MATCHUP_BRIEFING',
        'timestamp': 1,
        'briefing': _briefingJson,
      });

      expect(msg.briefing?.opponentChampion, 'Hwei');
      expect(
        msg.briefing?.points.map((p) => p.kind),
        [BriefingKind.trading, BriefingKind.spike, BriefingKind.history],
      );
    });

    test('fromJson_UnknownKind_FallsBackToHistory', () {
      final b = MatchupBriefing.fromJson({
        'points': [
          {'kind': 'weird', 'text': 'x'},
        ],
      });
      expect(b.points.single.kind, BriefingKind.history);
    });

    testWidgets('MatchupBriefingCard_RendersAllLinesAndDismisses',
        (tester) async {
      var dismissed = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(
            body: MatchupBriefingCard(
              briefing: MatchupBriefing.fromJson(_briefingJson),
              onDismiss: () => dismissed = true,
            ),
          ),
        ),
      );

      expect(
        find.text('MATCHUP BRIEFING · MALZAHAR VS HWEI'),
        findsOneWidget,
      );
      expect(find.text('TRADING'), findsOneWidget);
      expect(find.text('POWER SPIKE'), findsOneWidget);
      expect(find.text('YOUR HISTORY'), findsOneWidget);
      expect(find.text('Hwei pokes from long range.'), findsOneWidget);

      await tester.tap(find.byTooltip('Dismiss briefing'));
      expect(dismissed, isTrue);
    });
  });
}
