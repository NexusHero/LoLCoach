import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef WebSocketChannelFactory = WebSocketChannel Function(
  Uri uri, {
  Map<String, dynamic>? headers,
});

WebSocketChannel _defaultChannelFactory(
  Uri uri, {
  Map<String, dynamic>? headers,
}) {
  if (kIsWeb) {
    final targetUri = uri.port == 8765 ? uri.replace(port: 8080) : uri;
    return WebSocketChannel.connect(targetUri);
  }
  return IOWebSocketChannel.connect(uri, headers: headers);
}

enum ConnectionStatus { disconnected, connecting, connected, error }

/// A pure network client for managing the WebSocket connection.
/// Handles connection lifecycle, exponential backoff, and exposes a raw stream.
class WsClient extends ChangeNotifier {
  WsClient({WebSocketChannelFactory? channelFactory})
      : _channelFactory = channelFactory ?? _defaultChannelFactory;

  final WebSocketChannelFactory _channelFactory;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;

  ConnectionStatus _status = ConnectionStatus.disconnected;
  String? _lastError;
  bool _intentionalDisconnect = false;
  Duration _reconnectDelay = const Duration(seconds: 1);
  static const Duration _maxReconnectDelay = Duration(seconds: 30);

  Uri? _lastUri;
  Map<String, dynamic>? _lastHeaders;

  final _messageController = StreamController<String>.broadcast();

  Stream<String> get messages => _messageController.stream;
  ConnectionStatus get status => _status;
  String? get lastError => _lastError;
  bool get isConnected => _status == ConnectionStatus.connected;

  void connect(Uri uri, {Map<String, dynamic>? headers}) {
    if (_status == ConnectionStatus.connected ||
        _status == ConnectionStatus.connecting) {
      return;
    }

    _lastUri = uri;
    _lastHeaders = headers;
    _intentionalDisconnect = false;
    _reconnectDelay = const Duration(seconds: 1);

    _doConnect();
  }

  void disconnect() {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectDelay = const Duration(seconds: 1);

    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
    _subscription = null;
    _status = ConnectionStatus.disconnected;
    _lastError = null;
    notifyListeners();
  }

  void send(String data) {
    if (_status == ConnectionStatus.connected) {
      _channel?.sink.add(data);
    }
  }

  void _doConnect() {
    if (_lastUri == null) return;

    _status = ConnectionStatus.connecting;
    _lastError = null;
    notifyListeners();

    try {
      _channel = _channelFactory(_lastUri!, headers: _lastHeaders);
      _subscription = _channel!.stream.listen(
        _onData,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
    } catch (e) {
      _status = ConnectionStatus.error;
      _lastError = e.toString();
      notifyListeners();
      _scheduleReconnect();
    }
  }

  void _onData(dynamic raw) {
    if (_status != ConnectionStatus.connected) {
      _status = ConnectionStatus.connected;
      _reconnectDelay = const Duration(seconds: 1);
      notifyListeners();
    }
    if (raw is String) {
      _messageController.add(raw);
    }
  }

  void _onError(Object error) {
    _status = ConnectionStatus.error;
    _lastError = error.toString();
    notifyListeners();
    _scheduleReconnect();
  }

  void _onDone() {
    if (_intentionalDisconnect) {
      if (_status != ConnectionStatus.disconnected) {
        _status = ConnectionStatus.disconnected;
        notifyListeners();
      }
      return;
    }
    if (_status != ConnectionStatus.disconnected) {
      _status = ConnectionStatus.disconnected;
      notifyListeners();
    }
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_intentionalDisconnect || _lastUri == null) return;
    _reconnectTimer?.cancel();

    debugPrint('[WsClient] Reconnecting in ${_reconnectDelay.inSeconds}s...');
    _reconnectTimer = Timer(_reconnectDelay, () {
      if (_intentionalDisconnect) return;

      _reconnectDelay = Duration(
        seconds: (_reconnectDelay.inSeconds * 2)
            .clamp(1, _maxReconnectDelay.inSeconds),
      );

      _doConnect();
    });
  }

  @override
  void dispose() {
    disconnect();
    _messageController.close();
    super.dispose();
  }
}
