import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Abstraction over SharedPreferences and SecureStorage to hide
/// persistence implementation details.
class StorageService {
  late final SharedPreferences _prefs;
  final _secureStorage = const FlutterSecureStorage();

  /// Initialize the underlying storage.
  /// Must be called before accessing properties.
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // --- Connection Settings ---
  String? get host => _prefs.getString('host');
  Future<void> setHost(String value) => _prefs.setString('host', value);

  String? get port => _prefs.getString('port');
  Future<void> setPort(String value) => _prefs.setString('port', value);

  String? get summonerName => _prefs.getString('summonerName');
  Future<void> setSummonerName(String value) =>
      _prefs.setString('summonerName', value);

  // --- AI Settings ---
  String? get providerType => _prefs.getString('providerType');
  Future<void> setProviderType(String value) =>
      _prefs.setString('providerType', value);

  String? get selectedModel => _prefs.getString('selectedModel');
  Future<void> setSelectedModel(String value) =>
      _prefs.setString('selectedModel', value);

  int get tokenBudget => _prefs.getInt('tokenBudget') ?? 0;
  Future<void> setTokenBudget(int value) =>
      _prefs.setInt('tokenBudget', value);

  /// Playstyle for coaching tone: 'safe' | 'normal' | 'risky'.
  String get riskLevel => _prefs.getString('riskLevel') ?? 'normal';
  Future<void> setRiskLevel(String value) =>
      _prefs.setString('riskLevel', value);

  /// Combat/build focus: 'auto' | 'burst' | 'dps' | 'bruiser' | 'split'.
  String get buildFocus => _prefs.getString('buildFocus') ?? 'auto';
  Future<void> setBuildFocus(String value) =>
      _prefs.setString('buildFocus', value);

  /// Whether to prefer passive/stat-stick items over active-button items.
  bool get preferPassiveItems => _prefs.getBool('preferPassiveItems') ?? false;
  Future<void> setPreferPassiveItems({required bool value}) =>
      _prefs.setBool('preferPassiveItems', value);

  /// Challenger Pro / Zen HUD mode (hides redundant native LoL HUD stats).
  /// Enabled by default for High-Elo / Challenger 0.2s-glance workflow.
  bool get proMode => _prefs.getBool('proMode') ?? true;
  Future<void> setProMode({required bool value}) =>
      _prefs.setBool('proMode', value);

  // --- Appearance ---
  String? get themeMode => _prefs.getString('themeMode');
  Future<void> setThemeMode(String value) =>
      _prefs.setString('themeMode', value);

  // --- Secure Settings ---
  Future<String?> getApiKey() => _secureStorage.read(key: 'apiKey');
  Future<void> setApiKey(String key) =>
      _secureStorage.write(key: 'apiKey', value: key);
  Future<void> deleteApiKey() => _secureStorage.delete(key: 'apiKey');
}
