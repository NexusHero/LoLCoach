import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/theme/app_theme.dart';
import 'package:lol_coach/widgets/recommendation_panel.dart';

void main() {
  group('RecommendationPanel', () {
    testWidgets(
      'RecommendationPanel_LlmSource_ShowsAiBadgeAndItemDetails',
      (WidgetTester tester) async {
        const recommendation = ItemRecommendation(
          source: RecommendationSource.llm,
          provider: 'claude',
          reasoning: 'Claude says this is a good item against high AP burst.',
          items: [
            RecommendedItem(
              id: 3102,
              name: "Banshee's Veil",
              reason: 'Blocks initial burst combo',
              priority: ItemPriority.core,
            ),
          ],
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: RecommendationPanel(recommendation: recommendation),
            ),
          ),
        );

        // The hero eyebrow + the core item, rendered in the new layout.
        expect(find.text('BUILD PLAN'), findsOneWidget);
        expect(find.text("Banshee's Veil"), findsOneWidget);
        expect(find.text('Core'), findsOneWidget);
        expect(find.text('Blocks initial burst combo'), findsOneWidget);
        // With no strategy, the reasoning headlines the card.
        expect(
          find.text('Claude says this is a good item against high AP burst.'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'RecommendationPanel_EmptyHeuristicSource_ShowsAutoBadgeAndReasoning',
      (WidgetTester tester) async {
        const recommendation = ItemRecommendation(
          source: RecommendationSource.heuristic,
          provider: 'heuristic',
          reasoning:
              'Enemy comp is balanced. No specific counter items needed.',
          items: [],
        );

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: const Scaffold(
              body: RecommendationPanel(recommendation: recommendation),
            ),
          ),
        );

        // Heuristic source → quieter "SUGGESTED" eyebrow; with no items the
        // reasoning headlines the card.
        expect(find.text('SUGGESTED'), findsOneWidget);
        expect(
          find.text(
            'Enemy comp is balanced. No specific counter items needed.',
          ),
          findsOneWidget,
        );
      },
    );
  });
}
