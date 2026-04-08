export type NativeHostRequestType =
  | { kind: "health" }
  | { kind: "listing"; collection: string }
  | {
      kind: "file_write";
      collection: string;
      filename: string;
    }
  | { kind: "config" }
  | { kind: "preflight" }
  | { kind: "invalid"; reason: string };

export class NativeHostRequest {
  readonly type: NativeHostRequestType;

  constructor(method: string, path: string) {
    this.type = NativeHostRequest._parse(method, path);
  }

  static _parse(method: string, path: string): NativeHostRequestType {
    if (method === "OPTIONS") {
      return { kind: "preflight" };
    }

    const segments = path
      .replace(/^\/+/, "")
      .split("/")
      .filter((s) => s.length > 0);

    if (segments.length === 0) {
      return { kind: "invalid", reason: "Empty path" };
    }

    const resource = segments[0];

    if (method === "GET" && resource === "health" && segments.length === 1) {
      return { kind: "health" };
    }

    if (method === "POST" && resource === "config" && segments.length === 1) {
      return { kind: "config" };
    }

    const COLLECTIONS = ["anga", "meta", "words"];
    if (!COLLECTIONS.includes(resource)) {
      return { kind: "invalid", reason: `Unknown resource: ${resource}` };
    }

    if (resource === "words") {
      return NativeHostRequest._parseWords(method, segments);
    }

    // anga or meta
    if (segments.length === 1 && method === "GET") {
      return { kind: "listing", collection: resource };
    }

    if (segments.length === 2 && method === "POST") {
      const filename = NativeHostRequest._decodeAndValidateFilename(
        segments[1]
      );
      if (typeof filename !== "string") {
        return filename;
      }
      return { kind: "file_write", collection: resource, filename };
    }

    return { kind: "invalid", reason: `Invalid ${method} on /${resource}` };
  }

  static _parseWords(
    method: string,
    segments: string[]
  ): NativeHostRequestType {
    // GET /words — list anga subdirectories
    if (segments.length === 1 && method === "GET") {
      return { kind: "listing", collection: "words" };
    }

    // GET /words/{anga} — list files in that anga subdirectory
    if (segments.length === 2 && method === "GET") {
      const anga = NativeHostRequest._decodeAndValidateDirectoryName(
        segments[1]
      );
      if (typeof anga !== "string") {
        return anga;
      }
      return { kind: "listing", collection: `words/${anga}` };
    }

    // POST /words/{anga}/{filename} — write a words file
    if (segments.length === 3 && method === "POST") {
      const anga = NativeHostRequest._decodeAndValidateDirectoryName(
        segments[1]
      );
      if (typeof anga !== "string") {
        return anga;
      }
      const filename = NativeHostRequest._decodeAndValidateFilename(
        segments[2]
      );
      if (typeof filename !== "string") {
        return filename;
      }
      return {
        kind: "file_write",
        collection: `words/${anga}`,
        filename,
      };
    }

    return { kind: "invalid", reason: `Invalid ${method} on /words` };
  }

  static _decodeAndValidateFilename(
    raw: string
  ): string | NativeHostRequestType {
    const decoded = decodeURIComponent(raw);

    if (decoded.length === 0) {
      return { kind: "invalid", reason: "Empty filename" };
    }
    if (decoded.includes("/")) {
      return { kind: "invalid", reason: "Filename contains /" };
    }
    if (decoded.includes("..")) {
      return { kind: "invalid", reason: "Filename contains .." };
    }

    return decoded;
  }

  static _decodeAndValidateDirectoryName(
    raw: string
  ): string | NativeHostRequestType {
    const decoded = decodeURIComponent(raw);

    if (decoded.length === 0) {
      return { kind: "invalid", reason: "Empty directory name" };
    }
    if (decoded.includes("..")) {
      return { kind: "invalid", reason: "Directory name contains .." };
    }

    return decoded;
  }
}
