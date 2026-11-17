import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/utils/ddragon.dart';
import 'package:material_ui/material_ui.dart';

class ChampAvatar extends StatelessWidget {
  const ChampAvatar({
    required this.name,
    required this.isDead,
    super.key,
    this.size = 48,
  });
  final String name;
  final bool isDead;
  final double size;

  Color _placeholderColor(String n) {
    final h = n.codeUnits.fold(0, (a, b) => a + b);
    return HSLColor.fromAHSL(1, ((h * 37) % 360).toDouble(), 0.5, 0.25)
        .toColor();
  }

  Widget _placeholder(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isDead ? const Color(0xFF2A2A2A) : _placeholderColor(name),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDead ? const Color(0xFF444444) : colors.gold,
        ),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(
            color: isDead ? colors.textSecondary : colors.textPrimary,
            fontSize: size * 0.42,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (name.isEmpty) return _placeholder(context);

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: ColorFiltered(
        colorFilter: isDead
            ? const ColorFilter.matrix([
                0.21, 0.72, 0.07, 0, 0,
                0.21, 0.72, 0.07, 0, 0,
                0.21, 0.72, 0.07, 0, 0,
                0,    0,    0,    1, 0,
              ])
            : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
        child: Image.network(
          champImageUrl(name),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholder(context),
          loadingBuilder: (_, child, loading) =>
              loading == null ? child : _placeholder(context),
        ),
      ),
    );
  }
}
