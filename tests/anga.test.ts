import { Anga } from "../src/models/anga";
import { FrozenClock } from "../src/models/clock";

const t = Temporal.Instant.from("2005-08-09T12:34:56Z");
const clock = new FrozenClock(t);

describe("Anga", () => {
  it("should save http stuff with a trailing newline", () => {
    expect(new Anga("https://deobald.ca", clock).toAngaFile()).toStrictEqual({
      filename: "2005-08-09T123456-bookmark.url",
      filenameWithNanos: "2005-08-09T123456_000000000-bookmark.url",
      contents: `[InternetShortcut]
URL=https://deobald.ca
`,
    });
  });

  it("should save non-http as text blurbs", () => {
    expect(new Anga("42", clock).toAngaFile()).toStrictEqual({
      filename: "2005-08-09T123456-blurb.md",
      filenameWithNanos: "2005-08-09T123456_000000000-blurb.md",
      contents: "42",
    });
  });
});
