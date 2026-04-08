import { SearchResult, SearchResultFactory } from "./search_result.js";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
]);

const TYPE_ICONS: Record<string, string> = {
  bookmark: "bookmark-filled-symbolic",
  note: "pin-symbolic",
  file: "text-x-generic-symbolic",
};

export class TileWidget {
  readonly showTitle: boolean;
  readonly showImage: boolean;
  readonly iconName: string;
  readonly overlayIcon: boolean;

  constructor(result: SearchResult) {
    this.showTitle = SearchResultFactory.isTitleVisible(result.type);
    this.iconName = TYPE_ICONS[result.type] || "text-x-generic-symbolic";
    this.overlayIcon = result.type !== "file";

    const ext = result.filename.split(".").pop()?.toLowerCase() || "";
    this.showImage = result.type === "file" && IMAGE_EXTENSIONS.has(ext);
  }
}
