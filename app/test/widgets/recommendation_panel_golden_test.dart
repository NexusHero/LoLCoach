// Golden tests for RecommendationPanel.
//
// Generate baseline files on first run:
//   flutter test --update-goldens \
//     test/widgets/recommendation_panel_golden_test.dart
//
// On subsequent runs the snapshots are compared pixel-by-pixel.
// Golden files are committed under test/goldens/ and reviewed in PRs.
//
// These tests are tagged 'golden' and excluded from CI (platform rendering
// differs between macOS and Linux). Run locally before visual changes.
@Tags(['golden'])
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/recommendation_panel.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  group('RecommendationPanel — golden tests', () {
    testWidgets(
      'RecommendationPanel_LlmSourceWithItems_MatchesGolden',
      (WidgetTester tester) async {
        const recommendation = ItemRecommendation(
          source: RecommendationSource.llm,
          provider: 'claude',
          reasoning: 'Enemies have 3 CC champions. QSS is essential.',
          items: [
            RecommendedItem(
              id: 3140,
              name: 'Quicksilver Sash',
              reason: 'Cleanses CC',
              priority: ItemPriority.core,
            ),
            RecommendedItem(
              id: 3102,
              name: "Banshee's Veil",
              reason: 'Blocks initiation spell',
              priority: ItemPriority.situational,
            ),
          ],
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: SizedBox(
                width: 400,
                child: RecommendationPanel(recommendation: recommendation),
              ),
            ),
          ),
        );

        await expectLater(
          find.byType(RecommendationPanel),
          matchesGoldenFile('goldens/recommendation_panel_llm.png'),
        );
      },
    );

    testWidgets(
      'RecommendationPanel_HeuristicEmptyItems_MatchesGolden',
      (WidgetTester tester) async {
        const recommendation = ItemRecommendation(
          source: RecommendationSource.heuristic,
          provider: 'heuristic',
          reasoning: 'Balanced comp — no specific counters needed.',
          items: [],
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: SizedBox(
                width: 400,
                child: RecommendationPanel(recommendation: recommendation),
              ),
            ),
          ),
        );

        await expectLater(
          find.byType(RecommendationPanel),
          matchesGoldenFile(
            'goldens/recommendation_panel_heuristic_empty.png',
          ),
        );
      },
    );
  });
}
