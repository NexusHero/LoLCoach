// ignore_for_file: lines_longer_than_80_chars
import 'package:lol_coach/models/tactical_command_models.dart';

export 'package:lol_coach/models/tactical_command_models.dart';

class NextBestBuy {
  const NextBestBuy({
    required this.itemId,
    required this.itemName,
    required this.price,
    required this.targetItemId,
    required this.targetItemName,
    this.breakpointHint,
  });

  factory NextBestBuy.fromJson(Map<String, dynamic> json) => NextBestBuy(
        itemId: (json['itemId'] as num?)?.toInt() ?? 0,
        itemName: json['itemName'] as String? ?? '',
        price: (json['price'] as num?)?.toInt() ?? 0,
        targetItemId: (json['targetItemId'] as num?)?.toInt() ?? 0,
        targetItemName: json['targetItemName'] as String? ?? '',
        breakpointHint: json['breakpointHint'] as String?,
      );

  final int itemId;
  final String itemName;
  final int price;
  final int targetItemId;
  final String targetItemName;
  final String? breakpointHint;
}

class EnemySummonerCooldown {
  const EnemySummonerCooldown({
    required this.name,
    required this.cooldown,
  });

  factory EnemySummonerCooldown.fromJson(Map<String, dynamic> json) =>
      EnemySummonerCooldown(
        name: json['name'] as String? ?? '',
        cooldown: (json['cooldown'] as num?)?.toInt() ?? 0,
      );

  final String name;
  final int cooldown;
}

class EnemyCooldowns {
  const EnemyCooldowns({
    required this.championName,
    required this.level,
    required this.abilityHaste,
    required this.q,
    required this.w,
    required this.e,
    required this.r,
    required this.keyThreatSummary,
    this.keyThreatSpell,
    this.summonerSpells = const [],
  });

  factory EnemyCooldowns.fromJson(Map<String, dynamic> json) => EnemyCooldowns(
        championName: json['championName'] as String? ?? '',
        level: (json['level'] as num?)?.toInt() ?? 1,
        abilityHaste: (json['abilityHaste'] as num?)?.toInt() ?? 0,
        q: (json['q'] as num?)?.toInt() ?? 0,
        w: (json['w'] as num?)?.toInt() ?? 0,
        e: (json['e'] as num?)?.toInt() ?? 0,
        r: (json['r'] as num?)?.toInt() ?? 0,
        keyThreatSpell: json['keyThreatSpell'] as String?,
        summonerSpells: (json['summonerSpells'] as List<dynamic>? ?? const [])
            .map(
              (e) => EnemySummonerCooldown.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
        keyThreatSummary: json['keyThreatSummary'] as String? ?? '',
      );

  final String championName;
  final int level;
  final int abilityHaste;
  final int q;
  final int w;
  final int e;
  final int r;
  final String? keyThreatSpell;
  final List<EnemySummonerCooldown> summonerSpells;
  final String keyThreatSummary;
}

class MacroAlert {
  const MacroAlert({
    required this.id,
    required this.priority,
    required this.category,
    required this.title,
    required this.detail,
  });

  factory MacroAlert.fromJson(Map<String, dynamic> json) => MacroAlert(
        id: json['id'] as String? ?? '',
        priority: json['priority'] as String? ?? 'info',
        category: json['category'] as String? ?? 'economy',
        title: json['title'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
      );

  final String id;
  final String priority; // 'critical' | 'warning' | 'info'
  final String category; // 'danger' | 'objective' | 'economy'
  final String title;
  final String detail;
}

class ObjectiveTimer {
  const ObjectiveTimer({
    required this.type,
    required this.label,
    required this.secondsUntilSpawn,
    required this.status,
  });

  factory ObjectiveTimer.fromJson(Map<String, dynamic> json) => ObjectiveTimer(
        type: json['type'] as String? ?? 'dragon',
        label: json['label'] as String? ?? 'Objective',
        secondsUntilSpawn: (json['secondsUntilSpawn'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'countdown',
      );

  final String type;
  final String label;
  final int secondsUntilSpawn;
  final String status; // 'alive' | 'spawning_soon' | 'countdown'
}

class PrimaryThreat {
  const PrimaryThreat({
    required this.championName,
    required this.reason,
    required this.kills,
    required this.cs,
    required this.level,
  });

  factory PrimaryThreat.fromJson(Map<String, dynamic> json) => PrimaryThreat(
        championName: json['championName'] as String? ?? '',
        reason: json['reason'] as String? ?? '',
        kills: (json['kills'] as num?)?.toInt() ?? 0,
        cs: (json['cs'] as num?)?.toInt() ?? 0,
        level: (json['level'] as num?)?.toInt() ?? 1,
      );

  final String championName;
  final String reason;
  final int kills;
  final int cs;
  final int level;
}

class TeamDamageProfile {
  const TeamDamageProfile({
    required this.adPercent,
    required this.apPercent,
    this.heavyHealing = false,
    this.armorStacking = false,
    this.mrStacking = false,
  });

  factory TeamDamageProfile.fromJson(Map<String, dynamic> json) =>
      TeamDamageProfile(
        adPercent: (json['adPercent'] as num?)?.toInt() ?? 50,
        apPercent: (json['apPercent'] as num?)?.toInt() ?? 50,
        heavyHealing: json['heavyHealing'] as bool? ?? false,
        armorStacking: json['armorStacking'] as bool? ?? false,
        mrStacking: json['mrStacking'] as bool? ?? false,
      );

  final int adPercent;
  final int apPercent;
  final bool heavyHealing;
  final bool armorStacking;
  final bool mrStacking;
}

class TacticalInsights {
  const TacticalInsights({
    required this.teamDamageProfile,
    this.primaryThreat,
    this.nextBestBuy,
    this.enemyCooldowns,
    this.macroAlerts = const [],
    this.objectives = const [],
    this.csPerMin = 0,
    this.targetCsPerMin = 8,
    this.buildFocus = 'auto',
    this.preferPassiveItems = false,
    this.liveOverrides,
    this.lastCoachExchange,
  });

  factory TacticalInsights.fromJson(Map<String, dynamic> json) =>
      TacticalInsights(
        primaryThreat: json['primaryThreat'] != null
            ? PrimaryThreat.fromJson(
                json['primaryThreat'] as Map<String, dynamic>,
              )
            : null,
        teamDamageProfile: json['teamDamageProfile'] != null
            ? TeamDamageProfile.fromJson(
                json['teamDamageProfile'] as Map<String, dynamic>,
              )
            : const TeamDamageProfile(adPercent: 50, apPercent: 50),
        nextBestBuy: json['nextBestBuy'] != null
            ? NextBestBuy.fromJson(json['nextBestBuy'] as Map<String, dynamic>)
            : null,
        enemyCooldowns: json['enemyCooldowns'] != null
            ? EnemyCooldowns.fromJson(
                json['enemyCooldowns'] as Map<String, dynamic>,
              )
            : null,
        macroAlerts: (json['macroAlerts'] as List<dynamic>? ?? const [])
            .map((e) => MacroAlert.fromJson(e as Map<String, dynamic>))
            .toList(),
        objectives: (json['objectives'] as List<dynamic>? ?? const [])
            .map((e) => ObjectiveTimer.fromJson(e as Map<String, dynamic>))
            .toList(),
        csPerMin: (json['csPerMin'] as num?)?.toDouble() ?? 0,
        targetCsPerMin: (json['targetCsPerMin'] as num?)?.toDouble() ?? 8,
        buildFocus: json['buildFocus'] as String? ?? 'auto',
        preferPassiveItems: json['preferPassiveItems'] as bool? ?? false,
        liveOverrides: json['liveOverrides'] != null
            ? LiveTacticalOverrides.fromJson(
                json['liveOverrides'] as Map<String, dynamic>,
              )
            : null,
        lastCoachExchange: json['lastCoachExchange'] != null
            ? CoachExchange.fromJson(
                json['lastCoachExchange'] as Map<String, dynamic>,
              )
            : null,
      );

  final PrimaryThreat? primaryThreat;
  final TeamDamageProfile teamDamageProfile;
  final NextBestBuy? nextBestBuy;
  final EnemyCooldowns? enemyCooldowns;
  final List<MacroAlert> macroAlerts;
  final List<ObjectiveTimer> objectives;
  final double csPerMin;
  final double targetCsPerMin;
  final String buildFocus;
  final bool preferPassiveItems;
  final LiveTacticalOverrides? liveOverrides;
  final CoachExchange? lastCoachExchange;
}

class PostGameAutopsy {
  const PostGameAutopsy({
    required this.championName,
    required this.role,
    required this.durationMinutes,
    required this.kda,
    required this.csPerMin,
    required this.targetCsPerMin,
    required this.praise,
    required this.mistakes,
    required this.timestamp,
  });

  factory PostGameAutopsy.fromJson(Map<String, dynamic> json) =>
      PostGameAutopsy(
        championName: json['championName'] as String? ?? '',
        role: json['role'] as String? ?? 'MID',
        durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
        kda: json['kda'] as String? ?? '0/0/0',
        csPerMin: (json['csPerMin'] as num?)?.toDouble() ?? 0,
        targetCsPerMin: (json['targetCsPerMin'] as num?)?.toDouble() ?? 8,
        praise: json['praise'] as String? ?? '',
        mistakes: (json['mistakes'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
      );

  final String championName;
  final String role;
  final int durationMinutes;
  final String kda;
  final double csPerMin;
  final double targetCsPerMin;
  final String praise;
  final List<String> mistakes;
  final int timestamp;
}

class PlayerHabitProfile {
  const PlayerHabitProfile({
    required this.gamesTracked,
    required this.avgCsPerMin,
    required this.earlyDeathRate,
    required this.highGoldDeathRate,
    this.habitWarnings = const [],
    this.lastAutopsy,
  });

  factory PlayerHabitProfile.fromJson(Map<String, dynamic> json) =>
      PlayerHabitProfile(
        gamesTracked: (json['gamesTracked'] as num?)?.toInt() ?? 0,
        avgCsPerMin: (json['avgCsPerMin'] as num?)?.toDouble() ?? 0,
        earlyDeathRate: (json['earlyDeathRate'] as num?)?.toDouble() ?? 0,
        highGoldDeathRate: (json['highGoldDeathRate'] as num?)?.toDouble() ?? 0,
        habitWarnings: (json['habitWarnings'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        lastAutopsy: json['lastAutopsy'] != null
            ? PostGameAutopsy.fromJson(
                json['lastAutopsy'] as Map<String, dynamic>,
              )
            : null,
      );

  final int gamesTracked;
  final double avgCsPerMin;
  final double earlyDeathRate;
  final double highGoldDeathRate;
  final List<String> habitWarnings;
  final PostGameAutopsy? lastAutopsy;
}
