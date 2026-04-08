import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {
  SearchResult,
  SearchResultFactory,
  matchesQuery,
} from "../models/search_result.js";
import { logger } from "./logger.js";

const LOCAL_ANGA_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".kaya",
  "anga",
]);

const TEXT_EXTENSIONS = new Set(["md", "url", "txt", "toml", "json", "html"]);

export class SearchService {
  private _cache: SearchResult[] | null = null;

  loadAllFiles(): SearchResult[] {
    if (this._cache !== null) {
      return this._cache;
    }

    const filenames = this._listAngaFiles();
    const results: SearchResult[] = [];

    for (const filename of filenames) {
      const contents = this._readFileContents(filename);
      results.push(SearchResultFactory.fromFile(filename, contents));
    }

    // Sort newest first by raw timestamp
    results.sort((a, b) => b.rawTimestamp.localeCompare(a.rawTimestamp));

    this._cache = results;
    logger.log(`🔵 INFO SearchService loaded ${results.length} anga files`);
    return results;
  }

  search(query: string): SearchResult[] {
    const allFiles = this.loadAllFiles();
    if (!query.trim()) {
      return allFiles;
    }
    return allFiles.filter((result) => matchesQuery(result, query));
  }

  invalidateCache(): void {
    this._cache = null;
    logger.log("🟢 DEBUG SearchService cache invalidated");
  }

  private _listAngaFiles(): string[] {
    const dir = Gio.File.new_for_path(LOCAL_ANGA_DIR);
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
        fileInfo.get_file_type() === Gio.FileType.REGULAR
      ) {
        files.push(name);
      }
    }

    return files;
  }

  private _readFileContents(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!TEXT_EXTENSIONS.has(ext)) {
      return "";
    }

    try {
      const filePath = GLib.build_filenamev([LOCAL_ANGA_DIR, filename]);
      const file = Gio.File.new_for_path(filePath);
      const [, contents] = file.load_contents(null);
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(contents);
    } catch (e) {
      logger.error(
        `🔴 ERROR SearchService failed to read ${filename}: ${e as string}`
      );
      return "";
    }
  }
}
