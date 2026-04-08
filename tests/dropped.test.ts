import { Dropped } from "../src/models/dropped";
import { FrozenClock } from "../src/models/clock";

const t = Temporal.Instant.from("2005-08-09T12:34:56Z");
const clock = new FrozenClock(t);

describe("Dropped", () => {
  it("should create timestamped filename from original filename", () => {
    const contents = new TextEncoder().encode("file contents");
    const dropped = new Dropped("document.pdf", contents, clock);

    expect(dropped.toDroppedFile()).toStrictEqual({
      filename: "2005-08-09T123456-document.pdf",
      filenameWithNanos: "2005-08-09T123456_000000000-document.pdf",
      contents: contents,
    });
  });

  it("should preserve original file extension", () => {
    const contents = new TextEncoder().encode("image data");
    const dropped = new Dropped("photo.jpg", contents, clock);

    expect(dropped.toDroppedFile().filename).toBe(
      "2005-08-09T123456-photo.jpg"
    );
  });

  it("should handle filenames with multiple dots", () => {
    const contents = new TextEncoder().encode("archive");
    const dropped = new Dropped("backup.tar.gz", contents, clock);

    expect(dropped.toDroppedFile().filename).toBe(
      "2005-08-09T123456-backup.tar.gz"
    );
  });

  it("should preserve binary contents", () => {
    const binaryContents = new Uint8Array([0x00, 0xff, 0x42, 0x89]);
    const dropped = new Dropped("binary.bin", binaryContents, clock);

    expect(dropped.toDroppedFile().contents).toStrictEqual(binaryContents);
  });

  it("should URI-encode filenames with spaces", () => {
    const contents = new TextEncoder().encode("screenshot");
    const dropped = new Dropped("GNOME Desktop.png", contents, clock);

    expect(dropped.toDroppedFile().filename).toBe(
      "2005-08-09T123456-GNOME%20Desktop.png"
    );
    expect(dropped.toDroppedFile().filenameWithNanos).toBe(
      "2005-08-09T123456_000000000-GNOME%20Desktop.png"
    );
  });

  it("should URI-encode filenames with special characters", () => {
    const contents = new TextEncoder().encode("data");
    const dropped = new Dropped("file (1) & copy.txt", contents, clock);

    expect(dropped.toDroppedFile().filename).toBe(
      "2005-08-09T123456-file%20(1)%20%26%20copy.txt"
    );
  });
});
