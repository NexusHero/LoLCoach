import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/services/coach_service.dart';
import 'package:lol_coach/services/storage_service.dart';
import 'package:lol_coach/services/ws_client.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/connection_form.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class _FakeStorage extends StorageService {
  @override
  Future<String?> getApiKey() async => null;
  @override
  Future<void> setApiKey(String key) async {}
  @override
  Future<void> deleteApiKey() async {}
}

WebSocketChannel _fakeFactory(Uri uri, {Map<String, dynamic>? headers}) =>
    throw UnsupportedError('no websocket in tests');

Future<SettingsController> _buildCtrl() async {
  final storage = _FakeStorage();
  await storage.init();
  final client = WsClient(channelFactory: _fakeFactory);
  final coach = CoachService(client);
  return SettingsController(storage: storage, coach: coach);
}

/// Wraps [ConnectionForm] in the app theme + a storage override (the
/// generated `themeControllerProvider`'s `build()` reads
/// `storageServiceProvider` — required by the embedded AppearanceSection).
Future<Widget> _wrap(SettingsController ctrl) async {
  final themeStorage = _FakeStorage();
  await themeStorage.init();
  return ProviderScope(
    overrides: [
      storageServiceProvider.overrideWithValue(themeStorage),
    ],
    child: MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: ConnectionForm(ctrl: ctrl)),
    ),
  );
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('ConnectionForm', () {
    testWidgets(
      'ConnectionForm_Initial_ShowsTitleAndConnectButton',
      (tester) async {
        final ctrl = await _buildCtrl();
        addTearDown(ctrl.dispose);

        await tester.pumpWidget(await _wrap(ctrl));
        await tester.pump();

        expect(find.text('LoL Coach'), findsOneWidget);
        expect(find.text('Connect'), findsOneWidget);
      },
    );

    testWidgets(
      'ConnectionForm_ConnectButton_EnabledWhenIdle',
      (tester) async {
        final ctrl = await _buildCtrl();
        addTearDown(ctrl.dispose);

        await tester.pumpWidget(await _wrap(ctrl));
        await tester.pump();

        final btn = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
        expect(btn.onPressed, isNotNull);
      },
    );

    testWidgets(
      'ConnectionForm_InvalidIp_ShowsValidationError',
      (tester) async {
        final ctrl = await _buildCtrl();
        addTearDown(ctrl.dispose);

        await tester.pumpWidget(await _wrap(ctrl));
        await tester.pump();

        // Show the advanced section so the IP field and its error are visible.
        ctrl.toggleAdvanced();
        await tester.pump();

        ctrl.hostCtrl.text = 'not-an-ip';
        // The form scrolls; ensure the CONNECT button is on-screen before tap.
        final connectButton = find.byType(ElevatedButton);
        await tester.ensureVisible(connectButton);
        await tester.pump();
        await tester.tap(connectButton);
        await tester.pump();

        expect(
          find.text('Invalid IP format (e.g. 192.168.1.100)'),
          findsOneWidget,
        );
      },
    );
  });
}
