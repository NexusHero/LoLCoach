// ignore_for_file: lines_longer_than_80_chars
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:lol_coach/models/game_state.dart';
import 'package:lol_coach/models/model_info.dart';
import 'package:lol_coach/models/recommendation.dart';
import 'package:lol_coach/models/tactical_insights.dart';
import 'package:lol_coach/models/token_usage.dart';
import 'package:lol_coach/models/ws_message.dart';
import 'package:lol_coach/services/storage_service.dart';
import 'package:lol_coach/services/voice_comms_helper.dart';
import 'package:lol_coach/services/ws_client.dart';

class CoachService extends ChangeNotifier {
  CoachService(this._client, [this._storage]) {
    _riskLevel = _storage?.riskLevel ?? 'normal';
    _buildFocus = _storage?.buildFocus ?? 'auto';
    _preferPassiveItems = _storage?.preferPassiveItems ?? false;
    _proMode = _storage?.proMode ?? true;
    _client.addListener(_onClientStatusChanged);
    _subscription = _client.messages.listen(_onMessage);
  }

  final WsClient _client;
  final StorageService? _storage;
  late final StreamSubscription<String> _subscription;

  ParsedGameState? _gameState;
  ItemRecommendation? _recommendation;
  TacticalInsights? _tacticalInsights;
  PlayerHabitProfile? _playerProfile;
  PostGameAutopsy? _postGameAutopsy;
  final List<CoachExchange> _coachHistory = [];
  String _lastEvent = '';
  bool _gameActive = false;
  bool _isAnalyzing = false;
  bool _llmFailed = false;
  String? _lastLlmError;
  DateTime? _recommendationTime;
  String? _triggerEvent;

  List<ModelInfo>? _availableModels;
  String? _availableModelsProvider;
  bool _isLoadingModels = false;

  bool _isValidatingKey = false;
  bool? _keyValidationResult;
  String? _keyValidationError;

  TokenUsage? _lastTokenUsage;
  bool _isBudgetExceeded = false;

  String? _activeSummonerName;
  String? _activeProviderType;
  String? _activeModel;
  String? _activeApiKey;
  int _activeTokenBudget = 0;
  String _riskLevel = 'normal';
  String _buildFocus = 'auto';
  bool _preferPassiveItems = false;
  bool _proMode = true;
  bool _voiceEnabled = false;

  ConnectionStatus get status => _client.status;
  String? get lastError => _client.lastError;
  bool get isConnected => _client.isConnected;
  String get riskLevel => _riskLevel;
  String get buildFocus => _buildFocus;
  bool get preferPassiveItems => _preferPassiveItems;
  bool get proMode => _proMode;
  bool get voiceEnabled => _voiceEnabled;
  List<CoachExchange> get coachHistory => List.unmodifiable(_coachHistory);
  CoachExchange? get lastCoachExchange =>
      _coachHistory.isNotEmpty ? _coachHistory.last : null;

  String? get lastLlmError => _lastLlmError;
  String get activeProviderType => _activeProviderType ?? 'none';
  String? get activeModel => _activeModel;
  List<ModelInfo>? get availableModels => _availableModels;
  String? get availableModelsProvider => _availableModelsProvider;
  bool get isLoadingModels => _isLoadingModels;
  bool get isValidatingKey => _isValidatingKey;
  bool? get keyValidationResult => _keyValidationResult;
  String? get keyValidationError => _keyValidationError;
  TokenUsage? get lastTokenUsage => _lastTokenUsage;
  bool get isBudgetExceeded => _isBudgetExceeded;
  ParsedGameState? get gameState => _gameState;
  ItemRecommendation? get recommendation => _recommendation;
  TacticalInsights? get tacticalInsights => _tacticalInsights;
  PlayerHabitProfile? get playerProfile => _playerProfile;
  PostGameAutopsy? get postGameAutopsy => _postGameAutopsy;
  String get lastEvent => _lastEvent;
  bool get gameActive => _gameActive;
  bool get isAnalyzing => _isAnalyzing;
  bool get llmFailed => _llmFailed;
  DateTime? get recommendationTime => _recommendationTime;
  String? get triggerEvent => _triggerEvent;

  void connect(
    String host, {
    int port = 8765,
    String? summonerName,
    String? providerType,
    String? model,
    String? apiKey,
    int tokenBudget = 0,
  }) {
    _activeSummonerName = summonerName;
    _activeProviderType = providerType;
    _activeModel = model;
    _activeApiKey = apiKey;
    _activeTokenBudget = tokenBudget;

    _gameState = null;
    _recommendation = null;
    _gameActive = false;
    _lastEvent = '';
    _lastLlmError = null;
    _isAnalyzing = false;
    _llmFailed = false;
    _recommendationTime = null;
    _triggerEvent = null;
    _isBudgetExceeded = false;

    final secret = loadCoreSecret();
    final headers = secret != null ? {'Authorization': 'Bearer $secret'} : null;
    final uri = Uri.parse('ws://$host:$port');

    _client.connect(uri, headers: headers);
  }

  void disconnect() => _client.disconnect();

  void _onClientStatusChanged() {
    if (_client.status == ConnectionStatus.connected) {
      _sendInitialSetup();
    }
    notifyListeners();
  }

  void _sendInitialSetup() {
    _client.send(jsonEncode({'event': 'SET_RISK_LEVEL', 'riskLevel': _riskLevel}));
    if (_buildFocus != 'auto') {
      _client.send(
        jsonEncode({'event': 'SET_BUILD_FOCUS', 'buildFocus': _buildFocus}),
      );
    }
    if (_preferPassiveItems) {
      _client.send(jsonEncode({
        'event': 'SET_PREFER_PASSIVE_ITEMS',
        'preferPassiveItems': _preferPassiveItems,
      }),);
    }
    if (_activeSummonerName != null && _activeSummonerName!.isNotEmpty) {
      _client.send(jsonEncode({
        'event': 'SET_SUMMONER',
        'summonerName': _activeSummonerName,
      }),);
    }
    if (_activeProviderType != null &&
        _activeProviderType != 'none' &&
        _activeApiKey != null &&
        _activeApiKey!.isNotEmpty) {
      _client.send(jsonEncode({
        'event': 'SET_LLM_PROVIDER',
        'provider': _activeProviderType,
        if (_activeModel != null) 'model': _activeModel,
        'apiKey': _activeApiKey,
        if (_activeTokenBudget > 0) 'tokenBudget': _activeTokenBudget,
      }),);
      _isLoadingModels = true;
      _availableModels = null;
      _availableModelsProvider = null;
      _client.send(jsonEncode({
        'event': 'GET_MODELS',
        'provider': _activeProviderType,
        'apiKey': _activeApiKey,
      }),);
    } else if (_activeProviderType == 'none') {
      _client.send(jsonEncode({'event': 'SET_LLM_PROVIDER'}));
    }
  }

  void triggerAnalysis() {
    if (!isConnected) return;
    _isAnalyzing = true;
    _lastLlmError = null;
    notifyListeners();
    _client.send(jsonEncode({'event': 'TRIGGER_ANALYSIS'}));
  }

  void sendCoachCommand(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty || !isConnected) return;
    _client.send(jsonEncode({'event': 'COACH_COMMAND', 'text': trimmed}));
  }

  void clearTacticalOverride(String key) {
    if (!isConnected) return;
    _client.send(jsonEncode({'event': 'CLEAR_TACTICAL_OVERRIDE', 'key': key}));
  }

  void setVoiceEnabled({required bool enabled}) {
    if (_voiceEnabled == enabled) return;
    _voiceEnabled = enabled;
    if (enabled) {
      speakTacticalBriefing(
        'Voice Coach active. Ready for callouts.',
        enabled: true,
      );
    }
    notifyListeners();
  }

  void setRiskLevel(String level) {
    if (_riskLevel == level) return;
    _riskLevel = level;
    unawaited(_storage?.setRiskLevel(level));
    if (isConnected) {
      _client.send(jsonEncode({'event': 'SET_RISK_LEVEL', 'riskLevel': level}));
    }
    notifyListeners();
  }

  void setBuildFocus(String focus) {
    if (_buildFocus == focus) return;
    _buildFocus = focus;
    unawaited(_storage?.setBuildFocus(focus));
    if (isConnected) {
      _client.send(
        jsonEncode({'event': 'SET_BUILD_FOCUS', 'buildFocus': focus}),
      );
    }
    notifyListeners();
  }

  void setPreferPassiveItems({required bool prefer}) {
    if (_preferPassiveItems == prefer) return;
    _preferPassiveItems = prefer;
    unawaited(_storage?.setPreferPassiveItems(value: prefer));
    if (isConnected) {
      _client.send(jsonEncode({
        'event': 'SET_PREFER_PASSIVE_ITEMS',
        'preferPassiveItems': prefer,
      }),);
    }
    notifyListeners();
  }

  void setProMode({required bool enabled}) {
    if (_proMode == enabled) return;
    _proMode = enabled;
    unawaited(_storage?.setProMode(value: enabled));
    notifyListeners();
  }

  void loadModels(String provider, String apiKey) {
    if (!isConnected) return;
    _isLoadingModels = true;
    _availableModels = null;
    _availableModelsProvider = null;
    notifyListeners();
    _client.send(
      jsonEncode({'event': 'GET_MODELS', 'provider': provider, 'apiKey': apiKey}),
    );
  }

  void clearLlmError() {
    if (_lastLlmError == null) return;
    _lastLlmError = null;
    notifyListeners();
  }

  void validateKey(String provider, String apiKey) {
    if (!isConnected) return;
    _isValidatingKey = true;
    _keyValidationResult = null;
    _keyValidationError = null;
    notifyListeners();
    _client.send(jsonEncode({
      'event': 'VALIDATE_KEY',
      'provider': provider,
      'apiKey': apiKey,
    }),);
  }

  void clearKeyValidation() {
    if (_keyValidationResult == null && _keyValidationError == null) return;
    _keyValidationResult = null;
    _keyValidationError = null;
    notifyListeners();
  }

  void _applyUiMutation(CoachUiMutation? mutation) {
    if (mutation == null) return;
    if (mutation.proMode != null) {
      _proMode = mutation.proMode!;
      unawaited(_storage?.setProMode(value: _proMode));
    }
    if (mutation.riskLevel != null) {
      _riskLevel = mutation.riskLevel!;
      unawaited(_storage?.setRiskLevel(_riskLevel));
    }
    if (mutation.buildFocus != null) {
      _buildFocus = mutation.buildFocus!;
      unawaited(_storage?.setBuildFocus(_buildFocus));
    }
    if (mutation.preferPassiveItems != null) {
      _preferPassiveItems = mutation.preferPassiveItems!;
      unawaited(_storage?.setPreferPassiveItems(value: _preferPassiveItems));
    }
  }

  void _onMessage(String raw) {
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final msg = WsMessage.fromJson(json);
      _lastEvent = msg.event;

      if (msg.tacticalInsights != null) _tacticalInsights = msg.tacticalInsights;
      if (msg.playerProfile != null) _playerProfile = msg.playerProfile;
      if (msg.postGameAutopsy != null) _postGameAutopsy = msg.postGameAutopsy;
      if (msg.coachExchange != null) {
        _coachHistory.add(msg.coachExchange!);
        _applyUiMutation(msg.coachExchange!.uiMutation);
        speakTacticalBriefing(
          msg.coachExchange!.replyText,
          enabled: _voiceEnabled,
        );
      }

      switch (msg.event) {
        case 'GAME_INACTIVE':
          _gameActive = false;
          _gameState = null;
          _recommendation = null;
          _tacticalInsights = null;
          _isAnalyzing = false;
          _triggerEvent = null;
        case 'RECOMMENDATION_UPDATE':
          _recommendation = msg.recommendation ?? _recommendation;
          if (msg.gameState != null) _gameState = msg.gameState;
          if (msg.tokenUsage != null) _lastTokenUsage = msg.tokenUsage;
          _gameActive = true;
          _llmFailed = false;
          _isAnalyzing = false;
          _recommendationTime = DateTime.now();
          _triggerEvent = msg.triggerEvent;
        case 'LLM_ERROR':
          _lastLlmError = msg.error;
          _llmFailed = true;
          _isAnalyzing = false;
        case 'MODELS_AVAILABLE':
          final rawModels = json['models'] as List<dynamic>?;
          final provider = json['provider'] as String?;
          if (rawModels != null && provider != null) {
            _availableModels = rawModels
                .map((m) => ModelInfo.fromJson(m as Map<String, dynamic>))
                .toList();
            _availableModelsProvider = provider;
          }
          _isLoadingModels = false;
        case 'MODELS_ERROR':
          _availableModels = null;
          _availableModelsProvider = null;
          _isLoadingModels = false;
        case 'KEY_VALID':
          _isValidatingKey = false;
          _keyValidationResult = true;
          _keyValidationError = null;
        case 'KEY_INVALID':
          _isValidatingKey = false;
          _keyValidationResult = false;
          _keyValidationError = json['error'] as String?;
        case 'LLM_BUDGET_EXCEEDED':
          _isBudgetExceeded = true;
        default:
          if (msg.gameState != null) {
            _gameState = msg.gameState;
            _gameActive = true;
          }
          _isAnalyzing = false;
      }
    } catch (e) {
      debugPrint('[CoachService] Parse error: $e');
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _client.removeListener(_onClientStatusChanged);
    _subscription.cancel();
    super.dispose();
  }
}
