import { Meta } from "../src/models/meta";
import { FrozenClock } from "../src/models/clock";

const t = Temporal.Instant.from("2005-08-09T12:34:56Z");
const clock = new FrozenClock(t);

describe("Meta", () => {
  it("should create a TOML file with correct format for note only", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "This is my note",
      [],
      clock
    );

    expect(meta.toMetaFile()).toStrictEqual({
      filename: "2005-08-09T123456-note.toml",
      filenameWithNanos: "2005-08-09T123456_000000000-note.toml",
      contents: `[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''This is my note'''
`,
    });
  });

  it("should create a -tags.toml file for tags only", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "",
      ["podcast", "democracy"],
      clock
    );

    expect(meta.toMetaFile()).toStrictEqual({
      filename: "2005-08-09T123456-tags.toml",
      filenameWithNanos: "2005-08-09T123456_000000000-tags.toml",
      contents: `[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
tags = ["podcast", "democracy"]
`,
    });
  });

  it("should create a -meta.toml file for both tags and note", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "A note about this",
      ["podcast", "democracy"],
      clock
    );

    expect(meta.toMetaFile()).toStrictEqual({
      filename: "2005-08-09T123456-meta.toml",
      filenameWithNanos: "2005-08-09T123456_000000000-meta.toml",
      contents: `[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
tags = ["podcast", "democracy"]
note = '''A note about this'''
`,
    });
  });

  it("should handle multi-line notes", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "Line 1\nLine 2\nLine 3",
      [],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''Line 1
Line 2
Line 3'''
`);
  });

  it("should replace triple single quotes with triple double quotes", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "This note contains ''' triple quotes",
      [],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''This note contains """ triple quotes'''
`);
  });

  it("should handle multiple occurrences of triple single quotes", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "First ''' and second ''' occurrences",
      [],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''First """ and second """ occurrences'''
`);
  });

  it("should handle notes that are only triple single quotes", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "'''",
      [],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''"""'''
`);
  });

  it("should preserve single and double quotes that are not triple", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "It's a \"quoted\" string with '' two singles",
      [],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
note = '''It's a "quoted" string with '' two singles'''
`);
  });

  it("should handle a single tag", () => {
    const meta = new Meta(
      "2005-08-09T123456-bookmark.url",
      "",
      ["solo"],
      clock
    );

    expect(meta.toMetaFile().contents).toBe(`[anga]
filename = "2005-08-09T123456-bookmark.url"

[meta]
tags = ["solo"]
`);
  });
});
