import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SearchService } from "../services/search_service.js";
import { FileService } from "../services/file_service.js";
import { SettingsService } from "../services/settings_service.js";
import { SearchResult } from "../models/search_result.js";
import { TileWidget } from "../models/tile_widget.js";
import { PreviewWindow } from "./preview_window.js";
import { logger } from "../services/logger.js";

const SEARCH_DEBOUNCE_MS = 300;

export class EverythingWindow extends Adw.ApplicationWindow {
  private declare _searchService: SearchService;
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _searchEntry: Gtk.SearchEntry;
  private declare _resultsStack: Gtk.Stack;
  private declare _searchResultsFlowBox: Gtk.FlowBox;
  private declare _syncSpinner: Gtk.Spinner;

  private _searchTimeoutId: number | null = null;
  private _currentResults: SearchResult[] = [];
  private _fileService: FileService;
  private _settingsService: SettingsService;

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/savebutton/SaveButton/everything_window.ui",
        InternalChildren: [
          "toastOverlay",
          "searchEntry",
          "resultsStack",
          "searchResultsFlowBox",
          "syncSpinner",
        ],
      },
      this
    );

    Gtk.Widget.add_shortcut(
      new Gtk.Shortcut({
        action: new Gtk.NamedAction({ action_name: "window.close" }),
        trigger: Gtk.ShortcutTrigger.parse_string("<Control>w"),
      })
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
    super(params);
    this.icon_name = "org.savebutton.SaveButton";
    this._searchService = new SearchService();
    this._fileService = new FileService();
    this._settingsService = new SettingsService();
    this._setupSearch();
    this._setupKeyboardFocus();
    this._setupSyncSpinner();
    this._performSearch();
    logger.log("🔵 INFO EverythingWindow initialized");
  }

  refreshSearch(): void {
    this._searchService.invalidateCache();
    this._performSearch();
    logger.log("🔵 INFO Search refreshed");
  }

  focusSearch(): void {
    this._searchEntry.grab_focus();
  }

  private _setupSearch(): void {
    this._searchEntry.connect("search-changed", () => {
      if (this._searchTimeoutId !== null) {
        GLib.source_remove(this._searchTimeoutId);
        this._searchTimeoutId = null;
      }
      this._searchTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        SEARCH_DEBOUNCE_MS,
        () => {
          this._performSearch();
          this._searchTimeoutId = null;
          return GLib.SOURCE_REMOVE;
        }
      );
    });
  }

  private _setupSyncSpinner(): void {
    this._settingsService.connectChanged(() => {
      const syncing = this._settingsService.syncInProgress;
      this._syncSpinner.visible = syncing;
      this._syncSpinner.spinning = syncing;
    });
  }

  private _setupKeyboardFocus(): void {
    const keyController = new Gtk.EventControllerKey();
    keyController.connect(
      "key-pressed",
      (
        _controller: Gtk.EventControllerKey,
        keyval: number,
        _keycode: number,
        state: number
      ) => {
        // Ignore if modifier keys are held (except Shift for uppercase)
        const modifiers =
          state &
          (Gtk.accelerator_get_default_mod_mask() &
            ~Gdk.ModifierType.SHIFT_MASK);
        if (modifiers !== 0) return false;

        // Only forward printable characters
        const unichar = Gdk.keyval_to_unicode(keyval);
        if (unichar === 0) return false;

        // If search entry doesn't have focus, grab it
        if (!this._searchEntry.has_focus) {
          this._searchEntry.grab_focus();
        }
        return false;
      }
    );
    this.add_controller(keyController);
  }

  private _performSearch(): void {
    const query = this._searchEntry.text.trim();
    const results = this._searchService.search(query);

    if (results.length === 0 && !query) {
      this._resultsStack.set_visible_child_name("empty");
      return;
    }

    if (results.length === 0) {
      this._resultsStack.set_visible_child_name("no-results");
      return;
    }

    this._populateResults(results);
    this._resultsStack.set_visible_child_name("results");
  }

  private _populateResults(results: SearchResult[]): void {
    this._currentResults = results;

    let child = this._searchResultsFlowBox.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this._searchResultsFlowBox.remove(child);
      child = next;
    }

    for (const result of results) {
      const card = this._createResultCard(result);
      this._searchResultsFlowBox.append(card);
    }
  }

  private _createResultCard(result: SearchResult): Gtk.Widget {
    const tile = new TileWidget(result);

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    });
    box.add_css_class("card");
    box.add_css_class("search-result-card");
    box.cursor = Gdk.Cursor.new_from_name("pointer", null);

    const clickGesture = new Gtk.GestureClick();
    clickGesture.connect("released", () => {
      this._openPreview(result);
    });
    box.add_controller(clickGesture);

    if (tile.showImage) {
      this._appendImageThumbnail(box, result);
    } else if (!tile.overlayIcon) {
      // File type: inline centered icon
      const icon = new Gtk.Image({
        icon_name: tile.iconName,
        pixel_size: 32,
      });
      icon.add_css_class("dim-label");
      box.append(icon);
    }

    if (result.contentPreview) {
      const preview = new Gtk.Label({
        label: result.contentPreview,
        wrap: true,
        wrap_mode: 2, // WORD_CHAR
        lines: 2,
        ellipsize: 3, // END
        xalign: 0,
      });
      box.append(preview);
    }

    if (tile.showTitle) {
      const title = new Gtk.Label({
        label: result.displayTitle,
        ellipsize: 3, // END
        xalign: 0,
      });
      title.add_css_class("heading");
      box.append(title);
    }

    const date = new Gtk.Label({
      label: result.date,
      xalign: 0,
    });
    date.add_css_class("dim-label");
    date.add_css_class("caption");
    date.add_css_class("tile-date");
    box.append(date);

    // For notes/bookmarks, overlay the type icon in the upper-right
    if (tile.overlayIcon) {
      const overlay = new Gtk.Overlay({ child: box });
      const icon = new Gtk.Image({
        icon_name: tile.iconName,
        pixel_size: 16,
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        margin_top: 4,
        margin_end: 4,
      });
      icon.add_css_class("dim-label");
      overlay.add_overlay(icon);
      return overlay;
    }

    return box;
  }

  private _appendImageThumbnail(box: Gtk.Box, result: SearchResult): void {
    try {
      const contents = this._fileService.readAngaBytes(result.filename);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const bytes = GLib.Bytes.new(contents);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const texture = Gdk.Texture.new_from_bytes(bytes);
      const picture = new Gtk.Picture({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        paintable: texture,
        can_shrink: true,
        content_fit: Gtk.ContentFit.COVER,
        height_request: 80,
      });
      picture.add_css_class("tile-image");
      box.append(picture);
    } catch (e: unknown) {
      const msg = String(e);
      logger.error(
        `🔴 ERROR Failed to load thumbnail for "${result.filename}": ${msg}`
      );
      const icon = new Gtk.Image({
        icon_name: "text-x-generic-symbolic",
        pixel_size: 32,
      });
      icon.add_css_class("dim-label");
      box.append(icon);
    }
  }

  private _openPreview(result: SearchResult): void {
    const previewWindow = new PreviewWindow(
      {
        transient_for: this,
        modal: true,
      },
      result,
      () => {
        this.refreshSearch();
      },
      this._settingsService
    );
    previewWindow.present();
    logger.log(`🔵 INFO Opening preview for "${result.filename}"`);
  }
}
