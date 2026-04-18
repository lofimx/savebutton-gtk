import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { AuthService } from "../services/auth_service.js";
import { SettingsService } from "../services/settings_service.js";
import { SyncService } from "../services/sync_service.js";
import { logger } from "../services/logger.js";
import { providerIconLabel } from "../models/auth_provider.js";

const DEFAULT_SERVER_URL = "https://savebutton.com";

function isPrivateIpUrl(url: string): boolean {
  const match = url.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return false;
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLocalhostUrl(url: string): boolean {
  const lower = url.toLowerCase().trim();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

export class PreferencesWindow extends Adw.PreferencesWindow {
  // Connected state
  private declare _connectedGroup: Adw.PreferencesGroup;
  private declare _connectedEmailRow: Adw.ActionRow;
  private declare _connectedEmailIcon: Gtk.Image;
  private declare _signOutButton: Gtk.Button;

  // Sign-in state
  private declare _signInGroup: Adw.PreferencesGroup;
  private declare _signInGoogleButton: Gtk.Button;
  private declare _signInMicrosoftButton: Gtk.Button;
  private declare _signInAppleButton: Gtk.Button;
  private declare _emailEntry: Adw.EntryRow;
  private declare _passwordEntry: Adw.PasswordEntryRow;
  private declare _signInPasswordButton: Gtk.Button;
  private declare _signUpButton: Gtk.Button;

  // Actions
  private declare _actionsGroup: Adw.PreferencesGroup;
  private declare _syncStatusRow: Adw.ActionRow;
  private declare _forceSyncButton: Gtk.Button;

  // Server
  private declare _serverGroup: Adw.PreferencesGroup;
  private declare _serverUrlEntry: Adw.EntryRow;
  private declare _ngrokWarningBox: Gtk.Box;
  private declare _ngrokWarningLabel: Gtk.Label;

  // Browser
  private declare _nativeHostPortRow: Adw.SpinRow;

  private _settingsService: SettingsService;
  private _authService: AuthService;
  private _syncService: SyncService;
  private _settingsChangedId: number | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/savebutton/SaveButton/preferences.ui",
        InternalChildren: [
          "connectedGroup",
          "connectedEmailRow",
          "connectedEmailIcon",
          "signOutButton",
          "signInGroup",
          "signInGoogleButton",
          "signInMicrosoftButton",
          "signInAppleButton",
          "emailEntry",
          "passwordEntry",
          "signInPasswordButton",
          "signUpButton",
          "actionsGroup",
          "syncStatusRow",
          "forceSyncButton",
          "serverGroup",
          "serverUrlEntry",
          "ngrokWarningBox",
          "ngrokWarningLabel",
          "nativeHostPortRow",
        ],
      },
      this
    );
  }

  constructor(params?: Partial<Adw.PreferencesWindow.ConstructorProps>) {
    super(params);
    this._settingsService = new SettingsService();
    this._authService = new AuthService(this._settingsService);
    this._syncService = new SyncService(
      this._settingsService,
      this._authService
    );
    this._loadSettings();
    this._connectSignals();

    this._settingsChangedId = this._settingsService.connectChanged(() => {
      this._updateAuthState();
      this._updateSyncStatus();
    });

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
    this._nativeHostPortRow.value = this._settingsService.nativeHostPort;
    this._updateAuthState();
    this._updateSyncStatus();
    this._updateNgrokWarning();
  }

  private _connectSignals(): void {
    this._signInGoogleButton.connect("clicked", () => {
      this._signInWithProvider("google_oauth2");
    });

    this._signInMicrosoftButton.connect("clicked", () => {
      this._signInWithProvider("microsoft_graph");
    });

    this._signInPasswordButton.connect("clicked", () => {
      this._signInWithPassword();
    });

    this._signUpButton.connect("clicked", () => {
      this._signUp();
    });

    this._signOutButton.connect("clicked", () => {
      this._confirmSignOut();
    });

    this._forceSyncButton.connect("clicked", () => {
      this._forceSync();
    });

    this._serverUrlEntry.connect("changed", () => {
      this._updateNgrokWarning();
    });

    this._nativeHostPortRow.connect("notify::value", () => {
      this._settingsService.nativeHostPort = this._nativeHostPortRow.value;
      logger.log(
        `INFO PreferencesWindow native host port changed to ${this._nativeHostPortRow.value.toString()}`
      );
    });
  }

  private _updateAuthState(): void {
    const isSignedIn = this._settingsService.shouldSync();

    this._connectedGroup.visible = isSignedIn;
    this._signInGroup.visible = !isSignedIn;
    this._actionsGroup.visible = isSignedIn;

    if (isSignedIn) {
      const provider = this._settingsService.authIdentityProvider;
      const { icon, label } = providerIconLabel(provider);
      this._connectedEmailRow.title = `Signed in with ${label}`;
      this._connectedEmailRow.subtitle =
        this._settingsService.authEmail || "—";
      this._connectedEmailIcon.set_from_icon_name(icon);
      logger.log(
        `DEBUG PreferencesWindow auth state: signedIn=true provider=${provider || "(email)"}`
      );
    } else {
      logger.log("DEBUG PreferencesWindow auth state: signedIn=false");
    }
  }

  private _updateNgrokWarning(): void {
    const url = this._serverUrlEntry.text.trim();
    const showWarning =
      url.length > 0 &&
      url !== DEFAULT_SERVER_URL &&
      (isLocalhostUrl(url) || isPrivateIpUrl(url));

    this._ngrokWarningBox.visible = showWarning;

    if (showWarning) {
      this._ngrokWarningLabel.label =
        "Email/password sign-in works with a LAN IP, " +
        "but OAuth (Google, Microsoft) will not. " +
        "Use an ngrok tunnel for OAuth testing.";
    }
  }

  private _signInWithProvider(provider: string): void {
    const serverUrl = this._serverUrlEntry.text.trim();
    if (!serverUrl) {
      this._syncStatusRow.subtitle = "Enter a server URL";
      return;
    }
    this._settingsService.serverUrl = serverUrl;
    this._syncStatusRow.subtitle = "Waiting for browser login\u2026";
    logger.log(
      `INFO PreferencesWindow opening browser for ${provider} login`
    );
    this._authService.startBrowserLogin(provider);
  }

  private _signUp(): void {
    const serverUrl = this._serverUrlEntry.text.trim();
    if (!serverUrl) {
      this._syncStatusRow.subtitle = "Enter a server URL";
      return;
    }
    this._settingsService.serverUrl = serverUrl;
    this._syncStatusRow.subtitle = "Waiting for browser registration\u2026";
    logger.log("INFO PreferencesWindow opening browser for registration");
    this._authService.startBrowserRegistration();
  }

  private _signInWithPassword(): void {
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
    this._signInPasswordButton.sensitive = false;
    this._syncStatusRow.subtitle = "Signing in\u2026";

    logger.log("INFO PreferencesWindow signing in with email/password");

    this._authService
      .loginWithPassword(email, password)
      .then((success) => {
        if (success) {
          logger.log("INFO PreferencesWindow token login successful");
          this._passwordEntry.text = "";
          this._emailEntry.text = "";
          this._updateAuthState();
          this._updateSyncStatus();
        } else {
          this._syncStatusRow.subtitle =
            "Sign in failed. Check your email and password.";
        }
      })
      .catch((e) => {
        logger.error(
          `PreferencesWindow token login error: ${e as string}`
        );
        this._syncStatusRow.subtitle =
          "Sign in failed. Check your email and password.";
      })
      .finally(() => {
        this._signInPasswordButton.sensitive = true;
      });
  }

  private _confirmSignOut(): void {
    const dialog = new Adw.AlertDialog({
      heading: "Sign Out?",
      body: "Are you sure you want to sign out? Syncing will be disabled.",
    });

    dialog.add_response("cancel", "Cancel");
    dialog.add_response("sign-out", "Sign Out");
    dialog.set_response_appearance(
      "sign-out",
      Adw.ResponseAppearance.DESTRUCTIVE
    );
    dialog.set_default_response("cancel");
    dialog.set_close_response("cancel");

    dialog.connect("response", (_dialog: Adw.AlertDialog, response: string) => {
      if (response === "sign-out") {
        this._signOut();
      }
    });

    dialog.present(this);
  }

  private _signOut(): void {
    logger.log("INFO PreferencesWindow signing out");

    this._authService
      .signOut()
      .then(() => {
        this._updateAuthState();
        this._updateSyncStatus();
        logger.log("INFO PreferencesWindow signed out");
      })
      .catch((e) => {
        logger.error(`PreferencesWindow sign out error: ${e as string}`);
        // Clear local state even if server revocation failed
        this._authService
          .clearTokenAuth()
          .then(() => {
            this._updateAuthState();
            this._updateSyncStatus();
          })
          .catch(() => {});
      });
  }

  private _forceSync(): void {
    if (!this._settingsService.shouldSync()) {
      return;
    }

    this._forceSyncButton.sensitive = false;
    this._syncStatusRow.subtitle = "Syncing\u2026";

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
