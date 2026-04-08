import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { logger } from "./logger.js";

const DEFAULT_SERVER_URL = "https://savebutton.com";
const SECRET_SCHEMA_NAME = "org.savebutton.SaveButton";

// Platform detection: KAYA_PLATFORM is set by platform-specific shell launchers
const KAYA_PLATFORM = GLib.getenv("KAYA_PLATFORM");
const IS_MACOS = KAYA_PLATFORM === "macos";
const IS_WINDOWS = KAYA_PLATFORM === "windows";

// --- macOS Keychain helpers (use `security` CLI) ---

const KEYCHAIN_SERVICE = "org.savebutton.SaveButton";
const KEYCHAIN_ACCOUNT = "savebutton-server-password";

function _macosGetPassword(): string | null {
  try {
    const [ok, stdout] = GLib.spawn_sync(
      null,
      [
        "security",
        "find-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
        "-w",
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    if (ok && stdout) {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(stdout).trim();
    }
    return null;
  } catch {
    return null;
  }
}

function _macosSetPassword(password: string): boolean {
  try {
    const [ok] = GLib.spawn_sync(
      null,
      [
        "security",
        "add-generic-password",
        "-U",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
        "-w",
        password,
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

function _macosClearPassword(): boolean {
  try {
    const [ok] = GLib.spawn_sync(
      null,
      [
        "security",
        "delete-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

// --- Linux libsecret (conditional import) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Secret: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let passwordSchema: any = null;

if (!IS_MACOS && !IS_WINDOWS) {
  try {
    Secret = (await import("gi://Secret")).default;
    Gio._promisify(Secret, "password_store", "password_store_finish");
    Gio._promisify(Secret, "password_lookup", "password_lookup_finish");
    Gio._promisify(Secret, "password_clear", "password_clear_finish");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    passwordSchema = new Secret.Schema(
      SECRET_SCHEMA_NAME,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Secret.SchemaFlags.NONE,
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        application: Secret.SchemaAttributeType.STRING,
      }
    );
  } catch (e) {
    logger.error(`libsecret not available: ${e as string}`);
  }
}

export class SettingsService {
  private _settings: Gio.Settings;

  constructor() {
    this._settings = new Gio.Settings({
      schema_id: "org.savebutton.SaveButton",
    });
  }

  get serverUrl(): string {
    return this._settings.get_string("sync-server-url") || DEFAULT_SERVER_URL;
  }

  set serverUrl(value: string) {
    this._settings.set_string("sync-server-url", value || DEFAULT_SERVER_URL);
  }

  get email(): string {
    return this._settings.get_string("sync-email") || "";
  }

  set email(value: string) {
    this._settings.set_string("sync-email", value || "");
  }

  get syncEnabled(): boolean {
    return this._settings.get_boolean("sync-enabled");
  }

  set syncEnabled(value: boolean) {
    this._settings.set_boolean("sync-enabled", value);
  }

  get syncInProgress(): boolean {
    return this._settings.get_boolean("sync-in-progress");
  }

  set syncInProgress(value: boolean) {
    this._settings.set_boolean("sync-in-progress", value);
  }

  get lastSyncError(): string {
    return this._settings.get_string("sync-last-error") || "";
  }

  set lastSyncError(value: string) {
    this._settings.set_string("sync-last-error", value || "");
  }

  get lastSyncSuccess(): string {
    return this._settings.get_string("sync-last-success") || "";
  }

  set lastSyncSuccess(value: string) {
    this._settings.set_string("sync-last-success", value || "");
  }

  get nativeHostPort(): number {
    return this._settings.get_int("native-host-port") || 21420;
  }

  set nativeHostPort(value: number) {
    this._settings.set_int("native-host-port", value);
  }

  isCustomServerConfigured(): boolean {
    const url = this.serverUrl;
    return url !== DEFAULT_SERVER_URL && url.length > 0;
  }

  shouldSync(): boolean {
    return this.syncEnabled;
  }

  async getPassword(): Promise<string | null> {
    if (IS_MACOS) {
      return _macosGetPassword();
    }
    if (!Secret || !passwordSchema) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const password = await Secret.password_lookup(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        null
      );
      return password as string | null;
    } catch (e) {
      logger.error(`Failed to retrieve password from keyring: ${e as string}`);
      return null;
    }
  }

  async setPassword(password: string): Promise<boolean> {
    if (IS_MACOS) {
      return _macosSetPassword(password);
    }
    if (!Secret || !passwordSchema) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const success = await Secret.password_store(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Secret.COLLECTION_DEFAULT,
        "Save Button Server Password",
        password,
        null
      );
      return success as boolean;
    } catch (e) {
      logger.error(`Failed to store password in keyring: ${e as string}`);
      return false;
    }
  }

  async clearPassword(): Promise<boolean> {
    if (IS_MACOS) {
      return _macosClearPassword();
    }
    if (!Secret || !passwordSchema) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const success = await Secret.password_clear(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        null
      );
      return success as boolean;
    } catch (e) {
      logger.error(`Failed to clear password from keyring: ${e as string}`);
      return false;
    }
  }

  connectChanged(callback: () => void): number {
    return this._settings.connect("changed", callback);
  }

  disconnectChanged(handlerId: number): void {
    this._settings.disconnect(handlerId);
  }
}
