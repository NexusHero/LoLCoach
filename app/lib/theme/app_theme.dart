import 'package:lol_coach/theme/app_colors.dart';
import 'package:material_ui/material_ui.dart';

/// Builds the app's [ThemeData] for both light and dark from a single
/// [AppColors] palette, registering that palette as a [ThemeExtension] so
/// widgets can read it via `context.colors`.
///
/// The scaffold is transparent — the gradient canvas is painted by
/// `AppBackground` so translucent glass surfaces have something to sample.
class AppTheme {
  const AppTheme._();

  static final ThemeData dark = _build(AppColors.dark, Brightness.dark);
  static final ThemeData light = _build(AppColors.light, Brightness.light);

  static ThemeData _build(AppColors c, Brightness brightness) {
    final base =
        brightness == Brightness.dark ? ThemeData.dark() : ThemeData.light();

    final scheme = (brightness == Brightness.dark
            ? const ColorScheme.dark()
            : const ColorScheme.light())
        .copyWith(
      primary: c.magic,
      secondary: c.magic,
      surface: c.surfaceMedium,
      error: c.error,
      onPrimary: Colors.white,
      onSurface: c.textPrimary,
      onSurfaceVariant: c.textSecondary,
      outline: c.border,
      // SegmentedButton selected state
      secondaryContainer: c.magicSubtle,
      onSecondaryContainer: c.magic,
    );

    return base.copyWith(
      // Transparent — the canvas is drawn by AppBackground.
      scaffoldBackgroundColor: Colors.transparent,
      colorScheme: scheme,
      extensions: [c],
      // Base text colour for colourless AppTextStyles.
      textTheme: base.textTheme.apply(
        bodyColor: c.textPrimary,
        displayColor: c.textPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: c.textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.magicHot,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.1,
          ),
          shape: const StadiumBorder(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.magic, width: 1.5),
        ),
        labelStyle: TextStyle(color: c.textSecondary),
        hintStyle: TextStyle(color: c.textDisabled),
      ),
      dividerTheme: DividerThemeData(color: c.border),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: Colors.transparent,
        selectedIconTheme: IconThemeData(color: c.magic),
        unselectedIconTheme: IconThemeData(color: c.textSecondary),
        selectedLabelTextStyle: TextStyle(
          color: c.magic,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelTextStyle: TextStyle(
          color: c.textSecondary,
          fontSize: 12,
        ),
        useIndicator: true,
        indicatorColor: c.magicSubtle,
      ),
    );
  }
}
