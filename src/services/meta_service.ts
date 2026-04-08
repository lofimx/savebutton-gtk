import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { MetaData } from "../models/meta.js";
import { logger } from "./logger.js";

const LOCAL_META_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".kaya",
  "meta",
]);

const FILENAME_REGEX = /filename\s*=\s*"([^"]+)"/;
const TAGS_REGEX = /tags\s*=\s*\[([^\]]*)\]/s;
const TAG_VALUE_REGEX = /"([^"]+)"/g;
const NOTE_REGEX = /note\s*=\s*'''([\s\S]*?)'''/;

export class MetaService {
  loadLatestMeta(angaFilename: string): MetaData | null {
    const metaFiles = this._listMetaFiles();

    // Walk newest-first (lexicographic descending = chronological descending)
    for (const metaFile of metaFiles) {
      const contents = this._readMetaFile(metaFile);
      const parsed = this._parseMeta(contents);

      if (parsed.angaFilename === angaFilename) {
        logger.log(
          `🔵 INFO MetaService found meta for "${angaFilename}" in "${metaFile}"`
        );
        return { tags: parsed.tags, note: parsed.note };
      }
    }

    logger.log(`🟢 DEBUG MetaService no meta found for "${angaFilename}"`);
    return null;
  }

  private _listMetaFiles(): string[] {
    const dir = Gio.File.new_for_path(LOCAL_META_DIR);
    if (!dir.query_exists(null)) {
      return [];
    }

    const files: string[] = [];
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      if (
        !name.startsWith(".") &&
        name.endsWith(".toml") &&
        fileInfo.get_file_type() === Gio.FileType.REGULAR
      ) {
        files.push(name);
      }
    }

    // Sort descending (newest first)
    files.sort((a, b) => b.localeCompare(a));
    return files;
  }

  private _readMetaFile(filename: string): string {
    try {
      const filePath = GLib.build_filenamev([LOCAL_META_DIR, filename]);
      const file = Gio.File.new_for_path(filePath);
      const [, contents] = file.load_contents(null);
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(contents);
    } catch (e) {
      logger.error(
        `🔴 ERROR MetaService failed to read ${filename}: ${e as string}`
      );
      return "";
    }
  }

  private _parseMeta(tomlContent: string): {
    angaFilename: string;
    tags: string[];
    note: string;
  } {
    const filenameMatch = tomlContent.match(FILENAME_REGEX);
    const angaFilename = filenameMatch ? filenameMatch[1] : "";

    const tags: string[] = [];
    const tagsMatch = tomlContent.match(TAGS_REGEX);
    if (tagsMatch) {
      let tagMatch: RegExpExecArray | null;
      const tagRegex = new RegExp(
        TAG_VALUE_REGEX.source,
        TAG_VALUE_REGEX.flags
      );
      while ((tagMatch = tagRegex.exec(tagsMatch[1])) !== null) {
        tags.push(tagMatch[1]);
      }
    }

    const noteMatch = tomlContent.match(NOTE_REGEX);
    const note = noteMatch ? noteMatch[1] : "";

    return { angaFilename, tags, note };
  }
}
