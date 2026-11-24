// Dart mirror of core/src/analysisTypes.ts — the post-game review board.
//
// Every `fromJson` is tolerant: missing or mistyped fields fall back to
// neutral defaults so a partially filled snapshot from the core never throws.

/// Rank tiers in ladder order.
const analysisTiers = <String>[
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];

/// Metrics shown on the board. The first four are the benchmarked
/// headline metrics (contract `MetricKey`); [csDiff10] and [goldDiff15] are
/// lane diffs that only exist per match (they average to zero over a rank,
/// so there is no benchmark for them).
enum AnalysisMetric {
  cs10('cs10', 'CS AT 10:00', 'CS @10'),
  earlyDeaths('earlyDeaths', 'DEATHS BEFORE 14:00', 'Deaths <14'),
  gold15('gold15', 'GOLD AT 15:00', 'Gold @15'),
  objectivePresence('objectivePresence', 'OBJECTIVE PRESENCE', 'Objectives'),
  csDiff10('csDiff10', 'CS DIFF @10', 'CS diff @10'),
  goldDiff15('goldDiff15', 'GOLD DIFF @15', 'Gold diff @15');

  const AnalysisMetric(this.key, this.label, this.shortLabel);

  final String key;
  final String label;
  final String shortLabel;

  /// The four benchmarked headline metrics, in tile order.
  static const headline = [cs10, earlyDeaths, gold15, objectivePresence];

  /// Higher is better for every metric except [earlyDeaths].
  bool get lowerIsBetter => this == AnalysisMetric.earlyDeaths;

  /// Whether a [Benchmark] carries a value for this metric.
  bool get hasBenchmark => headline.contains(this);

  static AnalysisMetric? fromKey(String? key) {
    for (final m in values) {
      if (m.key == key) return m;
    }
    return null;
  }

  /// Raw value of this metric for one match.
  double valueOf(MatchReview m) => switch (this) {
        AnalysisMetric.cs10 => m.cs10,
        AnalysisMetric.earlyDeaths => m.earlyDeaths.length.toDouble(),
        AnalysisMetric.gold15 => m.gold15,
        AnalysisMetric.objectivePresence => m.objectivePresence,
        AnalysisMetric.csDiff10 => m.csDiff10,
        AnalysisMetric.goldDiff15 => m.goldDiff15,
      };

  /// Benchmark value of this metric, or null for the diff metrics.
  double? benchmarkOf(Benchmark b) => switch (this) {
        AnalysisMetric.cs10 => b.cs10,
        AnalysisMetric.earlyDeaths => b.earlyDeaths,
        AnalysisMetric.gold15 => b.gold15,
        AnalysisMetric.objectivePresence => b.objectivePresence,
        AnalysisMetric.csDiff10 || AnalysisMetric.goldDiff15 => null,
      };

  /// Human formatting (signed diffs, % for presence).
  String format(double v) {
    switch (this) {
      case AnalysisMetric.csDiff10:
      case AnalysisMetric.goldDiff15:
        final r = v.round();
        return r > 0 ? '+$r' : '$r';
      case AnalysisMetric.cs10:
      case AnalysisMetric.gold15:
        return '${v.round()}';
      case AnalysisMetric.earlyDeaths:
        return v.toStringAsFixed(1);
      case AnalysisMetric.objectivePresence:
        return '${(v * 100).round()}%';
    }
  }

  /// Whether [value] meets or beats [benchmark] for this metric.
  bool beats(double value, double benchmark) =>
      lowerIsBetter ? value <= benchmark : value >= benchmark;
}

double _d(Object? v, [double fallback = 0]) =>
    v is num ? v.toDouble() : fallback;
double? _dn(Object? v) => v is num ? v.toDouble() : null;
int _i(Object? v, [int fallback = 0]) => v is num ? v.toInt() : fallback;
int? _in(Object? v) => v is num ? v.toInt() : null;
String _s(Object? v, [String fallback = '']) => v is String ? v : fallback;
String? _sn(Object? v) => v is String && v.isNotEmpty ? v : null;
Map<String, dynamic> _m(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
List<T> _list<T>(Object? v, T Function(Map<String, dynamic>) parse) => v is List
    ? v.whereType<Map<dynamic, dynamic>>().map((e) => parse(_m(e))).toList()
    : <T>[];

class EarlyDeath {
  const EarlyDeath({
    required this.time,
    this.zone = '',
    this.killerChampion = '',
    this.enemiesInvolved = 1,
  });

  factory EarlyDeath.fromJson(Map<String, dynamic> json) => EarlyDeath(
        time: _i(json['time']),
        zone: _s(json['zone']),
        killerChampion: _s(json['killerChampion']),
        enemiesInvolved: _i(json['enemiesInvolved'], 1),
      );

  /// Game time in seconds.
  final int time;
  final String zone;
  final String killerChampion;
  final int enemiesInvolved;
}

class ObjectiveEvent {
  const ObjectiveEvent({
    required this.time,
    this.type = '',
    this.ownTeam = false,
    this.present = false,
  });

  factory ObjectiveEvent.fromJson(Map<String, dynamic> json) => ObjectiveEvent(
        time: _i(json['time']),
        type: _s(json['type']),
        ownTeam: json['ownTeam'] == true,
        present: json['present'] == true,
      );

  /// Game time in seconds.
  final int time;

  /// DRAGON, BARON_NASHOR, RIFTHERALD, HORDE (voidgrubs), ATAKHAN.
  final String type;

  /// Did the player's team take it?
  final bool ownTeam;
  final bool present;
}

/// Where the player's recent average stands within one tier's laners.
class Standing {
  const Standing({
    required this.tier,
    required this.metric,
    this.percentile = 0,
  });

  factory Standing.fromJson(Map<String, dynamic> json) => Standing(
        tier: _s(json['tier']),
        metric: _s(json['metric']),
        percentile: _d(json['percentile']).clamp(0, 100).toDouble(),
      );

  final String tier;

  /// Contract MetricKey (cs10 | earlyDeaths | gold15 | objectivePresence).
  final String metric;

  /// 0–100: share of the tier's laners the player beats (already inverted
  /// for earlyDeaths).
  final double percentile;

  /// "Top 32%" / "Bottom 20%".
  String get label {
    final p = percentile.round();
    if (p < 50) return 'Bottom ${p.clamp(1, 100)}%';
    return 'Top ${(100 - p).clamp(1, 100)}%';
  }
}

class MinuteDiff {
  const MinuteDiff({
    required this.minute,
    this.gold = 0,
    this.xp = 0,
    this.cs = 0,
  });

  factory MinuteDiff.fromJson(Map<String, dynamic> json) => MinuteDiff(
        minute: _i(json['minute']),
        gold: _d(json['gold']),
        xp: _d(json['xp']),
        cs: _d(json['cs']),
      );

  final int minute;
  final double gold;
  final double xp;
  final double cs;
}

class ShopVisit {
  const ShopVisit({
    required this.time,
    this.goldBefore = 0,
    this.itemsBought = const [],
    this.itemIds = const [],
  });

  factory ShopVisit.fromJson(Map<String, dynamic> json) => ShopVisit(
        time: _i(json['time']),
        goldBefore: _i(json['goldBefore']),
        itemsBought: (json['itemsBought'] is List)
            ? (json['itemsBought'] as List).map((e) => '$e').toList()
            : const [],
        itemIds: (json['itemIds'] is List)
            ? [for (final e in json['itemIds'] as List) _i(e)]
            : const [],
      );

  /// Game time in seconds of the first purchase in the visit.
  final int time;
  final int goldBefore;
  final List<String> itemsBought;

  /// Item ids parallel to [itemsBought]; empty for reviews from older cores.
  final List<int> itemIds;
}

class MatchReview {
  const MatchReview({
    required this.matchId,
    this.gameStart = 0,
    this.durationSec = 0,
    this.patch = '',
    this.win = false,
    this.role = '',
    this.champion = '',
    this.opponentChampion,
    this.kills = 0,
    this.deaths = 0,
    this.assists = 0,
    this.cs10 = 0,
    this.csDiff10 = 0,
    this.earlyDeaths = const [],
    this.gold15 = 0,
    this.goldDiff15 = 0,
    this.xpDiff15 = 0,
    this.objectivePresence = 0,
    this.objectivesTotal = 0,
    this.objectivesPresent = 0,
    this.minuteDiffs = const [],
    this.firstCoreItemMinute,
    this.firstCoreItem,
    this.firstCoreItemId,
    this.shopVisits = const [],
    this.objectiveEvents = const [],
    this.aiReview,
  });

  factory MatchReview.fromJson(Map<String, dynamic> json) => MatchReview(
        matchId: _s(json['matchId']),
        gameStart: _i(json['gameStart']),
        durationSec: _i(json['durationSec']),
        patch: _s(json['patch']),
        win: json['win'] == true,
        role: _s(json['role']),
        champion: _s(json['champion']),
        opponentChampion: _sn(json['opponentChampion']),
        kills: _i(json['kills']),
        deaths: _i(json['deaths']),
        assists: _i(json['assists']),
        cs10: _d(json['cs10']),
        csDiff10: _d(json['csDiff10']),
        earlyDeaths: _list(json['earlyDeaths'], EarlyDeath.fromJson),
        gold15: _d(json['gold15']),
        goldDiff15: _d(json['goldDiff15']),
        xpDiff15: _d(json['xpDiff15']),
        objectivePresence: _d(json['objectivePresence']),
        objectivesTotal: _i(json['objectivesTotal']),
        objectivesPresent: _i(json['objectivesPresent']),
        minuteDiffs: _list(json['minuteDiffs'], MinuteDiff.fromJson),
        firstCoreItemMinute: _dn(json['firstCoreItemMinute']),
        firstCoreItem: _sn(json['firstCoreItem']),
        firstCoreItemId: _in(json['firstCoreItemId']),
        shopVisits: _list(json['shopVisits'], ShopVisit.fromJson),
        objectiveEvents:
            _list(json['objectiveEvents'], ObjectiveEvent.fromJson),
        aiReview: _sn(json['aiReview']),
      );

  final String matchId;

  /// Epoch milliseconds of game start.
  final int gameStart;
  final int durationSec;
  final String patch;
  final bool win;
  final String role;
  final String champion;
  final String? opponentChampion;
  final int kills;
  final int deaths;
  final int assists;

  final double cs10;
  final double csDiff10;
  final List<EarlyDeath> earlyDeaths;

  /// Total gold at 15:00.
  final double gold15;
  final double goldDiff15;
  final double xpDiff15;

  /// Share (0–1) of epic objectives where the player was present.
  final double objectivePresence;
  final int objectivesTotal;
  final int objectivesPresent;

  final List<MinuteDiff> minuteDiffs;
  final double? firstCoreItemMinute;
  final String? firstCoreItem;
  final int? firstCoreItemId;
  final List<ShopVisit> shopVisits;

  /// Epic objectives with their taker and the player's presence; may be
  /// empty for older games.
  final List<ObjectiveEvent> objectiveEvents;

  /// LLM-written review, absent for backfilled games.
  final String? aiReview;

  String get kda => '$kills/$deaths/$assists';
}

class Benchmark {
  const Benchmark({
    required this.tier,
    this.role = '',
    this.patch = '',
    this.sampleSize = 0,
    this.cs10 = 0,
    this.earlyDeaths = 0,
    this.gold15 = 0,
    this.objectivePresence = 0,
  });

  factory Benchmark.fromJson(Map<String, dynamic> json) => Benchmark(
        tier: _s(json['tier']),
        role: _s(json['role']),
        patch: _s(json['patch']),
        sampleSize: _i(json['sampleSize']),
        cs10: _d(json['cs10']),
        earlyDeaths: _d(json['earlyDeaths']),
        gold15: _d(json['gold15']),
        objectivePresence: _d(json['objectivePresence']),
      );

  final String tier;
  final String role;
  final String patch;
  final int sampleSize;
  final double cs10;
  final double earlyDeaths;
  final double gold15;
  final double objectivePresence;
}

enum GoalStatus { active, achieved, repeat }

class TrainingGoal {
  const TrainingGoal({
    required this.id,
    required this.metric,
    this.target = 0,
    this.text = '',
    this.basedOnTier = '',
    this.matchIds = const [],
    this.results = const [],
    this.status = GoalStatus.active,
    this.createdAt = 0,
  });

  factory TrainingGoal.fromJson(Map<String, dynamic> json) => TrainingGoal(
        id: _s(json['id']),
        metric: AnalysisMetric.fromKey(json['metric'] as String?) ??
            AnalysisMetric.cs10,
        target: _d(json['target']),
        text: _s(json['text']),
        basedOnTier: _s(json['basedOnTier']),
        matchIds: (json['matchIds'] is List)
            ? (json['matchIds'] as List).map((e) => '$e').toList()
            : const [],
        results: (json['results'] is List)
            ? (json['results'] as List).map((e) => e == true).toList()
            : const [],
        status: switch (json['status']) {
          'achieved' => GoalStatus.achieved,
          'repeat' => GoalStatus.repeat,
          _ => GoalStatus.active,
        },
        createdAt: _i(json['createdAt']),
      );

  final String id;
  final AnalysisMetric metric;
  final double target;
  final String text;
  final String basedOnTier;
  final List<String> matchIds;
  final List<bool> results;
  final GoalStatus status;
  final int createdAt;
}

class RankInfo {
  const RankInfo({
    this.tier = 'UNRANKED',
    this.division = '',
    this.leaguePoints = 0,
    this.wins = 0,
    this.losses = 0,
  });

  factory RankInfo.fromJson(Map<String, dynamic> json) => RankInfo(
        tier: _s(json['tier'], 'UNRANKED'),
        division: _s(json['division']),
        leaguePoints: _i(json['leaguePoints']),
        wins: _i(json['wins']),
        losses: _i(json['losses']),
      );

  final String tier;
  final String division;
  final int leaguePoints;
  final int wins;
  final int losses;

  bool get isRanked => tier != 'UNRANKED';
}

class SyncInfo {
  const SyncInfo({this.state = 'idle', this.message, this.lastSyncAt});

  factory SyncInfo.fromJson(Map<String, dynamic> json) => SyncInfo(
        state: _s(json['state'], 'idle'),
        message: _sn(json['message']),
        lastSyncAt: _in(json['lastSyncAt']),
      );

  /// 'idle' | 'syncing' | 'waiting_for_match' | 'error'
  final String state;
  final String? message;
  final int? lastSyncAt;
}

class TierProgress {
  const TierProgress({required this.tier, this.samples = 0, this.target = 0});

  factory TierProgress.fromJson(Map<String, dynamic> json) => TierProgress(
        tier: _s(json['tier']),
        samples: _i(json['samples']),
        target: _i(json['target']),
      );

  final String tier;
  final int samples;
  final int target;

  double get fraction =>
      target <= 0 ? 0 : (samples / target).clamp(0, 1).toDouble();
}

class AggregationProgress {
  const AggregationProgress({
    this.state = 'idle',
    this.tiers = const [],
    this.patch,
    this.message,
  });

  factory AggregationProgress.fromJson(Map<String, dynamic> json) =>
      AggregationProgress(
        state: _s(json['state'], 'idle'),
        tiers: _list(json['tiers'], TierProgress.fromJson),
        patch: _sn(json['patch']),
        message: _sn(json['message']),
      );

  /// 'idle' | 'running' | 'paused' | 'done' | 'key_expired' | 'error'
  final String state;
  final List<TierProgress> tiers;
  final String? patch;
  final String? message;
}

class AnalysisSnapshot {
  const AnalysisSnapshot({
    this.riotId,
    this.region = 'EUW',
    this.rank,
    this.nextTier,
    this.matches = const [],
    this.benchmarks = const [],
    this.standings = const [],
    this.goal,
    this.backfillSummary,
    this.sync = const SyncInfo(),
    this.aggregation = const AggregationProgress(),
    this.keyProblem,
  });

  factory AnalysisSnapshot.fromJson(Map<String, dynamic> json) =>
      AnalysisSnapshot(
        riotId: _sn(json['riotId']),
        region: _s(json['region'], 'EUW'),
        rank: json['rank'] is Map ? RankInfo.fromJson(_m(json['rank'])) : null,
        nextTier: _sn(json['nextTier']),
        matches: _list(json['matches'], MatchReview.fromJson),
        benchmarks: _list(json['benchmarks'], Benchmark.fromJson),
        standings: _list(json['standings'], Standing.fromJson),
        goal: json['goal'] is Map
            ? TrainingGoal.fromJson(_m(json['goal']))
            : null,
        backfillSummary: _sn(json['backfillSummary']),
        sync: SyncInfo.fromJson(_m(json['sync'])),
        aggregation: AggregationProgress.fromJson(_m(json['aggregation'])),
        keyProblem: _sn(json['keyProblem']),
      );

  final String? riotId;
  final String region;
  final RankInfo? rank;

  /// Tier the "next rank" benchmarks refer to.
  final String? nextTier;

  /// Newest first, at most 20.
  final List<MatchReview> matches;
  final List<Benchmark> benchmarks;

  /// Percentile standings; missing until a tier has ≥ 50 samples.
  final List<Standing> standings;
  final TrainingGoal? goal;
  final String? backfillSummary;
  final SyncInfo sync;
  final AggregationProgress aggregation;

  /// 'missing' | 'invalid_or_expired'
  final String? keyProblem;

  /// Benchmark for [tier], preferring the role of the newest match.
  Standing? standingFor(String? tier, AnalysisMetric metric) {
    if (tier == null) return null;
    for (final st in standings) {
      if (st.tier == tier && st.metric == metric.key) return st;
    }
    return null;
  }

  /// Current streak over [matches] (newest first): +n wins or -n losses,
  /// 0 when there are no matches.
  int get streak => computeStreak(matches);

  /// Last [n] results, oldest → newest (true = win).
  List<bool> recentForm([int n = 10]) =>
      matches.take(n).map((m) => m.win).toList().reversed.toList();

  Benchmark? benchmarkFor(String? tier) {
    if (tier == null) return null;
    final candidates = benchmarks.where((b) => b.tier == tier).toList();
    if (candidates.isEmpty) return null;
    final role = matches.isNotEmpty ? matches.first.role : null;
    return candidates.firstWhere(
      (b) => b.role == role,
      orElse: () => candidates.first,
    );
  }

  /// Average of [metric] over [matches], or null when there are none.
  double? average(AnalysisMetric metric) {
    if (matches.isEmpty) return null;
    final sum = matches.fold<double>(0, (a, m) => a + metric.valueOf(m));
    return sum / matches.length;
  }
}

/// Answer to an ASK_ANALYSIS request.
class AnalysisAnswer {
  const AnalysisAnswer({required this.requestId, this.answer, this.error});

  factory AnalysisAnswer.fromJson(Map<String, dynamic> json) => AnalysisAnswer(
        requestId: _s(json['requestId']),
        answer: _sn(json['answer']),
        error: _sn(json['error']),
      );

  final String requestId;
  final String? answer;
  final String? error;
}

/// One question asked via "Ask your history", with its (pending) answer.
class AnalysisQuestion {
  const AnalysisQuestion({
    required this.requestId,
    required this.question,
    this.answer,
    this.error,
  });

  final String requestId;
  final String question;
  final String? answer;
  final String? error;

  bool get isPending => answer == null && error == null;

  AnalysisQuestion resolve(AnalysisAnswer a) => AnalysisQuestion(
        requestId: requestId,
        question: question,
        answer: a.answer,
        error: a.error ?? (a.answer == null ? 'No answer received.' : null),
      );
}

/// Formats game seconds as m:ss.
/// Streak of the newest matches (newest first): +n = n wins in a row,
/// -n = n losses in a row.
int computeStreak(List<MatchReview> newestFirst) {
  if (newestFirst.isEmpty) return 0;
  final win = newestFirst.first.win;
  var n = 0;
  for (final m in newestFirst) {
    if (m.win != win) break;
    n++;
  }
  return win ? n : -n;
}

String formatGameTime(int seconds) {
  final m = seconds ~/ 60;
  final s = (seconds % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

/// Kind of a briefing line: LLM matchup facts or the player's own history.
enum BriefingKind { trading, spike, history }

class BriefingPoint {
  const BriefingPoint({required this.kind, required this.text});

  factory BriefingPoint.fromJson(Map<String, dynamic> json) => BriefingPoint(
        kind: BriefingKind.values.firstWhere(
          (k) => k.name == json['kind'],
          orElse: () => BriefingKind.history,
        ),
        text: _s(json['text']),
      );

  final BriefingKind kind;
  final String text;
}

/// Pre-lane matchup briefing, sent by the core at game start.
class MatchupBriefing {
  const MatchupBriefing({
    required this.myChampion,
    required this.opponentChampion,
    required this.role,
    required this.points,
  });

  factory MatchupBriefing.fromJson(Map<String, dynamic> json) =>
      MatchupBriefing(
        myChampion: _s(json['myChampion']),
        opponentChampion: _s(json['opponentChampion']),
        role: _s(json['role']),
        points: _list(json['points'], BriefingPoint.fromJson)
            .where((p) => p.text.isNotEmpty)
            .toList(),
      );

  final String myChampion;
  final String opponentChampion;
  final String role;
  final List<BriefingPoint> points;
}
