import { NativeHostRequest } from "../src/models/native_host/native_host_request";

describe("NativeHostRequest", () => {
  describe("health", () => {
    it("should parse GET /health", () => {
      const req = new NativeHostRequest("GET", "/health");
      expect(req.type).toEqual({ kind: "health" });
    });

    it("should reject POST /health", () => {
      const req = new NativeHostRequest("POST", "/health");
      expect(req.type.kind).toBe("invalid");
    });
  });

  describe("preflight", () => {
    it("should parse OPTIONS on any path", () => {
      const req = new NativeHostRequest("OPTIONS", "/anga/somefile.url");
      expect(req.type).toEqual({ kind: "preflight" });
    });

    it("should parse OPTIONS on root", () => {
      const req = new NativeHostRequest("OPTIONS", "/");
      expect(req.type).toEqual({ kind: "preflight" });
    });
  });

  describe("config", () => {
    it("should parse POST /config", () => {
      const req = new NativeHostRequest("POST", "/config");
      expect(req.type).toEqual({ kind: "config" });
    });

    it("should reject GET /config", () => {
      const req = new NativeHostRequest("GET", "/config");
      expect(req.type.kind).toBe("invalid");
    });
  });

  describe("listing", () => {
    it("should parse GET /anga", () => {
      const req = new NativeHostRequest("GET", "/anga");
      expect(req.type).toEqual({ kind: "listing", collection: "anga" });
    });

    it("should parse GET /meta", () => {
      const req = new NativeHostRequest("GET", "/meta");
      expect(req.type).toEqual({ kind: "listing", collection: "meta" });
    });

    it("should parse GET /words", () => {
      const req = new NativeHostRequest("GET", "/words");
      expect(req.type).toEqual({ kind: "listing", collection: "words" });
    });

    it("should parse GET /words/{anga} as nested listing", () => {
      const req = new NativeHostRequest(
        "GET",
        "/words/2026-01-27T171207-www-deobald-ca"
      );
      expect(req.type).toEqual({
        kind: "listing",
        collection: "words/2026-01-27T171207-www-deobald-ca",
      });
    });

    it("should reject POST /anga (listing is GET-only)", () => {
      const req = new NativeHostRequest("POST", "/anga");
      expect(req.type.kind).toBe("invalid");
    });
  });

  describe("file_write", () => {
    it("should parse POST /anga/{filename}", () => {
      const req = new NativeHostRequest(
        "POST",
        "/anga/2026-01-27T171207-www-deobald-ca.url"
      );
      expect(req.type).toEqual({
        kind: "file_write",
        collection: "anga",
        filename: "2026-01-27T171207-www-deobald-ca.url",
      });
    });

    it("should parse POST /meta/{filename}", () => {
      const req = new NativeHostRequest(
        "POST",
        "/meta/2026-01-27T171207.toml"
      );
      expect(req.type).toEqual({
        kind: "file_write",
        collection: "meta",
        filename: "2026-01-27T171207.toml",
      });
    });

    it("should parse POST /words/{anga}/{filename}", () => {
      const req = new NativeHostRequest(
        "POST",
        "/words/2026-01-27T171207-www-deobald-ca/plaintext.txt"
      );
      expect(req.type).toEqual({
        kind: "file_write",
        collection: "words/2026-01-27T171207-www-deobald-ca",
        filename: "plaintext.txt",
      });
    });

    it("should URL-decode filenames", () => {
      const req = new NativeHostRequest(
        "POST",
        "/anga/2025-01-01T120000-India%20Income%20Tax.pdf"
      );
      expect(req.type).toEqual({
        kind: "file_write",
        collection: "anga",
        filename: "2025-01-01T120000-India Income Tax.pdf",
      });
    });

    it("should reject GET /anga/{filename} (write is POST-only)", () => {
      const req = new NativeHostRequest(
        "GET",
        "/anga/2026-01-27T171207-www-deobald-ca.url"
      );
      expect(req.type.kind).toBe("invalid");
    });
  });

  describe("validation", () => {
    it("should reject empty filenames", () => {
      const req = new NativeHostRequest("POST", "/anga/");
      expect(req.type.kind).toBe("invalid");
    });

    it("should reject filenames with directory traversal", () => {
      const req = new NativeHostRequest("POST", "/anga/..%2F..%2Fetc%2Fpasswd");
      expect(req.type.kind).toBe("invalid");
    });

    it("should reject filenames containing /", () => {
      const req = new NativeHostRequest("POST", "/anga/sub%2Ffile.txt");
      expect(req.type.kind).toBe("invalid");
    });

    it("should reject words directory names with ..", () => {
      const req = new NativeHostRequest("POST", "/words/../etc/passwd");
      expect(req.type.kind).toBe("invalid");
    });

    it("should reject unknown resources", () => {
      const req = new NativeHostRequest("GET", "/unknown");
      expect(req.type.kind).toBe("invalid");
    });

    it("should reject empty path", () => {
      const req = new NativeHostRequest("GET", "/");
      expect(req.type.kind).toBe("invalid");
    });
  });
});
