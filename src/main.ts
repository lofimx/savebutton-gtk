import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { EverythingWindow } from "./views/everything_window.js";
import { NewSaveWindow } from "./views/new_save_window.js";
import { PreferencesWindow } from "./views/preferences.js";
import { NativeHostServer } from "./services/native_host/native_host_server.js";
import { AuthService } from "./services/auth_service.js";
import { SettingsService } from "./services/settings_service.js";
import { SyncManager } from "./services/sync_manager.js";
import { logger } from "./services/logger.js";

export class Application extends Adw.Application {
  #window?: EverythingWindow;
  #syncManager?: SyncManager;
  #nativeHostServer?: NativeHostServer;

  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      application_id: "org.savebutton.SaveButton",
      flags:
        Gio.ApplicationFlags.DEFAULT_FLAGS |
        Gio.ApplicationFlags.HANDLES_OPEN |
        Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
    });

    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => {
      this.#nativeHostServer?.stop();
      this.#syncManager?.stop();
      this.quit();
    });

    this.add_action(quit_action);
    this.set_accels_for_action("app.quit", ["<Control>q"]);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      const aboutDialog = new Adw.AboutDialog({
        application_name: _("Save Button"),
        application_icon: "org.savebutton.SaveButton",
        developer_name: "Steven Deobald",
        version: "0.2.25",
        developers: ["Steven Deobald <sdeobald@gnome.org>"],
        copyright: "© 2026 Steven Deobald",
      });

      aboutDialog.present(this.active_window);
    });

    this.add_action(show_about_action);

    const show_preferences_action = new Gio.SimpleAction({
      name: "preferences",
    });
    show_preferences_action.connect("activate", () => {
      const preferencesWindow = new PreferencesWindow({
        transient_for: this.active_window,
        modal: true,
      });
      preferencesWindow.present();
    });

    this.add_action(show_preferences_action);
    this.set_accels_for_action("app.preferences", ["<Control>comma"]);

    const new_save_action = new Gio.SimpleAction({ name: "new-save" });
    new_save_action.connect("activate", () => {
      const newSaveWindow = new NewSaveWindow(
        {
          transient_for: this.active_window ?? undefined,
          modal: !!this.active_window,
        },
        () => {
          this.#window?.refreshSearch();
          this.#syncManager?.sync();
        }
      );
      newSaveWindow.present();
    });

    this.add_action(new_save_action);
    this.set_accels_for_action("app.new-save", ["<Control>n"]);

    const focus_search_action = new Gio.SimpleAction({ name: "focus-search" });
    focus_search_action.connect("activate", () => {
      // The EverythingWindow handles this via its key controller,
      // but Ctrl+F provides an explicit shortcut
      if (this.#window) {
        this.#window.focusSearch();
      }
    });

    this.add_action(focus_search_action);
    this.set_accels_for_action("app.focus-search", ["<Control>f"]);

    Gio._promisify(Gio.File.prototype, "read_async", "read_finish");
    Gio._promisify(Gtk.FileLauncher.prototype, "launch", "launch_finish");
    Gio._promisify(Gtk.UriLauncher.prototype, "launch", "launch_finish");
  }

  vfunc_startup(): void {
    super.vfunc_startup();

    const display = Gdk.Display.get_default();
    if (display) {
      const iconTheme = Gtk.IconTheme.get_for_display(display);
      iconTheme.add_resource_path("/org/savebutton/SaveButton/icons");
    }

    new SettingsService().warnIfLegacyBasicAuth().catch((e) => {
      logger.error(`Legacy Basic Auth check failed: ${e as string}`);
    });
  }

  vfunc_activate(): void {
    if (!this.#window) {
      this.#createWindow();
      this.#startSyncManager();
      this.#startNativeHostServer();
      return;
    }
    this.#window.present();
  }

  // Handle URIs passed via GApplication open (e.g. D-Bus activation)
  vfunc_open(files: Gio.File[], _hint: string): void {
    logger.log(`INFO Application vfunc_open called with ${files.length} file(s)`);
    this.vfunc_activate();

    for (const file of files) {
      const uri = file.get_uri();
      if (!uri) continue;

      logger.log(`INFO Application vfunc_open received URI: ${uri}`);
      this.#processUri(uri);
    }
  }

  // Handle URIs passed as command-line arguments (e.g. xdg-open savebutton://...)
  vfunc_command_line(commandLine: Gio.ApplicationCommandLine): number {
    const argv = commandLine.get_arguments();
    logger.log(
      `INFO Application vfunc_command_line called with args: ${JSON.stringify(argv)}`
    );

    this.vfunc_activate();

    let handled = false;
    for (const arg of argv) {
      if (arg.startsWith("savebutton://")) {
        logger.log(`INFO Application command-line URI: ${arg}`);
        this.#processUri(arg);
        handled = true;
      }
    }

    if (!handled) {
      logger.log("DEBUG Application command-line: no savebutton:// URIs found");
    }

    return 0;
  }

  #processUri(uri: string): void {
    if (uri.startsWith("savebutton://auth/callback")) {
      this.#handleAuthCallback(uri);
    } else {
      logger.log(`WARN Application ignoring unrecognized URI: ${uri}`);
    }
  }

  #handleAuthCallback(uri: string): void {
    logger.log(`INFO Application handling auth callback: ${uri}`);

    const code = this.#getQueryParam(uri, "code");

    if (!code) {
      logger.error("Application auth callback missing 'code' parameter");
      return;
    }

    logger.log(
      `INFO Application exchanging authorization code (${code.substring(0, 8)}...)`
    );

    const settingsService = new SettingsService();
    const authService = new AuthService(settingsService);

    logger.log(
      `DEBUG Application PKCE verifier present: ${settingsService.authPkceVerifier.length > 0}`
    );

    authService
      .exchangeAuthorizationCode(code)
      .then((success) => {
        if (success) {
          logger.log(
            `INFO Application OAuth login successful, email: ${settingsService.authEmail}`
          );
          this.#syncManager?.sync();
        } else {
          logger.error("Application OAuth code exchange failed");
        }
      })
      .catch((e) => {
        logger.error(`Application OAuth code exchange error: ${e as string}`);
      });
  }

  #getQueryParam(uri: string, key: string): string | null {
    const queryStart = uri.indexOf("?");
    if (queryStart === -1) return null;

    const query = uri.substring(queryStart + 1);
    for (const part of query.split("&")) {
      const [k, v] = part.split("=");
      if (decodeURIComponent(k) === key) {
        return v ? decodeURIComponent(v) : "";
      }
    }
    return null;
  }

  #createWindow() {
    this.#window = new EverythingWindow({ application: this });
    this.#window.present();
  }

  #startSyncManager() {
    if (!this.#syncManager) {
      this.#syncManager = new SyncManager();
      this.#syncManager.start();
    }
  }

  #startNativeHostServer() {
    if (!this.#nativeHostServer) {
      const settingsService = new SettingsService();
      this.#nativeHostServer = new NativeHostServer(settingsService);
      this.#nativeHostServer.onFileReceived = () => {
        this.#window?.refreshSearch();
      };
      this.#nativeHostServer.start();
    }
  }
}

export function main(argv: string[]): Promise<number> {
  const app = new Application();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return app.runAsync(argv);
}
