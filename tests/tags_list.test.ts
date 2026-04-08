import { TagsList } from "../src/models/tags_list";

describe("TagsList", () => {
  it("should start empty by default", () => {
    const list = new TagsList();
    expect(list.tags).toEqual([]);
    expect(list.length).toBe(0);
  });

  it("should accept initial tags", () => {
    const list = new TagsList(["podcast", "democracy"]);
    expect(list.tags).toEqual(["podcast", "democracy"]);
    expect(list.length).toBe(2);
  });

  it("should not mutate initial tags array", () => {
    const initial = ["podcast"];
    const list = new TagsList(initial);
    list.add("democracy");
    expect(initial).toEqual(["podcast"]);
  });

  it("should add a tag", () => {
    const list = new TagsList();
    list.add("podcast");
    expect(list.tags).toEqual(["podcast"]);
    expect(list.length).toBe(1);
  });

  it("should add multiple tags", () => {
    const list = new TagsList();
    list.add("podcast");
    list.add("democracy");
    list.add("cooperatives");
    expect(list.tags).toEqual(["podcast", "democracy", "cooperatives"]);
    expect(list.length).toBe(3);
  });

  it("should remove the last tag", () => {
    const list = new TagsList(["podcast", "democracy"]);
    const removed = list.removeLast();
    expect(removed).toBe("democracy");
    expect(list.tags).toEqual(["podcast"]);
    expect(list.length).toBe(1);
  });

  it("should return undefined when removing from empty list", () => {
    const list = new TagsList();
    const removed = list.removeLast();
    expect(removed).toBeUndefined();
    expect(list.length).toBe(0);
  });

  it("should return tags copy, not internal reference", () => {
    const list = new TagsList(["podcast"]);
    const tags = list.tags;
    tags.push("injected");
    expect(list.tags).toEqual(["podcast"]);
  });

  describe("withPending", () => {
    it("should include non-empty pending text", () => {
      const list = new TagsList(["podcast"]);
      expect(list.withPending("democracy")).toEqual([
        "podcast",
        "democracy",
      ]);
    });

    it("should not include empty pending text", () => {
      const list = new TagsList(["podcast"]);
      expect(list.withPending("")).toEqual(["podcast"]);
    });

    it("should not include whitespace-only pending text", () => {
      const list = new TagsList(["podcast"]);
      expect(list.withPending("   ")).toEqual(["podcast"]);
    });

    it("should trim pending text", () => {
      const list = new TagsList();
      expect(list.withPending("  democracy  ")).toEqual(["democracy"]);
    });

    it("should not mutate internal tags", () => {
      const list = new TagsList(["podcast"]);
      list.withPending("democracy");
      expect(list.tags).toEqual(["podcast"]);
    });
  });
});
