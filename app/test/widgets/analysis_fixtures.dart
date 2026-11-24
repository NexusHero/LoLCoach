// Shared sample data for the analysis model and widget tests.

Map<String, dynamic> sampleMatch({
  required String id,
  required bool win,
  required int gameStart,
  String champion = 'Ahri',
  String? opponent = 'Zed',
  num csDiff10 = 8,
  num goldDiff15 = 450,
  List<Map<String, dynamic>> earlyDeaths = const [],
  String? aiReview,
}) =>
    {
      'matchId': id,
      'gameStart': gameStart,
      'durationSec': 1820,
      'patch': '26.22',
      'win': win,
      'role': 'MIDDLE',
      'champion': champion,
      if (opponent != null) 'opponentChampion': opponent,
      'kills': 7,
      'deaths': 2,
      'assists': 9,
      'cs10': 82,
      'csDiff10': csDiff10,
      'earlyDeaths': earlyDeaths,
      'gold15': 5400,
      'goldDiff15': goldDiff15,
      'xpDiff15': 210,
      'objectivePresence': 0.6,
      'objectivesTotal': 5,
      'objectivesPresent': 3,
      'minuteDiffs': [
        for (var m = 1; m <= 15; m++)
          {'minute': m, 'gold': m * 30 - 100, 'xp': m * 15, 'cs': m - 5},
      ],
      'objectiveEvents': [
        {'time': 330, 'type': 'HORDE', 'ownTeam': true, 'present': true},
        {'time': 610, 'type': 'DRAGON', 'ownTeam': false, 'present': false},
      ],
      'firstCoreItemMinute': 13.5,
      'firstCoreItem': "Luden's Companion",
      'shopVisits': [
        {
          'time': 412,
          'goldBefore': 1350,
          'itemsBought': ['Lost Chapter', 'Control Ward'],
        },
      ],
      if (aiReview != null) 'aiReview': aiReview,
    };

Map<String, dynamic> fullSnapshotJson() => {
      'riotId': 'Tester#EUW',
      'region': 'EUW',
      'rank': {
        'tier': 'GOLD',
        'division': 'II',
        'leaguePoints': 45,
        'wins': 30,
        'losses': 25,
      },
      'nextTier': 'PLATINUM',
      'matches': [
        sampleMatch(
          id: 'EUW1_3',
          win: true,
          gameStart: 1763400000000,
          aiReview: 'Strong lane: you trimmed Zed early and roamed bot.',
          earlyDeaths: [
            {
              'time': 245,
              'zone': 'Mid lane, enemy half',
              'killerChampion': 'Zed',
              'enemiesInvolved': 2,
            },
          ],
        ),
        sampleMatch(
          id: 'EUW1_2',
          win: false,
          gameStart: 1763300000000,
          champion: 'Syndra',
          opponent: 'Yasuo',
          csDiff10: -12,
          goldDiff15: -800,
        ),
        sampleMatch(id: 'EUW1_1', win: true, gameStart: 1763200000000),
      ],
      'benchmarks': [
        {
          'tier': 'PLATINUM',
          'role': 'MIDDLE',
          'patch': '26.22',
          'sampleSize': 400,
          'cs10': 78,
          'earlyDeaths': 0.8,
          'gold15': 5200,
          'objectivePresence': 0.55,
        },
      ],
      'goal': {
        'id': 'g1',
        'metric': 'earlyDeaths',
        'target': 0,
        'text': 'No deaths before 14:00 in your next 5 games.',
        'basedOnTier': 'PLATINUM',
        'matchIds': ['EUW1_1', 'EUW1_2', 'EUW1_3'],
        'results': [true, false, true],
        'status': 'active',
        'createdAt': 1763100000000,
      },
      'backfillSummary': 'You die early on assassin matchups.',
      'sync': {
        'state': 'idle',
        'message': 'Synced 3 games',
        'lastSyncAt': 1763400000000,
      },
      'standings': [
        {'tier': 'PLATINUM', 'metric': 'cs10', 'percentile': 68},
        {'tier': 'MASTER', 'metric': 'cs10', 'percentile': 20},
        {'tier': 'PLATINUM', 'metric': 'gold15', 'percentile': 90},
      ],
      'aggregation': {
        'state': 'running',
        'tiers': [
          {'tier': 'PLATINUM', 'samples': 400, 'target': 400},
          {'tier': 'MASTER', 'samples': 120, 'target': 400},
        ],
        'patch': '26.22',
        'message': 'Collecting MASTER games…',
      },
    };
