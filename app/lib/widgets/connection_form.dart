import 'package:flutter/material.dart';
import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:lol_coach/widgets/settings/advanced_section.dart';
import 'package:lol_coach/widgets/settings/appearance_section.dart';
import 'package:lol_coach/widgets/settings/provider_section.dart';

class ConnectionForm extends StatelessWidget {
  const ConnectionForm({required this.ctrl, super.key});

  final SettingsController ctrl;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ctrl,
      builder: (context, _) {
        final colors = context.colors;
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: GameCard(
                padding: const EdgeInsets.all(26),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.magicSubtle,
                          border: Border.all(color: colors.magicLine),
                        ),
                        child: Icon(
                          Icons.shield_outlined,
                          size: 26,
                          color: colors.magic,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'LoL Coach',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.hero.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Real-time item advice during your match.\n'
                      'Always know what to build.',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.body.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 28),
                    TextField(
                      controller: ctrl.summonerCtrl,
                      enabled: !ctrl.isConnecting,
                      decoration: InputDecoration(
                        labelText: 'Summoner Name (Optional)',
                        hintText: 'Your in-game name',
                        prefixIcon: Icon(
                          Icons.person_outline,
                          color: colors.textSecondary,
                        ),
                      ),
                      keyboardType: TextInputType.text,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 18),
                    ProviderSection(ctrl: ctrl),
                    const SizedBox(height: 22),
                    const AppearanceSection(),
                    const SizedBox(height: 22),
                    AdvancedSection(ctrl: ctrl),
                    if (ctrl.connectionError != null && !ctrl.isConnecting) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: colors.errorSubtle,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: colors.error),
                        ),
                        child: Text(
                          ctrl.connectionError!,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.errorLight,
                          ),
                        ),
                      ),
                    ],
                    if (ctrl.isConnecting) ...[
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'Connecting to core...',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: ctrl.isConnecting ? null : ctrl.connect,
                      child: Text(
                        ctrl.isConnecting ? 'Connecting…' : 'Connect',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
