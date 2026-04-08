import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { AngaFile } from "../models/anga.js";
import { DroppedFile } from "../models/dropped.js";
import { MetaFile } from "../models/meta.js";
import { logger } from "./logger.js";

export class FileService {
  ensureKayaDirectories() {
    const homeDir = GLib.get_home_dir();
    const kayaDir = GLib.build_filenamev([homeDir, ".kaya"]);
    const angaDir = GLib.build_filenamev([homeDir, ".kaya", "anga"]);
    const metaDir = GLib.build_filenamev([homeDir, ".kaya", "meta"]);

    // Create ~/.kaya if it doesn't exist
    const kayaDirFile = Gio.File.new_for_path(kayaDir);
    if (!kayaDirFile.query_exists(null)) {
      try {
        kayaDirFile.make_directory(null);
      } catch (e) {
        logger.error("Failed to create ~/.kaya directory:");
      }
    }

    // Create ~/.kaya/anga if it doesn't exist
    const angaDirFile = Gio.File.new_for_path(angaDir);
    if (!angaDirFile.query_exists(null)) {
      try {
        angaDirFile.make_directory(null);
      } catch (e) {
        logger.error("Failed to create ~/.kaya/anga directory:");
      }
    }

    // Create ~/.kaya/meta if it doesn't exist
    const metaDirFile = Gio.File.new_for_path(metaDir);
    if (!metaDirFile.query_exists(null)) {
      try {
        metaDirFile.make_directory(null);
      } catch (e) {
        logger.error("Failed to create ~/.kaya/meta directory:");
      }
    }
  }

  save(angaFile: AngaFile) {
    const filePath = this.getSafeFilepath(angaFile);
    const file = Gio.File.new_for_path(filePath);
    // was [, etag]:
    const [,] = file.replace_contents(
      angaFile.contents,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
    logger.log(`Saved bookmark to ${filePath}`);
  }

  saveDroppedFile(droppedFile: DroppedFile) {
    const filePath = this.getSafeFilepathForDropped(droppedFile);
    const file = Gio.File.new_for_path(filePath);
    const [,] = file.replace_contents(
      droppedFile.contents,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
    logger.log(`Saved dropped file to ${filePath}`);
  }

  getSafeFilepath(angaFile: AngaFile) {
    const homeDir = GLib.get_home_dir();
    const filePath = GLib.build_filenamev([
      homeDir,
      ".kaya",
      "anga",
      angaFile.filename,
    ]);
    const basic = Gio.File.new_for_path(filePath);
    if (basic.query_exists(null)) {
      return GLib.build_filenamev([
        homeDir,
        ".kaya",
        "anga",
        angaFile.filenameWithNanos,
      ]);
    }
    return filePath;
  }

  getSafeFilepathForDropped(droppedFile: DroppedFile) {
    const homeDir = GLib.get_home_dir();
    const filePath = GLib.build_filenamev([
      homeDir,
      ".kaya",
      "anga",
      droppedFile.filename,
    ]);
    const basic = Gio.File.new_for_path(filePath);
    if (basic.query_exists(null)) {
      return GLib.build_filenamev([
        homeDir,
        ".kaya",
        "anga",
        droppedFile.filenameWithNanos,
      ]);
    }
    return filePath;
  }

  saveMeta(metaFile: MetaFile) {
    const filePath = this.getSafeFilepathForMeta(metaFile);
    const file = Gio.File.new_for_path(filePath);
    const encoder = new TextEncoder();
    const [,] = file.replace_contents(
      encoder.encode(metaFile.contents),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
    logger.log(`Saved metadata to ${filePath}`);
  }

  readAngaContents(filename: string): string {
    const filePath = GLib.build_filenamev([
      GLib.get_home_dir(),
      ".kaya",
      "anga",
      filename,
    ]);
    const file = Gio.File.new_for_path(filePath);
    const [, contents] = file.load_contents(null);
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(contents);
  }

  readAngaBytes(filename: string): Uint8Array {
    const filePath = GLib.build_filenamev([
      GLib.get_home_dir(),
      ".kaya",
      "anga",
      filename,
    ]);
    const file = Gio.File.new_for_path(filePath);
    const [, contents] = file.load_contents(null);
    return contents;
  }

  getSafeFilepathForMeta(metaFile: MetaFile) {
    const homeDir = GLib.get_home_dir();
    const filePath = GLib.build_filenamev([
      homeDir,
      ".kaya",
      "meta",
      metaFile.filename,
    ]);
    const basic = Gio.File.new_for_path(filePath);
    if (basic.query_exists(null)) {
      return GLib.build_filenamev([
        homeDir,
        ".kaya",
        "meta",
        metaFile.filenameWithNanos,
      ]);
    }
    return filePath;
  }
}
