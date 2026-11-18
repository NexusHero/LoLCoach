import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/services/analysis_service.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:material_ui/material_ui.dart';

/// Riot ID + region used by the post-game Analysis board.
class RiotIdSection extends StatelessWidget {
  const RiotIdSection({required this.ctrl, super.key});
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
            Text(
              'Match Analysis',
              style: AppTextStyles.captionBold.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Your Riot ID lets the core load your recent games for the '
              'post-game review.',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    key: const ValueKey('riotIdField'),
                    controller: ctrl.riotIdCtrl,
                    enabled: !ctrl.isConnecting,
                    decoration: InputDecoration(
                      labelText: 'Riot ID',
                      hintText: 'Name#TAG',
                      prefixIcon: Icon(
                        Icons.badge_outlined,
                        color: colors.textSecondary,
                      ),
                      errorText: ctrl.riotIdError,
                    ),
                    keyboardType: TextInputType.text,
                    textInputAction: TextInputAction.next,
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 104,
                  child: DropdownButtonFormField<String>(
                    key: const ValueKey('riotRegionField'),
                    initialValue: ctrl.riotRegion,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Region'),
                    items: [
                      for (final r in riotRegions)
                        DropdownMenuItem(value: r, child: Text(r)),
                    ],
                    onChanged: ctrl.isConnecting
                        ? null
                        : (v) {
                            if (v != null) ctrl.setRiotRegion(v);
                          },
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}
