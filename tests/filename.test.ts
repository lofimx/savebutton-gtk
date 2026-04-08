import { Filename } from "../src/models/filename";

describe("Filename", () => {
  describe("isValid()", () => {
    it("should return true for simple valid filenames", () => {
      const filenames = [
        "document.pdf",
        "photo.jpg",
        "file.txt",
        "archive.tar.gz",
        "data.json",
        "image.png",
      ];

      filenames.forEach((filename) => {
        const fn = new Filename(filename);
        expect(fn.isValid()).toBe(true);
      });
    });

    it("should return true for filenames with URL-safe characters", () => {
      const filenames = [
        "file-123.txt",
        "File_With_Underscores.txt",
        "Name.With.Dots.doc",
        "UPPERCASE.TXT",
        "lowercase.md",
        "MixedCase-File_Name.md",
        "test123-456_789.txt",
      ];

      filenames.forEach((filename) => {
        const fn = new Filename(filename);
        expect(fn.isValid()).toBe(true);
      });
    });

    it("should return true for filenames that are already URL-encoded", () => {
      const filenames = [
        "this%20file%20had%20spaces.pdf",
        "file%281%29.txt",
        "document%20%26%20copy.pdf",
        "file%23123.pdf",
        "image%3Fquestion.png",
        "file%5B1%5D.txt",
        "name%40email.com.pdf",
        "file%7Bdata%7D.json",
      ];

      filenames.forEach((filename) => {
        const fn = new Filename(filename);
        expect(fn.isValid()).toBe(true);
      });
    });

    it("should return false for filenames with spaces", () => {
      const fn = new Filename("file with spaces.pdf");
      expect(fn.isValid()).toBe(false);
    });

    it("should return false for filenames with parentheses", () => {
      const fn = new Filename("file(1).txt");
      expect(fn.isValid()).toBe(false);
    });

    it("should return false for filenames with ampersands", () => {
      const fn = new Filename("file & copy.txt");
      expect(fn.isValid()).toBe(false);
    });

    it("should return false for filenames with hash", () => {
      const fn = new Filename("file#123.pdf");
      expect(fn.isValid()).toBe(false);
    });

    it("should return false for filenames with question marks", () => {
      const fn = new Filename("file?.txt");
      expect(fn.isValid()).toBe(false);
    });

    it("should return false for filenames with other special characters", () => {
      const invalidFilenames = [
        "file[1].txt",
        "file{name}.json",
        "file@email.com.pdf",
        "file+plus.txt",
        "file=equal.doc",
        "file!exclam.pdf",
        "file*star.txt",
        "file'tick.doc",
        'file"quote.pdf',
        "file<angle>.txt",
      ];

      invalidFilenames.forEach((filename) => {
        const fn = new Filename(filename);
        expect(fn.isValid()).toBe(false);
      });
    });

    it("should handle empty string", () => {
      const fn = new Filename("");
      expect(fn.isValid()).toBe(true);
    });

    it("should preserve the original filename value", () => {
      const filename = "test file.txt";
      const fn = new Filename(filename);
      expect(fn.value).toBe(filename);
    });
  });
});
