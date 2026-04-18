import GLib from "gi://GLib";
import Soup from "gi://Soup";
import { logger } from "../logger.js";
import { SettingsService } from "../settings_service.js";
import { LocalRepo } from "../sync/local_repo.js";
import {
  NativeHostRequest,
  NativeHostRequestType,
} from "../../models/native_host/native_host_request.js";

const DEFAULT_PORT = 21420;

export class NativeHostServer {
  private _server: Soup.Server | null = null;
  private _settingsService: SettingsService;
  private _localRepo: LocalRepo;
  private _onFileReceived: ((collection: string, filename: string) => void) | null = null;

  constructor(settingsService: SettingsService) {
    this._settingsService = settingsService;
    this._localRepo = new LocalRepo();
  }

  set onFileReceived(callback: (collection: string, filename: string) => void) {
    this._onFileReceived = callback;
  }

  start(): void {
    const port = this._settingsService.nativeHostPort || DEFAULT_PORT;

    this._server = new Soup.Server();
    this._server.add_handler(null, (_server, msg, path) => {
      this._handleRequest(msg, path);
    });

    try {
      this._server.listen_local(port, Soup.ServerListenOptions.IPV4_ONLY);
      logger.log(
        `🔵 INFO NativeHostServer listening on 127.0.0.1:${port.toString()}`
      );
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(
        `🔴 ERROR NativeHostServer failed to start on port ${port.toString()}: ${error}`
      );
    }
  }

  stop(): void {
    if (this._server) {
      this._server.disconnect();
      this._server = null;
      logger.log("🔵 INFO NativeHostServer stopped");
    }
  }

  private _handleRequest(msg: Soup.ServerMessage, path: string): void {
    const method = msg.get_method();
    const request = new NativeHostRequest(method, path);

    this._addCorsHeaders(msg);

    switch (request.type.kind) {
      case "preflight":
        this._handlePreflight(msg);
        break;
      case "health":
        this._handleHealth(msg);
        break;
      case "listing":
        this._handleListing(msg, request.type);
        break;
      case "file_write":
        this._handleFileWrite(msg, request.type);
        break;
      case "config":
        this._handleConfig(msg);
        break;
      case "invalid":
        this._handleInvalid(msg, request.type.reason);
        break;
    }
  }

  private _addCorsHeaders(msg: Soup.ServerMessage): void {
    const headers = msg.get_response_headers();
    headers.append("Access-Control-Allow-Origin", "*");
    headers.append(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    headers.append(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
  }

  private _handlePreflight(msg: Soup.ServerMessage): void {
    msg.set_status(204, null);
    logger.log("🟢 DEBUG NativeHostServer OPTIONS preflight");
  }

  private _handleHealth(msg: Soup.ServerMessage): void {
    const body = new TextEncoder().encode("ok");
    msg.set_status(200, null);
    msg.set_response("text/plain", Soup.MemoryUse.COPY, body);
    logger.log("🟢 DEBUG NativeHostServer GET /health");
  }

  private _handleListing(
    msg: Soup.ServerMessage,
    type: Extract<NativeHostRequestType, { kind: "listing" }>
  ): void {
    const collection = type.collection;

    try {
      // GET /words lists subdirectories; everything else lists files
      const items =
        collection === "words"
          ? this._localRepo.listDirectories(collection)
          : this._localRepo.listFiles(collection);

      const body = new TextEncoder().encode(items.join("\n") + "\n");
      msg.set_status(200, null);
      msg.set_response("text/plain", Soup.MemoryUse.COPY, body);

      logger.log(
        `🟢 DEBUG NativeHostServer GET /${collection}: ${items.length.toString()} items`
      );
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(
        `🔴 ERROR NativeHostServer listing /${collection}: ${error}`
      );
      msg.set_status(500, null);
      msg.set_response(
        "text/plain",
        Soup.MemoryUse.COPY,
        new TextEncoder().encode("Internal server error")
      );
    }
  }

  private _handleFileWrite(
    msg: Soup.ServerMessage,
    type: Extract<NativeHostRequestType, { kind: "file_write" }>
  ): void {
    const collection = type.collection;
    const filename = type.filename;

    try {
      this._localRepo.ensureDir(collection);

      const requestBody = msg.get_request_body();
      const bytes = requestBody.flatten();
      const data = bytes.get_data();

      if (!data) {
        msg.set_status(400, null);
        msg.set_response(
          "text/plain",
          Soup.MemoryUse.COPY,
          new TextEncoder().encode("Empty request body")
        );
        return;
      }

      this._localRepo.writeFile(collection, filename, data);

      msg.set_status(200, null);
      msg.set_response(
        "text/plain",
        Soup.MemoryUse.COPY,
        new TextEncoder().encode("ok")
      );

      logger.log(
        `🔵 INFO NativeHostServer wrote ${collection}/${filename}`
      );

      this._onFileReceived?.(collection, filename);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(
        `🔴 ERROR NativeHostServer writing ${collection}/${filename}: ${error}`
      );
      msg.set_status(500, null);
      msg.set_response(
        "text/plain",
        Soup.MemoryUse.COPY,
        new TextEncoder().encode("Internal server error")
      );
    }
  }

  // The /config endpoint was originally used to bootstrap an extension-spawned
  // Rust daemon. The desktop app is now installed and run independently of the
  // extension, so accepting config pushes would silently clobber user state.
  // The endpoint is retained but deprecated: any POST returns 410 Gone so a
  // future extension build can detect the deprecation and stop sending.
  private _handleConfig(msg: Soup.ServerMessage): void {
    logger.log(
      "🟠 WARN NativeHostServer /config is deprecated; returning 410 Gone"
    );

    msg.get_response_headers().append("Deprecation", "true");
    msg.set_status(410, null);
    msg.set_response(
      "application/json",
      Soup.MemoryUse.COPY,
      new TextEncoder().encode(
        '{"error":"deprecated","message":"The /config endpoint is no longer supported. Configure Save Button in its Preferences window."}'
      )
    );
  }

  private _handleInvalid(msg: Soup.ServerMessage, reason: string): void {
    logger.log(
      `🟠 WARN NativeHostServer invalid request: ${reason}`
    );
    msg.set_status(400, null);
    msg.set_response(
      "text/plain",
      Soup.MemoryUse.COPY,
      new TextEncoder().encode(reason)
    );
  }
}
