import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/widgets/analysis/analysis_header.dart';
import 'package:lol_coach/widgets/analysis/ask_card.dart';
import 'package:lol_coach/widgets/analysis/goal_card.dart';
import 'package:lol_coach/widgets/analysis/match_list.dart';
import 'package:lol_coach/widgets/analysis/metric_tiles.dart';
import 'package:lol_coach/widgets/analysis/pro_depth.dart';
import 'package:lol_coach/widgets/analysis/status_cards.dart';
import 'package:lol_coach/widgets/analysis/trend_card.dart';
import 'package:material_ui/material_ui.dart';

/// Width at which the board switches to the 2-column bento layout.
const analysisWideBreakpoint = 900.0;

/// The full post-game review board for one [AnalysisSnapshot]. Pure widget:
/// every action goes through a callback.
class AnalysisBoard extends StatelessWidget {
  const AnalysisBoard({
    required this.snapshot,
    this.questions = const [],
    this.onRefresh,
    this.onAsk,
    this.onOpenSettings,
    this.refreshing = false,
    this.connected = true,
    super.key,
  });

  final AnalysisSnapshot snapshot;
  final List<AnalysisQuestion> questions;
  final VoidCallback? onRefresh;
  final ValueChanged<String>? onAsk;
  final VoidCallback? onOpenSettings;
  final bool refreshing;
  final bool connected;

  @override
  Widget build(BuildContext context) {
    final s = snapshot;
    const gap = SizedBox(height: 16);

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= analysisWideBreakpoint;
        final hasMatches = s.matches.isNotEmpty;

        final top = <Widget>[
          AnalysisHeader(
            snapshot: s,
            onRefresh: connected ? onRefresh : null,
            refreshing: refreshing,
          ),
          if (s.keyProblem != null) ...[
            gap,
            KeyProblemCard(keyProblem: s.keyProblem!),
          ],
          if (s.riotId == null) ...[
            gap,
            MissingRiotIdCard(onOpenSettings: onOpenSettings),
          ],
        ];

        final main = <Widget>[
          if (s.goal != null)
            GoalCard(goal: s.goal!)
          else
            GoalPlaceholderCard(
              nextTier: s.nextTier,
              progress: _tierProgress(s),
            ),
          gap,
          if (hasMatches) ...[
            MetricTiles(snapshot: s),
            gap,
            TrendCard(snapshot: s),
            gap,
            MatchListCard(matches: s.matches),
          ] else
            const NoMatchesCard(),
        ];

        final side = <Widget>[
          AskHistoryCard(
            questions: questions,
            onAsk: onAsk,
            enabled: connected && hasMatches,
          ),
          if (s.backfillSummary != null) ...[
            gap,
            BackfillSummaryCard(summary: s.backfillSummary!),
          ],
          gap,
          AggregationCard(aggregation: s.aggregation),
        ];

        final proDepth = hasMatches
            ? <Widget>[gap, ProDepthSection(matches: s.matches, wide: wide)]
            : const <Widget>[];

        final Widget body;
        if (wide) {
          body = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ...top,
              gap,
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: main,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: side,
                    ),
                  ),
                ],
              ),
              ...proDepth,
            ],
          );
        } else {
          body = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [...top, gap, ...main, gap, ...side, ...proDepth],
          );
        }

        return SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            horizontal: wide ? 24 : 16,
            vertical: 16,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1280),
              child: body,
            ),
          ),
        );
      },
    );
  }
}

TierProgress? _tierProgress(AnalysisSnapshot s) {
  for (final t in s.aggregation.tiers) {
    if (t.tier == s.nextTier) return t;
  }
  return null;
}
