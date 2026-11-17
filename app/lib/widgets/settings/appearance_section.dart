import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lol_coach/controllers/theme_controller.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:material_ui/material_ui.dart';

/// Light / Dark / System theme picker. Bound to the app-global
/// `ThemeController` (independent of the screen-scoped `SettingsController`).
class AppearanceSection extends ConsumerWidget {
  const AppearanceSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    // ref.watch returns the ThemeMode state directly and rebuilds this
    // widget on change — no ListenableBuilder needed for a Notifier provider.
    final mode = ref.watch(themeControllerProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Appearance',
          style: AppTextStyles.captionBold.copyWith(
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Choose light, dark, or follow your system setting.',
          style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: 10),
        SegmentedButton<ThemeMode>(
          segments: const [
            ButtonSegment(value: ThemeMode.system, label: Text('System')),
            ButtonSegment(value: ThemeMode.light, label: Text('Light')),
            ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
          ],
          selected: {mode},
          onSelectionChanged: (selection) => ref
              .read(themeControllerProvider.notifier)
              .setMode(selection.first),
        ),
      ],
    );
  }
}
