import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { EverythingWindow } from "./views/everything_window.js";
import { NewSaveWindow } from "./views/new_save_window.js";
import { PreferencesWindow } from "./views/preferences.js";
import { NativeHostServer } from "./services/native_host/native_host_server.js";
import { SettingsService } from "./services/settings_service.js";
import { SyncManager } from "./services/sync_manager.js";

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
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
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
        version: "0.2.15",
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
