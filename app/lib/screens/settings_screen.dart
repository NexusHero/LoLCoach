import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/providers.dart';
import 'package:lol_coach/widgets/common/app_background.dart';
import 'package:lol_coach/widgets/connection_form.dart';
import 'package:material_ui/material_ui.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({required this.onConnected, super.key});
  final VoidCallback onConnected;

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late SettingsController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = SettingsController(
      storage: ref.read(storageServiceProvider),
      coach: ref.read(coachServiceProvider),
      analysis: ref.read(analysisServiceProvider),
      onConnected: widget.onConnected,
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _ctrl,
      builder: (context, _) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Settings'),
            backgroundColor: Colors.transparent,
            elevation: 0,
            actions: [
              if (_ctrl.isConnected)
                IconButton(
                  icon: const Icon(Icons.link_off),
                  tooltip: 'Disconnect',
                  onPressed: _ctrl.disconnect,
                ),
            ],
          ),
          extendBodyBehindAppBar: true,
          body: AppBackground(
            child: SafeArea(child: ConnectionForm(ctrl: _ctrl)),
          ),
        );
      },
    );
  }
}
