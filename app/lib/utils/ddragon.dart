import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

const _kFallbackVersion = '15.12.1';
const _kVersionsUrl = 'https://ddragon.leagueoflegends.com/api/versions.json';
const _kPrefKey = 'ddragon_version';
const _kBase = 'https://ddragon.leagueoflegends.com/cdn';

const _kChampOverrides = <String, String>{
  'Wukong': 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
  'Renata Glasc': 'Renata',
};

String _version = _kFallbackVersion;

/// Call once at startup. Uses cached version immediately;
/// refreshes in background.
Future<void> initDDragonVersion() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    _version = prefs.getString(_kPrefKey) ?? _kFallbackVersion;

    final client = HttpClient();
    try {
      final request = await client.getUrl(Uri.parse(_kVersionsUrl));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      final versions = (jsonDecode(body) as List<dynamic>).cast<String>();
      if (versions.isNotEmpty) {
        _version = versions[0];
        await prefs.setString(_kPrefKey, _version);
      }
    } finally {
      client.close();
    }
  } catch (_) {
    // Keep cached or fallback version — app works without network
  }
}

String champImageUrl(String name) {
  final key = _champKey(name);
  return '$_kBase/$_version/img/champion/$key.png';
}

String champSplashUrl(String name) {
  final key = _champKey(name);
  return '$_kBase/img/champion/splash/${key}_0.jpg';
}

String _champKey(String name) =>
    _kChampOverrides[name] ??
    name
        .replaceAll("'", '')
        .replaceAll('.', '')
        .replaceAll(' & ', '')
        .replaceAll(' ', '');

String itemImageUrl(int itemId) => '$_kBase/$_version/img/item/$itemId.png';
