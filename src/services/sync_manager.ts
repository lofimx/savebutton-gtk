import GLib from "gi://GLib";
import { logger } from "./logger.js";
import { SettingsService } from "./settings_service.js";
import { SyncService } from "./sync_service.js";

const SYNC_INTERVAL_SECONDS = 60;

export class SyncManager {
  private _settingsService: SettingsService;
  private _syncService: SyncService;
  private _timeoutId: number | null = null;
  private _isRunning = false;

  constructor() {
    this._settingsService = new SettingsService();
    this._syncService = new SyncService(this._settingsService);
  }

  start(): void {
    if (this._isRunning) {
      logger.log("SyncManager already running");
      return;
    }

    this._isRunning = true;
    logger.log("SyncManager started");

    // Run initial sync
    this._runSync();

    // Schedule periodic sync every minute
    this._scheduleNextSync();
  }

  stop(): void {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    if (this._timeoutId !== null) {
      GLib.source_remove(this._timeoutId);
      this._timeoutId = null;
    }

    logger.log("SyncManager stopped");
  }

  private _scheduleNextSync(): void {
    if (!this._isRunning) {
      return;
    }

    this._timeoutId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      SYNC_INTERVAL_SECONDS,
      () => {
        this._runSync();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  sync(): void {
    this._runSync();
  }

  private _runSync(): void {
    if (!this._settingsService.shouldSync()) {
      logger.log("Sync not configured, skipping periodic sync");
      return;
    }

    this._settingsService.syncInProgress = true;

    this._syncService
      .sync()
      .then((result) => {
        if (result.errors.length > 0) {
          const errorMsg = result.errors
            .map((e) => `${e.operation} ${e.file}: ${e.error}`)
            .join("; ");
          this._settingsService.lastSyncError = errorMsg;
        } else {
          this._settingsService.lastSyncError = "";
          this._settingsService.lastSyncSuccess = new Date().toISOString();
        }
      })
      .catch((e) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this._settingsService.lastSyncError = errorMessage;
        logger.error(`Sync failed: ${e as string}`);
      })
      .finally(() => {
        this._settingsService.syncInProgress = false;
      });
  }
}
