import Gio from "gi://Gio";
import Soup from "gi://Soup";
import { logger } from "./logger.js";
import { SettingsService } from "./settings_service.js";
import { SyncAnga } from "./sync/sync_anga.js";
import { SyncMeta } from "./sync/sync_meta.js";
import { LocalRepo } from "./sync/local_repo.js";
import { SyncResult } from "./sync/sync_result.js";
import { ServerRepo } from "./sync/server_repo.js";
import { SyncWords } from "./sync/sync_words.js";

Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish"
);

export { SyncResult };

export class SyncService {
  private _settingsService: SettingsService;
  private _session: Soup.Session;
  private _isSyncing = false;

  constructor(settingsService: SettingsService) {
    this._settingsService = settingsService;
    this._session = new Soup.Session();
    this._session.set_proxy_resolver(null);
  }

  get isSyncing(): boolean {
    return this._isSyncing;
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

    const password = await this._settingsService.getPassword();
    if (!password) {
      logger.log("No password configured, skipping sync");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    this._isSyncing = true;
    const result: SyncResult = {
      downloaded: [],
      uploaded: [],
      errors: [],
    };

    try {
      const baseUrl = this._settingsService.serverUrl;
      const email = this._settingsService.email;

      logger.log(`Starting sync with ${baseUrl} for ${email}`);

      const serverRepo = new ServerRepo(
        this._session,
        baseUrl,
        email,
        password
      );
      const localRepo = new LocalRepo();

      await new SyncAnga(serverRepo, localRepo).sync(result);
      await new SyncMeta(serverRepo, localRepo).sync(result);
      await new SyncWords(serverRepo, localRepo).sync(result);

      logger.log(
        `Sync complete: ${result.downloaded.length} downloaded, ${result.uploaded.length} uploaded, ${result.errors.length} errors`
      );
    } finally {
      this._isSyncing = false;
    }

    return result;
  }
}
