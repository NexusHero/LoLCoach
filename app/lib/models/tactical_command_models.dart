// ignore_for_file: lines_longer_than_80_chars

class ActiveSpellTimer {
  const ActiveSpellTimer({
    required this.key,
    required this.label,
    required this.championName,
    required this.remainingSeconds,
    required this.totalSeconds,
    required this.expiresAtGameTime,
  });

  factory ActiveSpellTimer.fromJson(Map<String, dynamic> json) =>
      ActiveSpellTimer(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        championName: json['championName'] as String? ?? '',
        remainingSeconds: (json['remainingSeconds'] as num?)?.toInt() ?? 0,
        totalSeconds: (json['totalSeconds'] as num?)?.toInt() ?? 0,
        expiresAtGameTime: (json['expiresAtGameTime'] as num?)?.toInt() ?? 0,
      );

  final String key;
  final String label;
  final String championName;
  final int remainingSeconds;
  final int totalSeconds;
  final int expiresAtGameTime;
}

class LiveTacticalOverrides {
  const LiveTacticalOverrides({
    this.laneOpponentOverride,
    this.campedStatus,
    this.enemyBuildOverrides = const {},
    this.tacticalNotes = const [],
    this.activeTimers = const [],
  });

  factory LiveTacticalOverrides.fromJson(Map<String, dynamic> json) {
    final rawBuilds =
        json['enemyBuildOverrides'] as Map<String, dynamic>? ?? const {};
    return LiveTacticalOverrides(
      laneOpponentOverride: json['laneOpponentOverride'] as String?,
      campedStatus: json['campedStatus'] as String?,
      enemyBuildOverrides: rawBuilds.map((k, v) => MapEntry(k, v.toString())),
      tacticalNotes: (json['tacticalNotes'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      activeTimers: (json['activeTimers'] as List<dynamic>? ?? const [])
          .map((e) => ActiveSpellTimer.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final String? laneOpponentOverride;
  final String? campedStatus;
  final Map<String, String> enemyBuildOverrides;
  final List<String> tacticalNotes;
  final List<ActiveSpellTimer> activeTimers;

  bool get hasAny =>
      (laneOpponentOverride != null && laneOpponentOverride!.isNotEmpty) ||
      (campedStatus != null && campedStatus != 'normal') ||
      enemyBuildOverrides.isNotEmpty ||
      tacticalNotes.isNotEmpty ||
      activeTimers.isNotEmpty;
}

class CoachUiMutation {
  const CoachUiMutation({
    this.proMode,
    this.riskLevel,
    this.buildFocus,
    this.preferPassiveItems,
  });

  factory CoachUiMutation.fromJson(Map<String, dynamic> json) =>
      CoachUiMutation(
        proMode: json['proMode'] as bool?,
        riskLevel: json['riskLevel'] as String?,
        buildFocus: json['buildFocus'] as String?,
        preferPassiveItems: json['preferPassiveItems'] as bool?,
      );

  final bool? proMode;
  final String? riskLevel;
  final String? buildFocus;
  final bool? preferPassiveItems;
}

class CoachExchange {
  const CoachExchange({
    required this.id,
    required this.userText,
    required this.replyText,
    required this.timestamp,
    this.actionsExecuted = const [],
    this.uiMutation,
  });

  factory CoachExchange.fromJson(Map<String, dynamic> json) => CoachExchange(
        id: json['id'] as String? ?? '',
        userText: json['userText'] as String? ?? '',
        replyText: json['replyText'] as String? ?? '',
        actionsExecuted: (json['actionsExecuted'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        uiMutation: json['uiMutation'] != null
            ? CoachUiMutation.fromJson(
                json['uiMutation'] as Map<String, dynamic>,
              )
            : null,
        timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String userText;
  final String replyText;
  final List<String> actionsExecuted;
  final CoachUiMutation? uiMutation;
  final int timestamp;
}
