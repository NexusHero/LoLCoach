import 'package:lol_coach/theme/app_colors.dart';
import 'package:material_ui/material_ui.dart';

/// Segmented control for the coaching playstyle.
/// Always one of 'safe' | 'normal' | 'risky' — never multiple at once.
class RiskControl extends StatelessWidget {
  const RiskControl({
    required this.value,
    required this.onChanged,
    super.key,
  });

  final String value;
  final ValueChanged<String> onChanged;

  static const _levels = [
    ('safe', 'Safe'),
    ('normal', 'Normal'),
    ('risky', 'Risky'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (level, label) in _levels) _segment(context, level, label),
        ],
      ),
    );
  }

  Widget _segment(BuildContext context, String level, String label) {
    final colors = context.colors;
    final selected = value == level;
    final color = switch (level) {
      'safe' => colors.cyan,
      'risky' => colors.warning,
      _ => colors.magic,
    };

    return GestureDetector(
      onTap: () => onChanged(level),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? colors.surfaceMedium : null,
          borderRadius: BorderRadius.circular(100),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.1,
            color: selected ? color : colors.textDisabled,
          ),
        ),
      ),
    );
  }
}
