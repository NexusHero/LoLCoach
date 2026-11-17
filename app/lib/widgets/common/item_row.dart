import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/widgets/common/item_slot.dart';
import 'package:material_ui/material_ui.dart';

class ItemRow extends StatelessWidget {
  const ItemRow({required this.items, super.key});
  final List<Item> items;

  @override
  Widget build(BuildContext context) {
    final sorted = [...items]..sort((a, b) => a.slot.compareTo(b.slot));
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: sorted
          .map(
            (item) => ItemSlot(
              itemId: item.itemID,
              displayName: item.displayName,
              size: 30,
            ),
          )
          .toList(),
    );
  }
}
