import {
  SearchResultFactory,
  matchesQuery,
} from "../src/models/search_result";

describe("SearchResultFactory", () => {
  describe("determineType", () => {
    it("identifies .url files as bookmarks", () => {
      expect(
        SearchResultFactory.determineType("2025-06-28T120000-bookmark.url")
      ).toBe("bookmark");
    });

    it("identifies .md files as notes", () => {
      expect(
        SearchResultFactory.determineType("2025-06-28T120000-note.md")
      ).toBe("note");
    });

    it("identifies other extensions as files", () => {
      expect(
        SearchResultFactory.determineType("2025-06-28T120000-photo.png")
      ).toBe("file");
    });
  });

  describe("extractDisplayTitle", () => {
    it("strips timestamp and extension, replaces hyphens with spaces for notes", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2025-06-28T120000-my-important-note.md",
          "note"
        )
      ).toBe("my important note");
    });

    it("handles nanosecond timestamps for notes", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2026-01-21T164145_354000000-note.md",
          "note"
        )
      ).toBe("note");
    });

    it("keeps hyphens and extension verbatim for files", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2025-06-28T120000-my-file.tar.gz",
          "file"
        )
      ).toBe("my-file.tar.gz");
    });

    it("keeps extension for file type", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2025-06-28T120000-photo.png",
          "file"
        )
      ).toBe("photo.png");
    });

    it("strips extension and hyphens for bookmarks", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2025-06-28T120000-my-bookmark.url",
          "bookmark"
        )
      ).toBe("my bookmark");
    });

    it("defaults to note/bookmark behavior when type is omitted", () => {
      expect(
        SearchResultFactory.extractDisplayTitle(
          "2025-06-28T120000-my-important-note.md"
        )
      ).toBe("my important note");
    });
  });

  describe("isTitleVisible", () => {
    it("returns false for bookmarks", () => {
      expect(SearchResultFactory.isTitleVisible("bookmark")).toBe(false);
    });

    it("returns false for notes", () => {
      expect(SearchResultFactory.isTitleVisible("note")).toBe(false);
    });

    it("returns true for files", () => {
      expect(SearchResultFactory.isTitleVisible("file")).toBe(true);
    });
  });

  describe("extractDate", () => {
    it("extracts date from filename timestamp", () => {
      expect(
        SearchResultFactory.extractDate("2025-06-28T120000-note.md")
      ).toBe("2025-06-28");
    });

    it("extracts date from nanosecond timestamp", () => {
      expect(
        SearchResultFactory.extractDate(
          "2026-01-21T164145_354000000-note.md"
        )
      ).toBe("2026-01-21");
    });
  });

  describe("fromFile", () => {
    it("creates a bookmark SearchResult with domain preview", () => {
      const result = SearchResultFactory.fromFile(
        "2025-06-28T120000-bookmark.url",
        "[InternetShortcut]\nURL=https://example.com/path\n"
      );
      expect(result.type).toBe("bookmark");
      expect(result.contentPreview).toBe("example.com");
      expect(result.displayTitle).toBe("bookmark");
      expect(result.date).toBe("2025-06-28");
    });

    it("creates a note SearchResult with text preview", () => {
      const result = SearchResultFactory.fromFile(
        "2025-06-28T120000-note.md",
        "Hello world, this is my note"
      );
      expect(result.type).toBe("note");
      expect(result.contentPreview).toBe("Hello world, this is my note");
      expect(result.displayTitle).toBe("note");
    });

    it("truncates long note previews", () => {
      const longText = "a".repeat(150);
      const result = SearchResultFactory.fromFile(
        "2025-06-28T120000-note.md",
        longText
      );
      expect(result.contentPreview).toBe("a".repeat(100) + "...");
    });

    it("creates a file SearchResult with empty preview", () => {
      const result = SearchResultFactory.fromFile(
        "2025-06-28T120000-photo.png",
        ""
      );
      expect(result.type).toBe("file");
      expect(result.contentPreview).toBe("");
    });
  });
});

describe("matchesQuery", () => {
  const result = SearchResultFactory.fromFile(
    "2025-06-28T120000-bookmark.url",
    "[InternetShortcut]\nURL=https://example.com\n"
  );

  it("matches on filename", () => {
    expect(matchesQuery(result, "bookmark")).toBe(true);
  });

  it("matches on display title", () => {
    expect(matchesQuery(result, "bookmark")).toBe(true);
  });

  it("matches on content preview", () => {
    expect(matchesQuery(result, "example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery(result, "EXAMPLE")).toBe(true);
  });

  it("returns false for non-matching query", () => {
    expect(matchesQuery(result, "zzzzz")).toBe(false);
  });
});
