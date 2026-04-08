// Mock the vendored marked library — Jest can't import ESM vendor bundles
jest.mock("../src/vendor/marked.js", () => {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return {
    parse: (md: string): string => {
      let html = md;

      // Headings (before escaping, so # syntax is recognized)
      html = html.replace(
        /^### (.+)$/gm,
        (_: string, t: string) => `<h3>${esc(t)}</h3>`
      );
      html = html.replace(
        /^## (.+)$/gm,
        (_: string, t: string) => `<h2>${esc(t)}</h2>`
      );
      html = html.replace(
        /^# (.+)$/gm,
        (_: string, t: string) => `<h1>${esc(t)}</h1>`
      );

      // Bold
      html = html.replace(
        /\*\*(.+?)\*\*/g,
        (_: string, t: string) => `<strong>${esc(t)}</strong>`
      );
      // Italic
      html = html.replace(
        /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
        (_: string, t: string) => `<em>${esc(t)}</em>`
      );
      // Inline code
      html = html.replace(
        /`([^`]+)`/g,
        (_: string, t: string) => `<code>${esc(t)}</code>`
      );

      // Lists
      html = html.replace(
        /^- (.+)$/gm,
        (_: string, t: string) => `<li>${esc(t)}</li>`
      );

      // Wrap remaining plain lines in <p>, escaping text content
      const lines = html.split("\n");
      const result = lines
        .map((line) => {
          if (
            line.startsWith("<h") ||
            line.startsWith("<li") ||
            line.trim() === ""
          ) {
            return line;
          }
          // Escape plain text portions (not inside tags)
          const escaped = line.replace(
            /([^<]*?)(<[^>]+>|$)/g,
            (_: string, text: string, tag: string) => esc(text) + tag
          );
          return `<p>${escaped}</p>`;
        })
        .join("\n");

      return result;
    },
  };
});

import { MarkdownRenderer } from "../src/models/markdown_renderer";

describe("MarkdownRenderer", () => {
  it("renders bold text", () => {
    const result = MarkdownRenderer.toPangoMarkup("**hello**");
    expect(result).toContain("<b>hello</b>");
  });

  it("renders italic text", () => {
    const result = MarkdownRenderer.toPangoMarkup("*hello*");
    expect(result).toContain("<i>hello</i>");
  });

  it("renders h1 with x-large size", () => {
    const result = MarkdownRenderer.toPangoMarkup("# Heading");
    expect(result).toContain('size="x-large"');
    expect(result).toContain("<b>Heading</b>");
  });

  it("renders h2 with large size", () => {
    const result = MarkdownRenderer.toPangoMarkup("## Heading");
    expect(result).toContain('size="large"');
    expect(result).toContain("<b>Heading</b>");
  });

  it("renders h3 with medium size", () => {
    const result = MarkdownRenderer.toPangoMarkup("### Heading");
    expect(result).toContain('size="medium"');
    expect(result).toContain("<b>Heading</b>");
  });

  it("renders inline code", () => {
    const result = MarkdownRenderer.toPangoMarkup("`code`");
    expect(result).toContain("<tt>code</tt>");
  });

  it("renders list items with bullet points", () => {
    const result = MarkdownRenderer.toPangoMarkup("- item one\n- item two");
    expect(result).toContain("\u2022 item one");
    expect(result).toContain("\u2022 item two");
  });

  it("escapes ampersands", () => {
    const result = MarkdownRenderer.toPangoMarkup("a & b");
    expect(result).toContain("&amp;");
  });

  it("renders plain text without extra markup", () => {
    const result = MarkdownRenderer.toPangoMarkup("hello world");
    expect(result).toBe("hello world");
  });
});
