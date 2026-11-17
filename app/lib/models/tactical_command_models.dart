// ignore_for_file: lines_longer_than_80_chars

/// A moment the player flagged during the match for the post-game review.
class ReviewMarker {
  const ReviewMarker({
    required this.id,
    required this.gameTime,
    required this.note,
  });

  factory ReviewMarker.fromJson(Map<String, dynamic> json) => ReviewMarker(
        id: json['id'] as String? ?? '',
        gameTime: (json['gameTime'] as num?)?.toInt() ?? 0,
        note: json['note'] as String? ?? '',
      );

  static List<ReviewMarker> listFromJson(Object? raw) =>
      (raw as List<dynamic>? ?? const [])
          .map((e) => ReviewMarker.fromJson(e as Map<String, dynamic>))
          .toList();

  final String id;
  final int gameTime;
  final String note;

  /// Game clock as m:ss.
  String get clock =>
      '${gameTime ~/ 60}:${(gameTime % 60).toString().padLeft(2, '0')}';
}

class LiveTacticalOverrides {
  const LiveTacticalOverrides({
    this.laneOpponentOverride,
    this.campedStatus,
    this.enemyBuildOverrides = const {},
  });

  factory LiveTacticalOverrides.fromJson(Map<String, dynamic> json) {
    final rawBuilds =
        json['enemyBuildOverrides'] as Map<String, dynamic>? ?? const {};
    return LiveTacticalOverrides(
      laneOpponentOverride: json['laneOpponentOverride'] as String?,
      campedStatus: json['campedStatus'] as String?,
      enemyBuildOverrides: rawBuilds.map((k, v) => MapEntry(k, v.toString())),
    );
  }

  final String? laneOpponentOverride;
  final String? campedStatus;
  final Map<String, String> enemyBuildOverrides;

  bool get hasAny =>
      (laneOpponentOverride != null && laneOpponentOverride!.isNotEmpty) ||
      (campedStatus != null && campedStatus != 'normal') ||
      enemyBuildOverrides.isNotEmpty;
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
