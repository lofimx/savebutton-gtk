export type AngaType = "bookmark" | "note" | "file";

export interface SearchResult {
  filename: string;
  type: AngaType;
  displayTitle: string;
  contentPreview: string;
  date: string;
  rawTimestamp: string;
}

const TIMESTAMP_PREFIX_REGEX = /^\d{4}-\d{2}-\d{2}T\d{6}(?:_\d{9})?-/;
const TIMESTAMP_EXTRACT_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{6})/;

export class SearchResultFactory {
  static fromFile(filename: string, contents: string): SearchResult {
    const type = SearchResultFactory.determineType(filename);
    return {
      filename,
      type,
      displayTitle: SearchResultFactory.extractDisplayTitle(filename, type),
      contentPreview: SearchResultFactory.extractContentPreview(type, contents),
      date: SearchResultFactory.extractDate(filename),
      rawTimestamp: SearchResultFactory.extractRawTimestamp(filename),
    };
  }

  static determineType(filename: string): AngaType {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (ext === "url") return "bookmark";
    if (ext === "md") return "note";
    return "file";
  }

  static isTitleVisible(type: AngaType): boolean {
    return type === "file";
  }

  static extractDisplayTitle(filename: string, type?: AngaType): string {
    // Strip timestamp prefix
    const withoutTimestamp = filename.replace(TIMESTAMP_PREFIX_REGEX, "");
    // Files keep hyphens and extension verbatim
    if (type === "file") {
      return withoutTimestamp;
    }
    // Notes and bookmarks: strip extension, replace hyphens with spaces
    const lastDot = withoutTimestamp.lastIndexOf(".");
    const withoutExtension =
      lastDot > 0 ? withoutTimestamp.substring(0, lastDot) : withoutTimestamp;
    return withoutExtension.replace(/-/g, " ");
  }

  static extractContentPreview(type: AngaType, contents: string): string {
    if (type === "bookmark") {
      return SearchResultFactory.extractDomainFromUrl(contents);
    }
    if (type === "note") {
      const MAX_PREVIEW_LENGTH = 100;
      return contents.length > MAX_PREVIEW_LENGTH
        ? contents.substring(0, MAX_PREVIEW_LENGTH) + "..."
        : contents;
    }
    return "";
  }

  static extractDate(filename: string): string {
    const match = filename.match(TIMESTAMP_EXTRACT_REGEX);
    if (!match) return "";
    return match[1];
  }

  static extractRawTimestamp(filename: string): string {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{6}(?:_\d{9})?)/);
    if (!match) return "";
    return match[1];
  }

  private static extractDomainFromUrl(contents: string): string {
    const lines = contents.split("\n");
    for (const line of lines) {
      if (line.startsWith("URL=")) {
        try {
          const url = new URL(line.substring(4).trim());
          return url.hostname;
        } catch {
          return line.substring(4).trim();
        }
      }
    }
    return "";
  }
}

export function matchesQuery(result: SearchResult, query: string): boolean {
  const q = query.toLowerCase();
  return (
    result.filename.toLowerCase().includes(q) ||
    result.displayTitle.toLowerCase().includes(q) ||
    result.contentPreview.toLowerCase().includes(q)
  );
}
