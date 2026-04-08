import Gio from "gi://Gio";
import GLib from "gi://GLib";

const KAYA_DIR = GLib.build_filenamev([GLib.get_home_dir(), ".kaya"]);

export class LocalRepo {
  listFiles(subdir: string): string[] {
    const dirPath = GLib.build_filenamev([KAYA_DIR, subdir]);
    return this._list(dirPath, Gio.FileType.REGULAR);
  }

  listDirectories(subdir: string): string[] {
    const dirPath = GLib.build_filenamev([KAYA_DIR, subdir]);
    return this._list(dirPath, Gio.FileType.DIRECTORY);
  }

  readFile(subdir: string, filename: string): Uint8Array {
    const filePath = GLib.build_filenamev([KAYA_DIR, subdir, filename]);
    const file = Gio.File.new_for_path(filePath);
    const [, contents] = file.load_contents(null);
    return contents;
  }

  writeFile(subdir: string, filename: string, data: Uint8Array): void {
    const filePath = GLib.build_filenamev([KAYA_DIR, subdir, filename]);
    const file = Gio.File.new_for_path(filePath);
    file.replace_contents(
      data,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  ensureDir(subdir: string): void {
    const dirPath = GLib.build_filenamev([KAYA_DIR, subdir]);
    const dir = Gio.File.new_for_path(dirPath);
    if (!dir.query_exists(null)) {
      dir.make_directory_with_parents(null);
    }
  }

  private _list(dirPath: string, fileType: Gio.FileType): string[] {
    const dir = Gio.File.new_for_path(dirPath);
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
      if (!name.startsWith(".") && fileInfo.get_file_type() === fileType) {
        files.push(name);
      }
    }

    return files;
  }
}
