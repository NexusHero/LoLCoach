import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/utils/ddragon.dart';
import 'package:material_ui/material_ui.dart';

class ItemSlot extends StatelessWidget {
  const ItemSlot({
    required this.itemId,
    required this.displayName,
    super.key,
    this.size = 34,
    this.borderColor,
  });
  final int itemId;
  final String displayName;
  final double size;

  /// Defaults to `context.colors.borderAccent` when null (resolved in [build]).
  final Color? borderColor;

  Widget _placeholder(BuildContext context, Color border) {
    final colors = context.colors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: colors.surfaceMedium,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border, width: 1.5),
      ),
      child: Center(
        child: Text(
          displayName.isNotEmpty ? displayName[0] : '?',
          style: TextStyle(
            color: colors.gold,
            fontSize: 9,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final border = borderColor ?? context.colors.borderAccent;
    return Tooltip(
      message: displayName,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: border, width: 1.5),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Image.network(
            itemImageUrl(itemId),
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _placeholder(context, border),
            loadingBuilder: (_, child, loading) =>
                loading == null ? child : _placeholder(context, border),
          ),
        ),
      ),
    );
  }
}
