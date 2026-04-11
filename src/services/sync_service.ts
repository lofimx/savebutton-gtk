import Gio from "gi://Gio";
import Soup from "gi://Soup";
import { logger } from "./logger.js";
import { AuthService } from "./auth_service.js";
import { SettingsService } from "./settings_service.js";
import { SyncAnga } from "./sync/sync_anga.js";
import { SyncMeta } from "./sync/sync_meta.js";
import { LocalRepo } from "./sync/local_repo.js";
import { SyncResult } from "./sync/sync_result.js";
import { ServerRepo, AuthenticationError } from "./sync/server_repo.js";
import { SyncWords } from "./sync/sync_words.js";

Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish"
);

export { SyncResult };

export class SyncService {
  private _settingsService: SettingsService;
  private _authService: AuthService;
  private _session: Soup.Session;
  private _isSyncing = false;

  constructor(settingsService: SettingsService, authService?: AuthService) {
    this._settingsService = settingsService;
    this._authService =
      authService || new AuthService(settingsService);
    this._session = new Soup.Session();
    this._session.set_proxy_resolver(null);
    this._session.set_user_agent("SaveButton-GTK/1.0");
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  get authService(): AuthService {
    return this._authService;
  }

  async sync(): Promise<SyncResult> {
    if (this._isSyncing) {
      logger.log("Sync already in progress, skipping");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    if (!this._settingsService.shouldSync()) {
      logger.log("Sync not configured or disabled");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    this._isSyncing = true;

    try {
      return await this._doSync();
    } finally {
      this._isSyncing = false;
    }
  }

  private async _doSync(): Promise<SyncResult> {
    const result: SyncResult = {
      downloaded: [],
      uploaded: [],
      errors: [],
    };

    try {
      await this._syncWithAuth(result);
    } catch (e) {
      if (e instanceof AuthenticationError) {
        logger.log(
          "INFO SyncService got 401, attempting token refresh and retry"
        );
        const newToken = await this._authService.refreshAccessToken();
        if (newToken) {
          // Reset result and retry
          result.downloaded = [];
          result.uploaded = [];
          result.errors = [];
          await this._syncWithAuth(result);
        } else {
          logger.log(
            "WARN SyncService token refresh failed, auth cleared"
          );
          result.errors.push({
            operation: "auth",
            file: "",
            error: "Authentication failed. Please sign in again.",
          });
        }
      } else {
        throw e;
      }
    }

    return result;
  }

  private async _syncWithAuth(result: SyncResult): Promise<void> {
    const authHeader = await this._authService.getAuthHeader();
    if (!authHeader) {
      logger.log("No auth credentials available, skipping sync");
      return;
    }

    const baseUrl = this._settingsService.serverUrl;
    const email = this._settingsService.authEmail;

    logger.log(`Starting sync with ${baseUrl} for ${email}`);

    const serverRepo = new ServerRepo(
      this._session,
      baseUrl,
      email,
      authHeader
    );
    const localRepo = new LocalRepo();

    await new SyncAnga(serverRepo, localRepo).sync(result);
    await new SyncMeta(serverRepo, localRepo).sync(result);
    await new SyncWords(serverRepo, localRepo).sync(result);

    logger.log(
      `Sync complete: ${result.downloaded.length} downloaded, ${result.uploaded.length} uploaded, ${result.errors.length} errors`
    );
  }
}
