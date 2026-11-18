import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/services/storage_service.dart';
import 'package:lol_coach/services/ws_client.dart';

/// Regions accepted by SET_RIOT_ID.
const riotRegions = <String>[
  'EUW',
  'EUNE',
  'NA',
  'KR',
  'TR',
  'BR',
  'LAN',
  'LAS',
  'OCE',
  'JP',
  'RU',
];

/// Returns an error message for an invalid Riot ID, or null when valid
/// (empty is valid: the field is optional).
String? validateRiotId(String value) {
  final v = value.trim();
  if (v.isEmpty) return null;
  final parts = v.split('#');
  if (parts.length != 2 || parts[0].trim().isEmpty || parts[1].trim().isEmpty) {
    return 'Use the format Name#TAG';
  }
  return null;
}

/// Holds the post-game review board state ([AnalysisSnapshot]) and the
/// "Ask your history" exchanges. Talks to the core over the shared [WsClient].
class AnalysisService extends ChangeNotifier {
  AnalysisService(this._client, [this._storage]) {
    _riotId = _storage?.riotId;
    _region = _storage?.riotRegion ?? 'EUW';
    _client.addListener(_onClientStatusChanged);
    _subscription = _client.messages.listen(handleMessage);
    if (_client.isConnected) _onConnected();
  }

  final WsClient _client;
  final StorageService? _storage;
  late final StreamSubscription<String> _subscription;

  AnalysisSnapshot? _snapshot;
  final List<AnalysisQuestion> _questions = [];
  bool _wasConnected = false;
  bool _refreshing = false;
  int _requestCounter = 0;
  String? _riotId;
  String _region = 'EUW';

  AnalysisSnapshot? get snapshot => _snapshot;
  List<AnalysisQuestion> get questions => List.unmodifiable(_questions);
  bool get isConnected => _client.isConnected;
  bool get isRefreshing => _refreshing;
  bool get hasPendingQuestion => _questions.any((q) => q.isPending);
  String? get riotId => _riotId;
  String get region => _region;

  void _onClientStatusChanged() {
    final connected = _client.isConnected;
    if (connected && !_wasConnected) _onConnected();
    _wasConnected = connected;
    notifyListeners();
  }

  void _onConnected() {
    _wasConnected = true;
    final id = _riotId;
    if (id != null && id.isNotEmpty) {
      _send({'event': 'SET_RIOT_ID', 'riotId': id, 'region': _region});
    }
    _send({'event': 'GET_ANALYSIS'});
  }

  void _send(Map<String, dynamic> msg) => _client.send(jsonEncode(msg));

  /// Requests the latest snapshot.
  void requestAnalysis() => _send({'event': 'GET_ANALYSIS'});

  /// Asks the core to re-sync matches now.
  void refresh() {
    _refreshing = true;
    notifyListeners();
    _send({'event': 'REFRESH_ANALYSIS'});
  }

  /// Stores the Riot ID + region and pushes them to the core.
  void setRiotId(String riotId, String region) {
    final id = riotId.trim();
    _riotId = id.isEmpty ? null : id;
    _region = region;
    unawaited(_storage?.setRiotId(id));
    unawaited(_storage?.setRiotRegion(region));
    if (id.isNotEmpty) {
      _send({'event': 'SET_RIOT_ID', 'riotId': id, 'region': region});
    }
    notifyListeners();
  }

  /// Sends a question about the match history. Returns the request id, or
  /// null when the question was empty.
  String? ask(String question) {
    final q = question.trim();
    if (q.isEmpty) return null;
    _requestCounter++;
    final requestId =
        'ask-${DateTime.now().millisecondsSinceEpoch}-$_requestCounter';
    _questions.add(AnalysisQuestion(requestId: requestId, question: q));
    if (_client.isConnected) {
      _send({'event': 'ASK_ANALYSIS', 'question': q, 'requestId': requestId});
    } else {
      _resolve(
        AnalysisAnswer(
          requestId: requestId,
          error: 'Not connected to the core.',
        ),
      );
    }
    notifyListeners();
    return requestId;
  }

  void _resolve(AnalysisAnswer a) {
    final idx = _questions.indexWhere((q) => q.requestId == a.requestId);
    if (idx < 0) return;
    _questions[idx] = _questions[idx].resolve(a);
  }

  /// Handles one raw message from the core. Public so tests can feed data.
  @visibleForTesting
  void handleMessage(String raw) {
    Map<String, dynamic> json;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      json = decoded.cast<String, dynamic>();
    } catch (_) {
      return;
    }
    switch (json['event']) {
      case 'ANALYSIS_UPDATE':
        final a = json['analysis'];
        if (a is Map) {
          try {
            _snapshot = AnalysisSnapshot.fromJson(a.cast<String, dynamic>());
          } catch (e) {
            debugPrint('[AnalysisService] Parse error: $e');
            return;
          }
          _refreshing = _snapshot!.sync.state == 'syncing' && _refreshing;
          notifyListeners();
        }
      case 'ANALYSIS_ANSWER':
        _resolve(AnalysisAnswer.fromJson(json));
        notifyListeners();
    }
  }

  @override
  void dispose() {
    _client.removeListener(_onClientStatusChanged);
    unawaited(_subscription.cancel());
    super.dispose();
  }
}
