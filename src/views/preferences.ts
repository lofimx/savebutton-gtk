import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SettingsService } from "../services/settings_service.js";
import { SyncService } from "../services/sync_service.js";
import { logger } from "../services/logger.js";

export class PreferencesWindow extends Adw.PreferencesWindow {
  private declare _serverUrlEntry: Adw.EntryRow;
  private declare _emailEntry: Adw.EntryRow;
  private declare _passwordEntry: Adw.PasswordEntryRow;
  private declare _saveCredentialsButton: Gtk.Button;
  private declare _clearCredentialsButton: Gtk.Button;
  private declare _syncStatusRow: Adw.ActionRow;
  private declare _forceSyncButton: Gtk.Button;
  private declare _nativeHostPortRow: Adw.SpinRow;

  private _settingsService: SettingsService;
  private _syncService: SyncService;
  private _settingsChangedId: number | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/savebutton/SaveButton/preferences.ui",
        InternalChildren: [
          "serverUrlEntry",
          "emailEntry",
          "passwordEntry",
          "saveCredentialsButton",
          "clearCredentialsButton",
          "syncStatusRow",
          "forceSyncButton",
          "nativeHostPortRow",
        ],
      },
      this
    );
  }

  constructor(params?: Partial<Adw.PreferencesWindow.ConstructorProps>) {
    super(params);
    this._settingsService = new SettingsService();
    this._syncService = new SyncService(this._settingsService);
    this._loadSettings();
    this._connectSignals();

    // Listen for settings changes (e.g., from sync errors)
    this._settingsChangedId = this._settingsService.connectChanged(() => {
      this._updateSyncStatus();
    });

    // Clean up when window is closed
    this.connect("close-request", () => {
      if (this._settingsChangedId !== null) {
        this._settingsService.disconnectChanged(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      return false;
    });
  }

  private _loadSettings(): void {
    this._serverUrlEntry.text = this._settingsService.serverUrl;
    this._emailEntry.text = this._settingsService.email;
    this._nativeHostPortRow.value = this._settingsService.nativeHostPort;

    this._settingsService
      .getPassword()
      .then((password) => {
        if (password) {
          this._passwordEntry.text = password;
        }
        this._updateSyncStatus();
      })
      .catch((e) => {
        logger.error(`Failed to load password: ${e as string}`);
        this._updateSyncStatus();
      });

    this._updateSyncStatus();
  }

  private _connectSignals(): void {
    this._saveCredentialsButton.connect("clicked", () => {
      this._saveCredentials();
    });

    this._clearCredentialsButton.connect("clicked", () => {
      this._confirmClearCredentials();
    });

    this._forceSyncButton.connect("clicked", () => {
      this._forceSync();
    });

    this._nativeHostPortRow.connect("notify::value", () => {
      this._settingsService.nativeHostPort = this._nativeHostPortRow.value;
      logger.log(
        `🔵 INFO PreferencesWindow native host port changed to ${this._nativeHostPortRow.value.toString()}`
      );
    });
  }

  private _saveCredentials(): void {
    const serverUrl = this._serverUrlEntry.text.trim();
    const email = this._emailEntry.text.trim();
    const password = this._passwordEntry.text;

    if (!serverUrl) {
      this._syncStatusRow.subtitle = "Enter a server URL";
      return;
    }

    if (!email || !password) {
      this._syncStatusRow.subtitle = "Enter both email and password";
      return;
    }

    this._settingsService.serverUrl = serverUrl;
    this._settingsService.email = email;

    this._settingsService
      .setPassword(password)
      .then(() => {
        this._settingsService.syncEnabled = true;
        this._updateSyncStatus();
        logger.log("🔵 INFO PreferencesWindow credentials saved");
      })
      .catch((e) => {
        logger.error(
          `🔴 ERROR PreferencesWindow failed to save password: ${e as string}`
        );
        this._syncStatusRow.subtitle = "Failed to save password";
      });
  }

  private _confirmClearCredentials(): void {
    const dialog = new Adw.AlertDialog({
      heading: "Clear Credentials?",
      body: "Are you sure you want to clear your email and password?",
    });

    dialog.add_response("cancel", "Cancel");
    dialog.add_response("clear", "Clear");
    dialog.set_response_appearance("clear", Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.set_default_response("cancel");
    dialog.set_close_response("cancel");

    dialog.connect("response", (_dialog: Adw.AlertDialog, response: string) => {
      if (response === "clear") {
        this._clearCredentials();
      }
    });

    dialog.present(this);
  }

  private _clearCredentials(): void {
    this._settingsService.syncEnabled = false;
    this._settingsService.email = "";

    this._settingsService
      .clearPassword()
      .then(() => {
        this._emailEntry.text = "";
        this._passwordEntry.text = "";
        this._updateSyncStatus();
        logger.log("🔵 INFO PreferencesWindow credentials cleared");
      })
      .catch((e) => {
        logger.error(
          `🔴 ERROR PreferencesWindow failed to clear password: ${e as string}`
        );
      });
  }

  private _forceSync(): void {
    if (!this._settingsService.shouldSync()) {
      return;
    }

    this._forceSyncButton.sensitive = false;
    this._syncStatusRow.subtitle = "Syncing...";

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
        this._updateSyncStatus();
      })
      .catch((e) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this._settingsService.lastSyncError = errorMessage;
        this._updateSyncStatus();
      })
      .finally(() => {
        this._forceSyncButton.sensitive = true;
      });
  }

  private _updateSyncStatus(): void {
    if (this._settingsService.syncInProgress) {
      this._syncStatusRow.subtitle = "Syncing\u2026";
      this._forceSyncButton.sensitive = false;
      return;
    }

    this._forceSyncButton.sensitive = true;

    if (!this._settingsService.shouldSync()) {
      this._syncStatusRow.subtitle = "Not configured";
      return;
    }

    const lastError = this._settingsService.lastSyncError;
    const lastSuccess = this._settingsService.lastSyncSuccess;

    if (lastError) {
      this._syncStatusRow.subtitle = `Error: ${lastError}`;
    } else if (lastSuccess) {
      const successDate = new Date(lastSuccess);
      this._syncStatusRow.subtitle = `Last sync: ${successDate.toLocaleString()}`;
    } else {
      this._syncStatusRow.subtitle = `Ready to sync with ${this._settingsService.serverUrl}`;
    }
  }
}
