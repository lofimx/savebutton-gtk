import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SearchResult } from "../models/search_result.js";
import { SystemClock } from "../models/clock.js";
import { Meta } from "../models/meta.js";
import { MarkdownRenderer } from "../models/markdown_renderer.js";
import { FileService } from "../services/file_service.js";
import { MetaService } from "../services/meta_service.js";
import { SettingsService } from "../services/settings_service.js";
import { ShareService } from "../services/share_service.js";
import { logger } from "../services/logger.js";
import { TagsEntry } from "./tags_entry.js";

export class PreviewWindow extends Adw.Window {
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _windowTitle: Adw.WindowTitle;
  private declare _cancelButton: Gtk.Button;
  private declare _saveButton: Gtk.Button;
  private declare _sidebarToggle: Gtk.ToggleButton;
  private declare _splitView: Adw.OverlaySplitView;
  private declare _contentStack: Gtk.Stack;
  private declare _faviconImage: Gtk.Image;
  private declare _bookmarkUrl: Gtk.Label;
  private declare _bookmarkButton: Gtk.Button;
  private declare _noteLabel: Gtk.Label;
  private declare _imagePicture: Gtk.Picture;
  private declare _fileTypeIcon: Gtk.Image;
  private declare _fileTypeLabel: Gtk.Label;
  private declare _openExternallyButton: Gtk.Button;
  private declare _tagsContainer: Gtk.Box;
  private declare _tagsInput: Gtk.Entry;
  private declare _sidebarNoteText: Gtk.TextView;
  private declare _shareSectionLabel: Gtk.Label;
  private declare _shareButton: Gtk.Button;

  private _result: SearchResult;
  private _tagsEntry!: TagsEntry;
  private _fileService: FileService;
  private _settingsService: SettingsService;
  private _onSaveComplete: (() => void) | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///org/savebutton/SaveButton/preview_window.ui",
        InternalChildren: [
          "toastOverlay",
          "windowTitle",
          "cancelButton",
          "saveButton",
          "sidebarToggle",
          "splitView",
          "contentStack",
          "faviconImage",
          "bookmarkUrl",
          "bookmarkButton",
          "noteLabel",
          "imagePicture",
          "fileTypeIcon",
          "fileTypeLabel",
          "openExternallyButton",
          "tagsContainer",
          "tagsInput",
          "sidebarNoteText",
          "shareSectionLabel",
          "shareButton",
        ],
      },
      this
    );
  }

  constructor(
    params: Partial<Adw.Window.ConstructorProps>,
    result: SearchResult,
    onSaveComplete: () => void,
    settingsService: SettingsService
  ) {
    super(params);
    this._result = result;
    this._fileService = new FileService();
    this._settingsService = settingsService;
    this._onSaveComplete = onSaveComplete;

    this._windowTitle.set_title(result.displayTitle);

    this._loadMeta();
    this._setupContentArea();
    this._setupSidebarToggle();
    this._setupEscape();
    this._connectButtons();
    this._setupShare();

    logger.log(`🔵 INFO PreviewWindow initialized for "${result.filename}"`);
  }

  private _loadMeta(): void {
    const metaService = new MetaService();
    const metaData = metaService.loadLatestMeta(this._result.filename);

    const initialTags = metaData ? metaData.tags : [];
    this._tagsEntry = new TagsEntry(
      this._tagsContainer,
      this._tagsInput,
      initialTags
    );
    this._tagsEntry.setup();

    if (metaData && metaData.note.length > 0) {
      const buffer = this._sidebarNoteText.get_buffer();
      buffer.set_text(metaData.note, -1);
    }

    logger.log(
      `🔵 INFO PreviewWindow loaded meta for "${this._result.filename}": ${initialTags.length} tags`
    );
  }

  private _setupContentArea(): void {
    switch (this._result.type) {
      case "bookmark":
        this._setupBookmarkContent();
        break;
      case "note":
        this._setupNoteContent();
        break;
      case "file":
        this._setupFileContent();
        break;
    }
  }

  private _setupSidebarToggle(): void {
    this._sidebarToggle.connect("toggled", () => {
      this._splitView.set_show_sidebar(this._sidebarToggle.get_active());
    });
    this._splitView.connect("notify::show-sidebar", () => {
      this._sidebarToggle.set_active(this._splitView.get_show_sidebar());
    });
  }

  private _setupBookmarkContent(): void {
    this._contentStack.set_visible_child_name("bookmark");

    try {
      const contents = this._fileService.readAngaContents(
        this._result.filename
      );
      const url = this._extractUrlFromContents(contents);
      this._bookmarkUrl.set_label(url);

      this._bookmarkButton.connect("clicked", () => {
        this._launchUrl(url);
      });
    } catch (e: unknown) {
      logger.error(
        `🔴 ERROR PreviewWindow failed to read bookmark: ${e as string}`
      );
      this._bookmarkUrl.set_label("Could not read bookmark");
      this._bookmarkButton.set_sensitive(false);
    }

    // TODO: Show cached favicon when favicon caching is implemented
    logger.log(
      `🟢 DEBUG PreviewWindow showing bookmark preview for "${this._result.filename}"`
    );
  }

  private _setupNoteContent(): void {
    this._contentStack.set_visible_child_name("note");

    try {
      const contents = this._fileService.readAngaContents(
        this._result.filename
      );
      const pangoMarkup = MarkdownRenderer.toPangoMarkup(contents);
      this._noteLabel.set_markup(pangoMarkup);
    } catch (e: unknown) {
      logger.error(
        `🔴 ERROR PreviewWindow failed to read note: ${e as string}`
      );
      this._noteLabel.set_label("Could not read note");
    }
  }

  private _setupFileContent(): void {
    const ext = this._result.filename.split(".").pop()?.toLowerCase() || "";

    try {
      const contents = this._fileService.readAngaBytes(this._result.filename);
      const [contentType] = Gio.content_type_guess(
        this._result.filename,
        contents
      );
      const isImage = contentType !== null && contentType.startsWith("image/");

      if (isImage) {
        this._contentStack.set_visible_child_name("image");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const bytes = GLib.Bytes.new(contents);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const texture = Gdk.Texture.new_from_bytes(bytes);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this._imagePicture.set_paintable(texture);
      } else {
        this._setupGenericFileView(contentType);
      }
    } catch (e: unknown) {
      logger.error(
        `🔴 ERROR PreviewWindow failed to read file: ${e as string}`
      );
      this._contentStack.set_visible_child_name("file");
      this._fileTypeIcon.set_from_icon_name("text-x-generic-symbolic");
      this._fileTypeLabel.set_label(this._result.displayTitle);
      this._openExternallyButton.connect("clicked", () => {
        this._openFileExternally();
      });
    }

    // PDFs get the generic file view with a document icon
    if (ext === "pdf") {
      this._contentStack.set_visible_child_name("file");
      this._fileTypeIcon.set_from_icon_name("x-office-document-symbolic");
      this._fileTypeLabel.set_label(this._result.displayTitle);
      this._openExternallyButton.connect("clicked", () => {
        this._openFileExternally();
      });
    }
  }

  private _setupGenericFileView(contentType: string): void {
    this._contentStack.set_visible_child_name("file");
    const gicon = Gio.content_type_get_symbolic_icon(contentType);
    this._fileTypeIcon.set_from_gicon(gicon);
    this._fileTypeLabel.set_label(this._result.displayTitle);
    this._openExternallyButton.connect("clicked", () => {
      this._openFileExternally();
    });
  }

  private _connectButtons(): void {
    this._cancelButton.connect("clicked", () => this.close());
    this._saveButton.connect("clicked", () => this._onSave());
  }

  private _setupEscape(): void {
    this.connect("close-request", () => {
      this.destroy();
      return true;
    });

    const keyController = new Gtk.EventControllerKey();
    keyController.connect(
      "key-pressed",
      (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
          this.close();
          return true;
        }
        return false;
      }
    );
    this.add_controller(keyController);
  }

  private _onSave(): void {
    logger.log(
      `🔵 INFO PreviewWindow on_save fired for "${this._result.filename}"`
    );
    const clock = new SystemClock();

    const buffer = this._sidebarNoteText.get_buffer();
    const startIter = buffer.get_start_iter();
    const endIter = buffer.get_end_iter();
    const noteText = buffer.get_text(startIter, endIter, false).trim();

    const tags = this._tagsEntry.tagsWithPending;

    if (noteText.length > 0 || tags.length > 0) {
      try {
        const metaFile = new Meta(
          this._result.filename,
          noteText,
          tags,
          clock
        ).toMetaFile();
        this._fileService.saveMeta(metaFile);
        logger.log(
          `🔵 INFO PreviewWindow saved meta for "${this._result.filename}"`
        );
      } catch (e: unknown) {
        this._showFailure(e);
        return;
      }
    }

    this._onSaveComplete?.();
    this.close();
  }

  private _extractUrlFromContents(contents: string): string {
    const lines = contents.split("\n");
    for (const line of lines) {
      if (line.startsWith("URL=")) {
        return line.substring(4).trim();
      }
    }
    return "";
  }

  private _launchUrl(url: string): void {
    const launcher = new Gtk.UriLauncher({ uri: url });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const launchPromise = (
      launcher as unknown as {
        launch: (
          parent: Gtk.Window | null,
          cancellable: Gio.Cancellable | null
        ) => Promise<boolean>;
      }
    ).launch(this, null);
    launchPromise.catch((e: unknown) => {
      logger.error(
        `🔴 ERROR PreviewWindow failed to launch URL: ${e as string}`
      );
      this._showFailure(e);
    });
  }

  private _openFileExternally(): void {
    const filePath = GLib.build_filenamev([
      GLib.get_home_dir(),
      ".kaya",
      "anga",
      this._result.filename,
    ]);
    const launcher = new Gtk.FileLauncher({
      file: Gio.File.new_for_path(filePath),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const launchPromise = (
      launcher as unknown as {
        launch: (
          parent: Gtk.Window | null,
          cancellable: Gio.Cancellable | null
        ) => Promise<boolean>;
      }
    ).launch(this, null);
    launchPromise.catch((e: unknown) => {
      logger.error(
        `🔴 ERROR PreviewWindow failed to open file: ${e as string}`
      );
      this._showFailure(e);
    });
  }

  private _setupShare(): void {
    if (!this._settingsService.shouldSync()) {
      logger.log("🟢 DEBUG PreviewWindow share disabled: user not logged in");
      return;
    }

    this._shareButton.set_sensitive(true);
    this._shareSectionLabel.remove_css_class("dim-label");
    this._shareButton.connect("clicked", () => {
      this._onShare();
    });

    logger.log("🟢 DEBUG PreviewWindow share enabled");
  }

  private _onShare(): void {
    this._shareButton.set_sensitive(false);
    this._shareButton.set_label("Sharing…");

    logger.log(`🔵 INFO PreviewWindow sharing "${this._result.filename}"`);

    const shareService = new ShareService(this._settingsService);
    shareService
      .share(this._result.filename)
      .then((result) => {
        if (result.ok) {
          const display = Gdk.Display.get_default();
          if (display) {
            const clipboard = display.get_clipboard();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            clipboard.set(result.shareUrl);
          }

          const toast = new Adw.Toast({
            title: "URL copied to clipboard!",
            timeout: 3,
          });
          this._toastOverlay.add_toast(toast);

          logger.log(
            `🔵 INFO PreviewWindow share succeeded: ${result.shareUrl}`
          );
        } else {
          const serverUrl = this._settingsService.serverUrl;
          const toast = new Adw.Toast({
            title: `Failed to share to ${serverUrl}`,
            timeout: 5,
          });
          this._toastOverlay.add_toast(toast);

          logger.log(
            `🟠 WARN PreviewWindow share failed for "${this._result.filename}"`
          );
        }
      })
      .catch((e: unknown) => {
        logger.error(`🔴 ERROR PreviewWindow share error: ${e as string}`);
        const serverUrl = this._settingsService.serverUrl;
        const toast = new Adw.Toast({
          title: `Failed to share to ${serverUrl}`,
          timeout: 5,
        });
        this._toastOverlay.add_toast(toast);
      })
      .finally(() => {
        this._shareButton.set_sensitive(true);
        this._shareButton.set_label("Share");
      });
  }

  private _showFailure(e: unknown): void {
    logger.error(`🔴 ERROR PreviewWindow: ${e as string}`);
    const toast = new Adw.Toast({
      title: `Error: ${e as string}`,
      timeout: 5,
    });
    this._toastOverlay.add_toast(toast);
  }
}
