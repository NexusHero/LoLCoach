import 'package:flutter_test/flutter_test.dart';
import 'package:lol_coach/models/analysis.dart';

import '../widgets/analysis_fixtures.dart';

void main() {
  group('AnalysisSnapshot.fromJson', () {
    test('minimal snapshot falls back to defaults', () {
      final s = AnalysisSnapshot.fromJson(const {
        'region': 'NA',
        'matches': <dynamic>[],
        'benchmarks': <dynamic>[],
        'sync': {'state': 'syncing'},
        'aggregation': {'state': 'idle', 'tiers': <dynamic>[]},
      });
      expect(s.riotId, isNull);
      expect(s.region, 'NA');
      expect(s.rank, isNull);
      expect(s.goal, isNull);
      expect(s.keyProblem, isNull);
      expect(s.matches, isEmpty);
      expect(s.sync.state, 'syncing');
      expect(s.aggregation.state, 'idle');
      expect(s.average(AnalysisMetric.csDiff10), isNull);
    });

    test('empty object does not throw', () {
      final s = AnalysisSnapshot.fromJson(const {});
      expect(s.region, 'EUW');
      expect(s.sync.state, 'idle');
      expect(s.aggregation.tiers, isEmpty);
    });

    test('full snapshot parses every section', () {
      final s = AnalysisSnapshot.fromJson(fullSnapshotJson());
      expect(s.riotId, 'Tester#EUW');
      expect(s.rank!.tier, 'GOLD');
      expect(s.rank!.leaguePoints, 45);
      expect(s.nextTier, 'PLATINUM');
      expect(s.matches, hasLength(3));

      final m = s.matches.first;
      expect(m.win, isTrue);
      expect(m.opponentChampion, 'Zed');
      expect(m.kda, '7/2/9');
      expect(m.earlyDeaths.single.time, 245);
      expect(m.earlyDeaths.single.enemiesInvolved, 2);
      expect(m.minuteDiffs, hasLength(15));
      expect(m.firstCoreItemMinute, 13.5);
      expect(m.shopVisits.single.itemsBought, contains('Lost Chapter'));
      expect(m.aiReview, isNotNull);
      expect(s.matches[1].aiReview, isNull);

      expect(m.gold15, 5400);
      final plat = s.benchmarkFor('PLATINUM')!;
      expect(plat.sampleSize, 400);
      expect(plat.gold15, 5200);
      expect(AnalysisMetric.gold15.benchmarkOf(plat), 5200);
      expect(AnalysisMetric.csDiff10.benchmarkOf(plat), isNull);
      expect(s.benchmarkFor('MASTER'), isNull);

      final g = s.goal!;
      expect(g.metric, AnalysisMetric.earlyDeaths);
      expect(g.results, [true, false, true]);
      expect(g.status, GoalStatus.active);

      expect(s.backfillSummary, isNotNull);
      expect(s.sync.lastSyncAt, 1763400000000);
      expect(s.aggregation.tiers[1].fraction, closeTo(0.3, 1e-9));
      expect(s.average(AnalysisMetric.earlyDeaths), closeTo(1 / 3, 1e-9));
    });

    test('AnalysisAnswer and formatGameTime', () {
      final a = AnalysisAnswer.fromJson(const {
        'requestId': 'r1',
        'error': 'No provider',
      });
      expect(a.requestId, 'r1');
      expect(a.answer, isNull);
      expect(a.error, 'No provider');
      expect(formatGameTime(245), '4:05');
    });
  });
}
