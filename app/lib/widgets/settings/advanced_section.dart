import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:material_ui/material_ui.dart';

class AdvancedSection extends StatelessWidget {
  const AdvancedSection({required this.ctrl, super.key});
  final SettingsController ctrl;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ctrl,
      builder: (context, _) {
        final colors = context.colors;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: ctrl.toggleAdvanced,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      ctrl.showAdvanced ? Icons.expand_less : Icons.expand_more,
                      size: 18,
                      color: colors.textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Advanced',
                      style: AppTextStyles.captionBold.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '(Server IP & Port)',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: ctrl.showAdvanced
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        children: [
                          TextField(
                            controller: ctrl.hostCtrl,
                            enabled: !ctrl.isConnecting,
                            decoration: InputDecoration(
                              labelText: 'Server IP',
                              hintText: 'e.g. 192.168.1.100',
                              prefixIcon: Icon(
                                Icons.computer_outlined,
                                color: colors.textSecondary,
                              ),
                              errorText: ctrl.ipError,
                            ),
                            keyboardType: TextInputType.url,
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: ctrl.portCtrl,
                            enabled: !ctrl.isConnecting,
                            decoration: InputDecoration(
                              labelText: 'Port',
                              prefixIcon: Icon(
                                Icons.settings_ethernet,
                                color: colors.textSecondary,
                              ),
                            ),
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'The core server must be running on the same '
                            'machine. Default: localhost:8765',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        );
      },
    );
  }
}
