import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";
import { TagsList } from "../models/tags_list.js";
import { logger } from "../services/logger.js";

export class TagsEntry {
  private _tagsList: TagsList;
  private _container: Gtk.Box;
  private _entry: Gtk.Entry;

  constructor(container: Gtk.Box, entry: Gtk.Entry, initialTags?: string[]) {
    this._container = container;
    this._entry = entry;
    this._tagsList = new TagsList(initialTags);

    if (initialTags) {
      for (const tag of initialTags) {
        this._renderPill(tag);
      }
    }
  }

  get tags(): string[] {
    return this._tagsList.tags;
  }

  get tagsWithPending(): string[] {
    const pendingTag = this._entry.text.trim();
    return this._tagsList.withPending(pendingTag);
  }

  setup(): void {
    const keyController = new Gtk.EventControllerKey();
    keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
    keyController.connect(
      "key-pressed",
      (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_comma) {
          this.finalizeEntry();
          return true;
        }

        if (
          (keyval === Gdk.KEY_Tab || keyval === Gdk.KEY_ISO_Left_Tab) &&
          this._entry.text.trim().length > 0
        ) {
          this.finalizeEntry();
          return true;
        }

        if (
          keyval === Gdk.KEY_BackSpace &&
          this._entry.text.length === 0 &&
          this._tagsList.length > 0
        ) {
          this._removeLastTag();
          return true;
        }

        return false;
      }
    );
    this._entry.add_controller(keyController);
  }

  finalizeEntry(): void {
    const text = this._entry.text.trim();
    if (text.length > 0) {
      this._tagsList.add(text);
      this._renderPill(text);
      this._entry.set_text("");
    }
  }

  private _renderPill(tagText: string): void {
    const pill = new Gtk.Box({
      spacing: 4,
      valign: Gtk.Align.CENTER,
    });
    pill.add_css_class("tag-pill");

    const label = new Gtk.Label({ label: tagText });
    pill.append(label);

    this._container.insert_child_after(pill, this._getLastPill());
  }

  private _getLastPill(): Gtk.Widget | null {
    let lastPill: Gtk.Widget | null = null;
    let child = this._container.get_first_child();
    while (child !== null) {
      if (child === this._entry) break;
      lastPill = child;
      child = child.get_next_sibling();
    }
    return lastPill;
  }

  private _removeLastTag(): void {
    const removed = this._tagsList.removeLast();
    const lastPill = this._getLastPill();
    if (lastPill) {
      this._container.remove(lastPill);
    }
    logger.log(`🟢 DEBUG Tag removed: "${removed}"`);
  }
}
