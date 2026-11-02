import 'package:flutter/material.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';

/// Shared quick-switch bar for in-game Build Focus (`Auto`, `Burst`, `DPS`,
/// `Bruiser`, `Split`) and the `Passive Items` toggle.
class BuildFocusSelector extends StatelessWidget {
  const BuildFocusSelector({
    required this.selectedFocus,
    required this.onFocusChanged,
    required this.preferPassive,
    super.key,
    this.onPreferPassiveChanged,
  });

  final String selectedFocus;
  final ValueChanged<String> onFocusChanged;
  final bool preferPassive;
  final ValueChanged<bool>? onPreferPassiveChanged;

  static const _options = <(String, String)>[
    ('auto', 'Auto'),
    ('burst', 'Burst'),
    ('dps', 'DPS'),
    ('bruiser', 'Bruiser'),
    ('split', 'Split'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final (id, label) in _options)
          InkWell(
            onTap: () => onFocusChanged(id),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: selectedFocus == id
                    ? colors.magicSubtle
                    : colors.surface2,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color:
                      selectedFocus == id ? colors.magicLine : colors.border,
                ),
              ),
              child: Text(
                label,
                style: AppTextStyles.micro.copyWith(
                  color: selectedFocus == id
                      ? colors.magic
                      : colors.textSecondary,
                  fontWeight:
                      selectedFocus == id ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ),
        if (onPreferPassiveChanged != null)
          InkWell(
            onTap: () => onPreferPassiveChanged!(!preferPassive),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: preferPassive ? colors.goldSubtle : colors.surface2,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: preferPassive ? colors.champagneLine : colors.border,
                ),
              ),
              child: Text(
                'Passive Items',
                style: AppTextStyles.micro.copyWith(
                  color: preferPassive ? colors.gold : colors.textSecondary,
                  fontWeight: preferPassive ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
