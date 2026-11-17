import 'package:lol_coach/controllers/settings_controller.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:material_ui/material_ui.dart';

class ProviderSection extends StatelessWidget {
  const ProviderSection({required this.ctrl, super.key});
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
              'AI Provider',
              style: AppTextStyles.captionBold.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'AI gives smarter, context-aware advice. '
              'Basic uses fast built-in rules.',
              style: AppTextStyles.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'none', label: Text('Basic')),
                ButtonSegment(value: 'claude', label: Text('Claude')),
                ButtonSegment(value: 'openai', label: Text('OpenAI')),
                ButtonSegment(value: 'gemini', label: Text('Gemini')),
              ],
              selected: {ctrl.providerType},
              onSelectionChanged: ctrl.isConnecting
                  ? null
                  : (val) => ctrl.setProviderType(val.first),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: ctrl.providerType != 'none'
                  ? Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ModelDropdown(
                              models: ctrl.currentModels,
                              selected: ctrl.selectedModel,
                              enabled:
                                  !ctrl.isConnecting && !ctrl.isLoadingModels,
                              onChanged: (val) =>
                                  ctrl.setSelectedModel(val ?? ''),
                            ),
                          ),
                          const SizedBox(width: 4),
                          _RefreshModelsButton(
                            isLoading: ctrl.isLoadingModels,
                            enabled:
                                !ctrl.isConnecting &&
                                ctrl.apiKeyCtrl.text.isNotEmpty,
                            onPressed: ctrl.loadModels,
                          ),
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              child: ctrl.providerType != 'none'
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: ctrl.apiKeyCtrl,
                                  enabled: !ctrl.isConnecting,
                                  obscureText: true,
                                  decoration: InputDecoration(
                                    labelText: '${ctrl.providerType} API Key',
                                    hintText: 'Enter your API key',
                                    prefixIcon: Icon(
                                      Icons.vpn_key_outlined,
                                      color: colors.textSecondary,
                                    ),
                                  ),
                                  keyboardType: TextInputType.text,
                                  textInputAction: TextInputAction.done,
                                  onSubmitted: (_) => ctrl.connect(),
                                ),
                              ),
                              const SizedBox(width: 4),
                              _ValidateKeyButton(
                                isLoading: ctrl.isValidatingKey,
                                enabled: !ctrl.isConnecting,
                                onPressed: ctrl.validateKey,
                              ),
                            ],
                          ),
                          if (ctrl.keyValidationResult != null) ...[
                            const SizedBox(height: 6),
                            _KeyValidationBadge(
                              valid: ctrl.keyValidationResult!,
                              error: ctrl.keyValidationError,
                            ),
                          ],
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              child: ctrl.providerType != 'none'
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: TextField(
                        controller: ctrl.tokenBudgetCtrl,
                        enabled: !ctrl.isConnecting,
                        decoration: InputDecoration(
                          labelText: 'Session Token Budget',
                          hintText: '0 = unlimited (e.g. 50000)',
                          prefixIcon: Icon(
                            Icons.token_outlined,
                            color: colors.textSecondary,
                          ),
                        ),
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
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

class _ValidateKeyButton extends StatelessWidget {
  const _ValidateKeyButton({
    required this.isLoading,
    required this.enabled,
    required this.onPressed,
  });

  final bool isLoading;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Test API key',
      icon: isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(
              Icons.verified_outlined,
              color: context.colors.textSecondary,
            ),
      onPressed: enabled && !isLoading ? onPressed : null,
    );
  }
}

class _KeyValidationBadge extends StatelessWidget {
  const _KeyValidationBadge({required this.valid, this.error});

  final bool valid;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    if (valid) {
      return Row(
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 14,
            color: colors.success,
          ),
          const SizedBox(width: 6),
          Text(
            'API key is valid',
            style: AppTextStyles.caption.copyWith(color: colors.success),
          ),
        ],
      );
    }
    return Row(
      children: [
        Icon(Icons.error_outline, size: 14, color: colors.errorLight),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            error ?? 'Invalid API key',
            style: AppTextStyles.caption.copyWith(color: colors.errorLight),
          ),
        ),
      ],
    );
  }
}

class _RefreshModelsButton extends StatelessWidget {
  const _RefreshModelsButton({
    required this.isLoading,
    required this.enabled,
    required this.onPressed,
  });

  final bool isLoading;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Load available models',
      icon: isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(Icons.refresh, color: context.colors.textSecondary),
      onPressed: enabled && !isLoading ? onPressed : null,
    );
  }
}

class _ModelDropdown extends StatelessWidget {
  const _ModelDropdown({
    required this.models,
    required this.selected,
    required this.onChanged,
    this.enabled = true,
  });

  final List<ModelOption> models;
  final String selected;
  final ValueChanged<String?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final effectiveValue =
        models.any((m) => m.id == selected) ? selected : models.first.id;
    return DropdownButtonFormField<String>(
      initialValue: effectiveValue,
      decoration: InputDecoration(
        labelText: 'Model',
        prefixIcon: Icon(
          Icons.psychology_outlined,
          color: context.colors.textSecondary,
        ),
      ),
      items: models
          .map(
            (m) => DropdownMenuItem(value: m.id, child: Text(m.label)),
          )
          .toList(),
      onChanged: enabled ? onChanged : null,
    );
  }
}
