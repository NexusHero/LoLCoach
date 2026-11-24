import 'package:lol_coach/theme/app_colors.dart';
import 'package:material_ui/material_ui.dart';

/// Token-pair presets for [AppBadge]. [custom] uses the explicit `bg`/`fg`
/// passed to the default constructor (kept for a few bespoke call-sites).
enum BadgeVariant { custom, violet, champagne, neutral, success, error }

/// Compact rounded pill label. Sentence- or upper-case text is up to the
/// caller; the badge only sets the chrome.
class AppBadge extends StatelessWidget {
  const AppBadge(
    this.text, {
    this.bg,
    this.fg,
    this.variant = BadgeVariant.custom,
    super.key,
  });

  const AppBadge.violet(this.text, {super.key})
      : variant = BadgeVariant.violet,
        bg = null,
        fg = null;
  const AppBadge.champagne(this.text, {super.key})
      : variant = BadgeVariant.champagne,
        bg = null,
        fg = null;
  const AppBadge.neutral(this.text, {super.key})
      : variant = BadgeVariant.neutral,
        bg = null,
        fg = null;
  const AppBadge.success(this.text, {super.key})
      : variant = BadgeVariant.success,
        bg = null,
        fg = null;
  const AppBadge.error(this.text, {super.key})
      : variant = BadgeVariant.error,
        bg = null,
        fg = null;

  final String text;
  final Color? bg;
  final Color? fg;
  final BadgeVariant variant;

  ({Color bg, Color fg, Color? border}) _resolve(AppColors c) {
    switch (variant) {
      case BadgeVariant.violet:
        return (bg: c.magicSubtle, fg: c.magic, border: c.magicLine);
      case BadgeVariant.champagne:
        return (bg: c.goldSubtle, fg: c.gold, border: c.champagneLine);
      case BadgeVariant.neutral:
        return (bg: c.surface2, fg: c.textSecondary, border: c.border);
      case BadgeVariant.success:
        return (bg: c.successSubtle, fg: c.success, border: null);
      case BadgeVariant.error:
        return (bg: c.errorSubtle, fg: c.error, border: null);
      case BadgeVariant.custom:
        return (bg: bg ?? c.surface2, fg: fg ?? c.textSecondary, border: null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _resolve(context.colors);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: r.bg,
        borderRadius: BorderRadius.circular(8),
        border: r.border != null ? Border.all(color: r.border!) : null,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: r.fg,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
