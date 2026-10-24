import 'package:flutter/material.dart';

/// Typography scale — **size / weight / spacing only, no colour**.
///
/// Follows the Elevated direction: a confident SF Pro / system scale where
/// hierarchy comes from size + weight (and tight negative tracking), not
/// uppercase-everything. Colour is theme-driven: the base text colour comes
/// from `ThemeData.textTheme` (set to `AppColors.textPrimary` per theme). Where
/// a non-primary tone is wanted, set it at the call site, e.g.
/// `AppTextStyles.caption.copyWith(color: context.colors.textSecondary)`.
class AppTextStyles {
  static const _tabular = <FontFeature>[FontFeature.tabularFigures()];

  /// 26 — the single big "do this now" action.
  static const hero = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.7,
    height: 1.18,
  );

  /// 20 — screen titles ("Ready to coach").
  static const title = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.45,
  );

  /// 16 — item name, card headers, wordmark.
  static const heading = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.3,
  );

  /// 14 — primary reading text.
  static const body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: -0.14,
    height: 1.45,
  );

  static const bodyBold = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.14,
  );

  /// 13 — secondary info, context strip, reasoning.
  static const caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    letterSpacing: -0.13,
    height: 1.4,
  );

  static const captionBold = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.13,
  );

  /// 12 — sessions, footnotes, dense numerics.
  static const micro = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: -0.12,
    fontFeatures: _tabular,
  );

  /// 11 — the rare, deliberate UPPERCASE label ("DO THIS NOW", "MATCHUP").
  static const eyebrow = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.5,
  );

  /// Tabular numeric telemetry styles for HUD counters (timer, gold, KDA, CS).
  static const mono = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    fontFeatures: _tabular,
  );

  static const monoLarge = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    fontFeatures: _tabular,
  );

  // ── Back-compat aliases ────────────────────────────────────────────────
  // Older call-sites reference `display` (big brand title) and `label`
  // (uppercase section header). Map them onto the new scale.
  static const display = hero;
  static const label = eyebrow;
}
