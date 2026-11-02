import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/models/token_usage.dart';

class WsMessage {
  const WsMessage({
    required this.event,
    required this.timestamp,
    this.gameState,
    this.recommendation,
    this.tacticalInsights,
    this.playerProfile,
    this.postGameAutopsy,
    this.coachExchange,
    this.error,
    this.tokenUsage,
    this.sessionInputTokens,
    this.budget,
    this.triggerEvent,
  });

  factory WsMessage.fromJson(Map<String, dynamic> json) => WsMessage(
        event: json['event'] as String,
        timestamp: (json['timestamp'] as num).toInt(),
        gameState: json['gameState'] != null
            ? ParsedGameState.fromJson(
                json['gameState'] as Map<String, dynamic>,
              )
            : null,
        recommendation: json['recommendation'] != null
            ? ItemRecommendation.fromJson(
                json['recommendation'] as Map<String, dynamic>,
              )
            : null,
        tacticalInsights: json['tacticalInsights'] != null
            ? TacticalInsights.fromJson(
                json['tacticalInsights'] as Map<String, dynamic>,
              )
            : null,
        playerProfile: json['playerProfile'] != null
            ? PlayerHabitProfile.fromJson(
                json['playerProfile'] as Map<String, dynamic>,
              )
            : null,
        postGameAutopsy: json['postGameAutopsy'] != null
            ? PostGameAutopsy.fromJson(
                json['postGameAutopsy'] as Map<String, dynamic>,
              )
            : null,
        coachExchange: json['coachExchange'] != null
            ? CoachExchange.fromJson(
                json['coachExchange'] as Map<String, dynamic>,
              )
            : null,
        error: json['error'] as String?,
        tokenUsage: json['tokenUsage'] != null
            ? TokenUsage.fromJson(json['tokenUsage'] as Map<String, dynamic>)
            : null,
        sessionInputTokens: json['sessionInputTokens'] as int?,
        budget: json['budget'] as int?,
        triggerEvent: json['triggerEvent'] as String?,
      );

  final String event;
  final int timestamp;
  final ParsedGameState? gameState;
  final ItemRecommendation? recommendation;
  final TacticalInsights? tacticalInsights;
  final PlayerHabitProfile? playerProfile;
  final PostGameAutopsy? postGameAutopsy;
  final CoachExchange? coachExchange;
  final String? error;
  final TokenUsage? tokenUsage;
  final int? sessionInputTokens;
  final int? budget;
  final String? triggerEvent;
}
