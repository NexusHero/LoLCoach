import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/screens/analysis_screen.dart';
import 'package:lol_coach/services/analysis_service.dart';
import 'package:lol_coach/services/ws_client.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/analysis/analysis_header.dart';
import 'package:material_ui/material_ui.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'analysis_fixtures.dart';

WebSocketChannel _noChannel(Uri uri, {Map<String, dynamic>? headers}) =>
    throw UnsupportedError('no websocket in tests');

/// Connected client that records everything sent instead of using a socket.
class _FakeWsClient extends WsClient {
  _FakeWsClient() : super(channelFactory: _noChannel);

  final sent = <Map<String, dynamic>>[];

  @override
  void send(String data) => sent.add(jsonDecode(data) as Map<String, dynamic>);

  @override
  bool get isConnected => true;

  @override
  ConnectionStatus get status => ConnectionStatus.connected;

  List<String> get events => [for (final m in sent) m['event'] as String];
}

Future<(AnalysisService, _FakeWsClient)> _pumpScreen(
  WidgetTester tester, {
  Map<String, dynamic>? snapshot,
  Size size = const Size(1200, 3200),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final client = _FakeWsClient();
  final service = AnalysisService(client);
  addTearDown(service.dispose);
  if (snapshot != null) {
    service.handleMessage(
      jsonEncode({'event': 'ANALYSIS_UPDATE', 'analysis': snapshot}),
    );
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [analysisServiceProvider.overrideWithValue(service)],
      child: MaterialApp(
        theme: AppTheme.dark,
        home: AnalysisScreen(onOpenSettings: () {}),
      ),
    ),
  );
  await tester.pump();
  return (service, client);
}

void main() {
  group('AnalysisScreen', () {
    testWidgets('sends GET_ANALYSIS when connected', (tester) async {
      final (_, client) = await _pumpScreen(tester);
      expect(client.events, contains('GET_ANALYSIS'));
    });

    testWidgets('renders goal dots, metric tiles and expands a match row',
        (tester) async {
      await _pumpScreen(tester, snapshot: fullSnapshotJson());

      expect(find.text('Tester#EUW'), findsOneWidget);
      expect(find.text('GOLD II · 45 LP · 30W 25L'), findsOneWidget);
      expect(
        find.text('No deaths before 14:00 in your next 5 games.'),
        findsOneWidget,
      );
      for (var i = 0; i < 5; i++) {
        expect(find.byKey(ValueKey('goalDot$i')), findsOneWidget);
      }
      expect(find.bySemanticsLabel('Goal met'), findsNWidgets(2));
      expect(find.bySemanticsLabel('Goal missed'), findsOneWidget);
      expect(find.bySemanticsLabel('Not played yet'), findsNWidgets(2));

      for (final key in [
        'cs10',
        'earlyDeaths',
        'gold15',
        'objectivePresence',
      ]) {
        expect(find.byKey(ValueKey('metricTile_$key')), findsOneWidget);
      }
      // MASTER benchmark is missing in the fixture.
      expect(find.text('collecting…'), findsNWidgets(4));
      // Headline is the absolute value, beating the PLATINUM benchmark.
      expect(find.text('82'), findsOneWidget);
      expect(find.text('5400'), findsOneWidget);
      // Average csDiff10 over (8, -12, 8) = 1.3 → "+1" as secondary line.
      expect(find.text('+1 vs lane'), findsOneWidget);
      expect(find.text('+33 vs lane'), findsOneWidget);
      expect(find.text('60%'), findsOneWidget);

      const review = 'Strong lane: you trimmed Zed early and roamed bot.';
      expect(find.text(review), findsNothing);
      await tester.tap(find.byKey(const ValueKey('matchRow_EUW1_3')));
      await tester.pumpAndSettle();
      expect(find.text(review), findsOneWidget);
      expect(find.text('4:05'), findsOneWidget);
      expect(
        find.text('Mid lane, enemy half · killed by Zed · 2 enemies'),
        findsOneWidget,
      );

      expect(find.text('You die early on assassin matchups.'), findsOneWidget);
      expect(find.text('Collecting MASTER games…'), findsOneWidget);
    });

    testWidgets('narrow layout and pro depth render without overflow',
        (tester) async {
      await _pumpScreen(
        tester,
        snapshot: fullSnapshotJson(),
        size: const Size(360, 5200),
      );
      expect(find.text('MATCHUPS'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('proDepthToggle')));
      await tester.pumpAndSettle();
      expect(find.text('MATCHUPS'), findsOneWidget);
      expect(find.text('ITEM & RECALL TIMING'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows goal placeholder while goal is absent', (tester) async {
      final json = fullSnapshotJson()..remove('goal');
      await _pumpScreen(tester, snapshot: json);
      expect(find.byKey(const ValueKey('goalPlaceholder')), findsOneWidget);
      expect(
        find.text(
          'Your first goal appears once benchmarks for PLATINUM are collected',
        ),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('goalDot0')), findsNothing);
    });

    testWidgets('shows key-problem warning', (tester) async {
      final json = fullSnapshotJson()..['keyProblem'] = 'invalid_or_expired';
      await _pumpScreen(tester, snapshot: json);
      expect(find.text(KeyProblemCard.invalidText), findsOneWidget);
    });

    testWidgets('shows missing-key text', (tester) async {
      final json = fullSnapshotJson()..['keyProblem'] = 'missing';
      await _pumpScreen(tester, snapshot: json);
      expect(find.text('Add RIOT_API_KEY to core/.env'), findsOneWidget);
    });

    testWidgets('empty state without matches and riot id', (tester) async {
      await _pumpScreen(
        tester,
        snapshot: const {
          'region': 'EUW',
          'matches': <dynamic>[],
          'benchmarks': <dynamic>[],
          'sync': {'state': 'idle'},
          'aggregation': {'state': 'idle', 'tiers': <dynamic>[]},
        },
        size: const Size(360, 2400),
      );
      expect(find.text('No matches yet'), findsOneWidget);
      expect(find.text('Open Settings'), findsOneWidget);
      expect(find.byKey(const ValueKey('metricTile_cs10')), findsNothing);
    });

    testWidgets('Refresh sends REFRESH_ANALYSIS', (tester) async {
      final (_, client) =
          await _pumpScreen(tester, snapshot: fullSnapshotJson());
      client.sent.clear();
      await tester.tap(find.text('Refresh'));
      await tester.pump();
      expect(client.events, ['REFRESH_ANALYSIS']);
    });

    testWidgets('Ask sends ASK_ANALYSIS and shows the answer', (tester) async {
      final (service, client) =
          await _pumpScreen(tester, snapshot: fullSnapshotJson());
      client.sent.clear();
      await tester.enterText(
        find.byKey(const ValueKey('askField')),
        'Why do I lose to Zed?',
      );
      await tester.tap(find.byTooltip('Send'));
      await tester.pump();

      final msg = client.sent.single;
      expect(msg['event'], 'ASK_ANALYSIS');
      expect(msg['question'], 'Why do I lose to Zed?');
      expect(find.text('Thinking…'), findsOneWidget);

      service.handleMessage(
        jsonEncode({
          'event': 'ANALYSIS_ANSWER',
          'requestId': msg['requestId'],
          'answer': 'You trade before level 6.',
        }),
      );
      await tester.pump();
      expect(find.text('Thinking…'), findsNothing);
      expect(find.text('You trade before level 6.'), findsOneWidget);
    });
  });

  group('validateRiotId', () {
    test('accepts Name#TAG and empty, rejects others', () {
      expect(validateRiotId('Faker#KR1'), isNull);
      expect(validateRiotId(''), isNull);
      expect(validateRiotId('Faker'), isNotNull);
      expect(validateRiotId('Fa#ker#KR'), isNotNull);
      expect(validateRiotId('#KR'), isNotNull);
    });
  });
}
