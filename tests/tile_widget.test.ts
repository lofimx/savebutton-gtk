import { TileWidget } from "../src/models/tile_widget";
import { SearchResultFactory } from "../src/models/search_result";

describe("TileWidget", () => {
  it("bookmark tile: no title, overlay icon, bookmark icon", () => {
    const result = SearchResultFactory.fromFile(
      "2025-06-28T120000-bookmark.url",
      "[InternetShortcut]\nURL=https://example.com\n"
    );
    const tile = new TileWidget(result);
    expect(tile.showTitle).toBe(false);
    expect(tile.overlayIcon).toBe(true);
    expect(tile.iconName).toBe("bookmark-filled-symbolic");
    expect(tile.showImage).toBe(false);
  });

  it("blurb tile: no title, overlay icon, pin icon", () => {
    const result = SearchResultFactory.fromFile(
      "2025-06-28T120000-my-blurb.md",
      "Hello world"
    );
    const tile = new TileWidget(result);
    expect(tile.showTitle).toBe(false);
    expect(tile.overlayIcon).toBe(true);
    expect(tile.iconName).toBe("pin-symbolic");
    expect(tile.showImage).toBe(false);
  });

  it("file tile: shows title, inline icon, no overlay", () => {
    const result = SearchResultFactory.fromFile(
      "2025-06-28T120000-document.pdf",
      ""
    );
    const tile = new TileWidget(result);
    expect(tile.showTitle).toBe(true);
    expect(tile.overlayIcon).toBe(false);
    expect(tile.iconName).toBe("text-x-generic-symbolic");
    expect(tile.showImage).toBe(false);
  });

  it("image file tile: shows image and title", () => {
    const result = SearchResultFactory.fromFile(
      "2025-06-28T120000-photo.png",
      ""
    );
    const tile = new TileWidget(result);
    expect(tile.showTitle).toBe(true);
    expect(tile.showImage).toBe(true);
    expect(tile.overlayIcon).toBe(false);
  });
});
