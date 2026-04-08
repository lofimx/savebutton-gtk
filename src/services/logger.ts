import Gio from "gi://Gio";
import GLib from "gi://GLib";

class Logger {
  private _stream: Gio.FileOutputStream;

  constructor() {
    const kayaDir = GLib.build_filenamev([GLib.get_home_dir(), ".kaya"]);
    GLib.mkdir_with_parents(kayaDir, 0o755);

    const logPath = GLib.build_filenamev([kayaDir, "desktop-app-log"]);
    const logFile = Gio.File.new_for_path(logPath);
    this._stream = logFile.append_to(Gio.FileCreateFlags.NONE, null);
  }

  log(message: string): void {
    this._writeToFile(message);
    console.log(message);
  }

  error(message: string): void {
    this._writeToFile(message);
    console.error(message);
  }

  private _writeToFile(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} ${message}\n`;
    const bytes = new TextEncoder().encode(line);
    this._stream.write(bytes, null);
  }
}

export const logger = new Logger();
