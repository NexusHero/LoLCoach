"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeWsServer = void 0;
const ws_1 = require("ws");
const tsyringe_1 = require("tsyringe");
const logger_js_1 = require("./logger.js");
const tokens_js_1 = require("./tokens.js");
let BridgeWsServer = class BridgeWsServer {
    wss;
    clients = new Set();
    onMessage;
    constructor(wss) {
        this.wss = wss;
        this.setupHandlers();
    }
    /**
     * BridgeWsServer <-> MessageRouter is a genuine constructor cycle (the
     * router needs the orchestrator, which needs this wsServer). Set after
     * construction by the composition root instead of via constructor param.
     */
    setMessageHandler(handler) {
        this.onMessage = handler;
    }
    setupHandlers() {
        this.wss.on("listening", () => {
            const addr = this.wss.address();
            const port = typeof addr === "object" && addr ? addr.port : "?";
            logger_js_1.Logger.info(`[WS] Server listening on ws://0.0.0.0:${port}`);
        });
        this.wss.on("connection", (ws, req) => {
            const ip = req.socket.remoteAddress ?? "unbekannt";
            logger_js_1.Logger.info(`[WS] Client connected: ${ip} (${this.clients.size + 1} total)`);
            this.clients.add(ws);
            ws.on("message", (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    if (this.onMessage) {
                        this.onMessage(ws, parsed);
                    }
                }
                catch (err) {
                    logger_js_1.Logger.warn(`[WS] Failed to parse message from ${ip}`, err);
                }
            });
            ws.on("close", () => {
                this.clients.delete(ws);
                logger_js_1.Logger.info(`[WS] Client disconnected: ${ip} (${this.clients.size} remaining)`);
            });
            ws.on("error", (err) => {
                logger_js_1.Logger.error(`[WS] Client error (${ip}):`, err.message);
                this.clients.delete(ws);
            });
            this.sendTo(ws, { event: "CONNECTED", timestamp: Date.now() });
        });
        this.wss.on("error", (err) => {
            logger_js_1.Logger.error("[WS] Server error:", err);
        });
    }
    broadcast(message) {
        if (this.clients.size === 0)
            return;
        const payload = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
    sendTo(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    get clientCount() {
        return this.clients.size;
    }
    close() {
        this.wss.close();
    }
};
exports.BridgeWsServer = BridgeWsServer;
exports.BridgeWsServer = BridgeWsServer = __decorate([
    (0, tsyringe_1.singleton)(),
    __param(0, (0, tsyringe_1.inject)(tokens_js_1.WSS_TOKEN)),
    __metadata("design:paramtypes", [ws_1.WebSocketServer])
], BridgeWsServer);
