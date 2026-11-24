import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/tactical_comms_bar.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  group('TacticalCommsBar collapse', () {
    testWidgets('collapsed by default, expands to input and pills',
        (tester) async {
      final sent = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(body: TacticalCommsBar(onSendCommand: sent.add)),
        ),
      );

      // Collapsed: one row with the Marker pill and the chevron only.
      expect(find.text('Marker'), findsOneWidget);
      expect(find.text('[F1]'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Camped'), findsNothing);
      expect(find.byTooltip('Show comms'), findsOneWidget);

      await tester.tap(find.text('Marker'));
      expect(sent, ['Marker']);

      await tester.tap(find.byKey(const ValueKey('commsExpandToggle')));
      await tester.pump();
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Camped'), findsOneWidget);
      expect(find.text('SEND'), findsOneWidget);
      expect(find.text('Marker'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('commsExpandToggle')));
      await tester.pump();
      expect(find.byType(TextField), findsNothing);
    });
  });
}
