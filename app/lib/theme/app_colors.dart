import 'package:material_ui/material_ui.dart';

/// Semantic colour palette exposed as a [ThemeExtension] so the same field
/// names resolve to different values per theme (dark / light).
///
/// Access from widgets via `context.colors.<field>` (see the [AppColorsX]
/// extension at the bottom of this file). The getter falls back to
/// [AppColors.dark] when no extension is registered, so widgets render safely
/// inside bare `MaterialApp`s (e.g. in widget tests).
///
/// The palette follows the **Elevated** glass direction. Field names are kept
/// stable for the call-sites that read them; their semantics:
/// - [gold]  = win-condition / gold economy accent (champagne). Sparingly.
/// - [magic] = the AI signature accent (violet). Sweeping border, live pill.
/// - [success]/[error]/[warning] = status
/// - [allyBlue]/[enemyRed] = team affiliation in the scoreboard
///
/// Glass surfaces ([surfaceDark]) are intentionally **translucent** — they
/// only read correctly over the gradient canvas painted by `AppBackground`.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bgDark,
    required this.bgGradientEnd,
    required this.bgGlow,
    required this.surfaceDark,
    required this.surface2,
    required this.surfaceMedium,
    required this.border,
    required this.borderAccent,
    required this.hairlineSoft,
    required this.textPrimary,
    required this.textSecondary,
    required this.textDisabled,
    required this.gold,
    required this.goldSubtle,
    required this.champagneLine,
    required this.cyan,
    required this.cyanSubtle,
    required this.success,
    required this.successSubtle,
    required this.error,
    required this.errorLight,
    required this.errorSubtle,
    required this.warning,
    required this.magic,
    required this.magicHot,
    required this.magicSubtle,
    required this.magicLine,
    required this.allyBlue,
    required this.allySubtle,
    required this.enemyRed,
  });

  // Canvas (full-page background — painted by AppBackground)
  final Color bgDark;
  final Color bgGradientEnd;
  final Color bgGlow;

  // Glass surfaces
  final Color surfaceDark; // primary glass panel fill (translucent)
  final Color surface2; // raised area within glass
  final Color surfaceMedium; // non-glass solid fallback

  // Hairlines (borders)
  final Color border;
  final Color borderAccent;
  final Color hairlineSoft;

  // Text
  final Color textPrimary;
  final Color textSecondary;
  final Color textDisabled;

  // Win-condition / gold accent (champagne) — use sparingly
  final Color gold;
  final Color goldSubtle;
  final Color champagneLine;

  // Functional accent (kept for the risk control "safe" segment)
  final Color cyan;
  final Color cyanSubtle;

  // Status
  final Color success;
  final Color successSubtle;
  final Color error;
  final Color errorLight;
  final Color errorSubtle;
  final Color warning;

  // AI signature accent (violet)
  final Color magic;
  final Color magicHot;
  final Color magicSubtle;
  final Color magicLine;

  // Team colours
  final Color allyBlue;
  final Color allySubtle;
  final Color enemyRed;

  /// Dark palette — the canonical default. Apple-grade glass over a near-black
  /// violet-tinted canvas.
  static const AppColors dark = AppColors(
    bgDark: Color(0xFF08080C),
    bgGradientEnd: Color(0xFF0C0C12),
    bgGlow: Color(0x248B5CF6), // violet @0.14
    surfaceDark: Color(0xA814141A), // rgba(20,20,26,0.66) glass
    surface2: Color(0x0AFFFFFF), // white @0.04
    surfaceMedium: Color(0xFF16161C), // solid fallback
    border: Color(0x14FFFFFF), // white @0.08
    borderAccent: Color(0x24FFFFFF), // white @0.14
    hairlineSoft: Color(0x0DFFFFFF), // white @0.05
    textPrimary: Color(0xFFF5F5F7),
    textSecondary: Color(0xA8F5F5F7), // @0.66 — 7.6:1 on glass card
    textDisabled: Color(0x80F5F5F7), // @0.50 — 4.9:1 on glass card (WCAG AA)
    gold: Color(0xFFE7C896), // champagne
    goldSubtle: Color(0x1AE7C896), // @0.10
    champagneLine: Color(0x38E7C896), // @0.22
    cyan: Color(0xFF5EC8E0),
    cyanSubtle: Color(0x1F5EC8E0),
    success: Color(0xFF34D399),
    successSubtle: Color(0x1F34D399),
    error: Color(0xFFF87171),
    errorLight: Color(0xFFF87171),
    errorSubtle: Color(0x1FF87171),
    warning: Color(0xFFFBBF24),
    magic: Color(0xFFA78BFA), // violet
    magicHot: Color(0xFF8B5CF6), // violet-hot
    magicSubtle: Color(0x1F8B5CF6), // @0.12
    magicLine: Color(0x478B5CF6), // @0.28
    allyBlue: Color(0xFF6EA8E8),
    allySubtle: Color(0x2E6EA8E8),
    enemyRed: Color(0xFFE89A9A),
  );

  /// Light palette — Apple bright glass. Same semantics as [dark]; hues
  /// darkened for WCAG-AA contrast on light surfaces.
  static const AppColors light = AppColors(
    bgDark: Color(0xFFECECF0),
    bgGradientEnd: Color(0xFFF5F5F7),
    bgGlow: Color(0x1A7C3AED), // violet @0.10
    surfaceDark: Color(0xB8FFFFFF), // rgba(255,255,255,0.72) glass
    surface2: Color(0x08000000), // black @0.03
    surfaceMedium: Color(0xFFFFFFFF),
    border: Color(0x14000000), // black @0.08
    borderAccent: Color(0x24000000), // black @0.14
    hairlineSoft: Color(0x0D000000), // black @0.05
    textPrimary: Color(0xFF1D1D1F),
    textSecondary: Color(0xB81D1D1F), // @0.72 — 6.4:1 on glass card
    textDisabled: Color(0x9E1D1D1F), // @0.62 — 4.6:1 on glass card (WCAG AA)
    gold: Color(0xFF9A6F1E), // champagne (dark)
    goldSubtle: Color(0x149A6F1E), // @0.08
    champagneLine: Color(0x3D9A6F1E), // @0.24
    cyan: Color(0xFF0E7F94),
    cyanSubtle: Color(0xFFDCF1F5),
    success: Color(0xFF059669),
    successSubtle: Color(0x1A059669),
    error: Color(0xFFDC2626),
    errorLight: Color(0xFFDC2626),
    errorSubtle: Color(0x1ADC2626),
    warning: Color(0xFFB45309),
    magic: Color(0xFF7C3AED), // violet (dark)
    magicHot: Color(0xFF6D28D9),
    magicSubtle: Color(0x147C3AED), // @0.08
    magicLine: Color(0x387C3AED), // @0.22
    allyBlue: Color(0xFF2563EB),
    allySubtle: Color(0x262563EB),
    enemyRed: Color(0xFFDC2626),
  );

  @override
  AppColors copyWith({
    Color? bgDark,
    Color? bgGradientEnd,
    Color? bgGlow,
    Color? surfaceDark,
    Color? surface2,
    Color? surfaceMedium,
    Color? border,
    Color? borderAccent,
    Color? hairlineSoft,
    Color? textPrimary,
    Color? textSecondary,
    Color? textDisabled,
    Color? gold,
    Color? goldSubtle,
    Color? champagneLine,
    Color? cyan,
    Color? cyanSubtle,
    Color? success,
    Color? successSubtle,
    Color? error,
    Color? errorLight,
    Color? errorSubtle,
    Color? warning,
    Color? magic,
    Color? magicHot,
    Color? magicSubtle,
    Color? magicLine,
    Color? allyBlue,
    Color? allySubtle,
    Color? enemyRed,
  }) {
    return AppColors(
      bgDark: bgDark ?? this.bgDark,
      bgGradientEnd: bgGradientEnd ?? this.bgGradientEnd,
      bgGlow: bgGlow ?? this.bgGlow,
      surfaceDark: surfaceDark ?? this.surfaceDark,
      surface2: surface2 ?? this.surface2,
      surfaceMedium: surfaceMedium ?? this.surfaceMedium,
      border: border ?? this.border,
      borderAccent: borderAccent ?? this.borderAccent,
      hairlineSoft: hairlineSoft ?? this.hairlineSoft,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textDisabled: textDisabled ?? this.textDisabled,
      gold: gold ?? this.gold,
      goldSubtle: goldSubtle ?? this.goldSubtle,
      champagneLine: champagneLine ?? this.champagneLine,
      cyan: cyan ?? this.cyan,
      cyanSubtle: cyanSubtle ?? this.cyanSubtle,
      success: success ?? this.success,
      successSubtle: successSubtle ?? this.successSubtle,
      error: error ?? this.error,
      errorLight: errorLight ?? this.errorLight,
      errorSubtle: errorSubtle ?? this.errorSubtle,
      warning: warning ?? this.warning,
      magic: magic ?? this.magic,
      magicHot: magicHot ?? this.magicHot,
      magicSubtle: magicSubtle ?? this.magicSubtle,
      magicLine: magicLine ?? this.magicLine,
      allyBlue: allyBlue ?? this.allyBlue,
      allySubtle: allySubtle ?? this.allySubtle,
      enemyRed: enemyRed ?? this.enemyRed,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      bgDark: Color.lerp(bgDark, other.bgDark, t)!,
      bgGradientEnd: Color.lerp(bgGradientEnd, other.bgGradientEnd, t)!,
      bgGlow: Color.lerp(bgGlow, other.bgGlow, t)!,
      surfaceDark: Color.lerp(surfaceDark, other.surfaceDark, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surfaceMedium: Color.lerp(surfaceMedium, other.surfaceMedium, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderAccent: Color.lerp(borderAccent, other.borderAccent, t)!,
      hairlineSoft: Color.lerp(hairlineSoft, other.hairlineSoft, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      goldSubtle: Color.lerp(goldSubtle, other.goldSubtle, t)!,
      champagneLine: Color.lerp(champagneLine, other.champagneLine, t)!,
      cyan: Color.lerp(cyan, other.cyan, t)!,
      cyanSubtle: Color.lerp(cyanSubtle, other.cyanSubtle, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSubtle: Color.lerp(successSubtle, other.successSubtle, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorLight: Color.lerp(errorLight, other.errorLight, t)!,
      errorSubtle: Color.lerp(errorSubtle, other.errorSubtle, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      magic: Color.lerp(magic, other.magic, t)!,
      magicHot: Color.lerp(magicHot, other.magicHot, t)!,
      magicSubtle: Color.lerp(magicSubtle, other.magicSubtle, t)!,
      magicLine: Color.lerp(magicLine, other.magicLine, t)!,
      allyBlue: Color.lerp(allyBlue, other.allyBlue, t)!,
      allySubtle: Color.lerp(allySubtle, other.allySubtle, t)!,
      enemyRed: Color.lerp(enemyRed, other.enemyRed, t)!,
    );
  }
}

/// Ergonomic access to the active [AppColors] palette.
///
/// Falls back to [AppColors.dark] when the extension is not registered, so
/// widgets stay render-safe in any `MaterialApp` (incl. bare test harnesses).
extension AppColorsX on BuildContext {
  AppColors get colors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.dark;
}
