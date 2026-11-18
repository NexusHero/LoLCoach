import 'package:lol_coach/services/analysis_service.dart';
import 'package:lol_coach/services/coach_service.dart';
import 'package:lol_coach/services/storage_service.dart';
import 'package:lol_coach/services/ws_client.dart';
import 'package:material_ui/material_ui.dart';

typedef ModelOption = ({String id, String label});

const claudeModels = <ModelOption>[
  (id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (Fast)'),
  (id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (Balanced)'),
  (id: 'claude-opus-4-8', label: 'Opus 4.8 (Powerful)'),
];
const openaiModels = <ModelOption>[
  (id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)'),
  (id: 'gpt-4o', label: 'GPT-4o (Balanced)'),
];
const geminiModels = <ModelOption>[
  (id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)'),
  (id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Powerful)'),
];

class SettingsController extends ChangeNotifier {
  SettingsController({
    required StorageService storage,
    required CoachService coach,
    AnalysisService? analysis,
    this.onConnected,
  })  : _storage = storage,
        _coach = coach,
        _analysis = analysis {
    _init();
    _coach.addListener(notifyListeners);
  }

  final StorageService _storage;
  final CoachService _coach;
  final AnalysisService? _analysis;
  final VoidCallback? onConnected;

  final hostCtrl = TextEditingController(text: '127.0.0.1');
  final portCtrl = TextEditingController(text: '8765');
  final summonerCtrl = TextEditingController();
  final apiKeyCtrl = TextEditingController();
  final tokenBudgetCtrl = TextEditingController();
  final riotIdCtrl = TextEditingController();

  String? _ipError;
  String? _riotIdError;
  String _riotRegion = 'EUW';
  String _providerType = 'none';
  String _selectedModel = '';
  bool _showAdvanced = false;

  String? get ipError => _ipError;
  String? get riotIdError => _riotIdError;
  String get riotRegion => _riotRegion;
  String get providerType => _providerType;
  String get selectedModel => _selectedModel;
  bool get showAdvanced => _showAdvanced;

  List<ModelOption> get currentModels {
    if (_coach.availableModels != null &&
        _coach.availableModelsProvider == _providerType &&
        _coach.availableModels!.isNotEmpty) {
      return _coach.availableModels!
          .map((m) => (id: m.id, label: m.displayName))
          .toList();
    }
    return switch (_providerType) {
      'claude' => claudeModels,
      'openai' => openaiModels,
      'gemini' => geminiModels,
      _ => const [],
    };
  }

  // Proxies to CoachService state
  bool get isConnecting => _coach.status == ConnectionStatus.connecting;
  bool get isConnected => _coach.isConnected;
  String? get connectionError =>
      _coach.status == ConnectionStatus.error ? _coach.lastError : null;

  bool get isLoadingModels => _coach.isLoadingModels;
  bool get isValidatingKey => _coach.isValidatingKey;
  bool? get keyValidationResult => _coach.keyValidationResult;
  String? get keyValidationError => _coach.keyValidationError;

  Future<void> _init() async {
    hostCtrl.text = _storage.host ?? '127.0.0.1';
    portCtrl.text = _storage.port ?? '8765';
    summonerCtrl.text = _storage.summonerName ?? '';
    riotIdCtrl.text = _storage.riotId ?? '';
    _riotRegion =
        riotRegions.contains(_storage.riotRegion) ? _storage.riotRegion : 'EUW';
    _providerType = _storage.providerType ?? 'none';
    _selectedModel = _storage.selectedModel ?? '';
    apiKeyCtrl.text = await _storage.getApiKey() ?? '';
    final budget = _storage.tokenBudget;
    tokenBudgetCtrl.text = budget > 0 ? '$budget' : '';

    _showAdvanced =
        hostCtrl.text != '127.0.0.1' && hostCtrl.text != 'localhost';
    notifyListeners();
  }

  void setProviderType(String val) {
    _providerType = val;
    _selectedModel = '';
    notifyListeners();
  }

  void setSelectedModel(String val) {
    _selectedModel = val;
    notifyListeners();
  }

  void setRiotRegion(String val) {
    _riotRegion = val;
    notifyListeners();
  }

  void toggleAdvanced() {
    _showAdvanced = !_showAdvanced;
    notifyListeners();
  }

  Future<void> connect() async {
    if (isConnecting) return;

    final host = hostCtrl.text.trim();
    if (host.isEmpty) return;

    final ipRegExp = RegExp(r'^(\d{1,3}\.){3}\d{1,3}$');
    if (!ipRegExp.hasMatch(host) && host != 'localhost') {
      _ipError = 'Invalid IP format (e.g. 192.168.1.100)';
      notifyListeners();
      return;
    } else {
      _ipError = null;
      notifyListeners();
    }

    final riotId = riotIdCtrl.text.trim();
    _riotIdError = validateRiotId(riotId);
    if (_riotIdError != null) {
      notifyListeners();
      return;
    }

    final portString = portCtrl.text.trim();
    final port = int.tryParse(portString) ?? 8765;
    final summonerName = summonerCtrl.text.trim();
    final apiKey = apiKeyCtrl.text.trim();
    final tokenBudget = int.tryParse(tokenBudgetCtrl.text.trim()) ?? 0;

    await _storage.setHost(host);
    await _storage.setPort(portString);
    await _storage.setSummonerName(summonerName);
    await _storage.setProviderType(_providerType);
    await _storage.setSelectedModel(_selectedModel);
    await _storage.setTokenBudget(tokenBudget);
    await _storage.setApiKey(apiKey);
    if (_analysis != null) {
      // Persists and sends SET_RIOT_ID (now if connected, else on connect).
      _analysis.setRiotId(riotId, _riotRegion);
    } else {
      await _storage.setRiotId(riotId);
      await _storage.setRiotRegion(_riotRegion);
    }

    final models = currentModels;
    final effectiveModel =
        _selectedModel.isNotEmpty && models.any((m) => m.id == _selectedModel)
            ? _selectedModel
            : models.isNotEmpty
                ? models.first.id
                : '';

    _coach.connect(
      host,
      port: port,
      summonerName: summonerName,
      providerType: _providerType,
      model: effectiveModel,
      apiKey: apiKey,
      tokenBudget: tokenBudget,
    );

    onConnected?.call();
  }

  void disconnect() {
    _coach.disconnect();
  }

  void validateKey() {
    _coach.validateKey(_providerType, apiKeyCtrl.text.trim());
  }

  void loadModels() {
    _coach.loadModels(_providerType, apiKeyCtrl.text.trim());
  }

  @override
  void dispose() {
    _coach.removeListener(notifyListeners);
    hostCtrl.dispose();
    portCtrl.dispose();
    summonerCtrl.dispose();
    apiKeyCtrl.dispose();
    tokenBudgetCtrl.dispose();
    riotIdCtrl.dispose();
    super.dispose();
  }
}
