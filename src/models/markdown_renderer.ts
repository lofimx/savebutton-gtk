import { parse } from "../vendor/marked.js";

const HTML_TO_PANGO: [RegExp, string][] = [
  [/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '<span size="x-large"><b>$1</b></span>\n'],
  [/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '<span size="large"><b>$1</b></span>\n'],
  [/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '<span size="medium"><b>$1</b></span>\n'],
  [/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "<b>$1</b>\n"],
  [/<strong>([\s\S]*?)<\/strong>/gi, "<b>$1</b>"],
  [/<em>([\s\S]*?)<\/em>/gi, "<i>$1</i>"],
  [/<code>([\s\S]*?)<\/code>/gi, "<tt>$1</tt>"],
  [/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1">$2</a>'],
  [/<br\s*\/?>/gi, "\n"],
  [/<\/p>/gi, "\n\n"],
  [/<\/li>/gi, "\n"],
  [/<li>/gi, "  \u2022 "],
  [/<\/?(?!b>|\/b>|i>|\/i>|tt>|\/tt>|a |\/a>|span |\/span>)[^>]+>/g, ""],
];

export class MarkdownRenderer {
  static toPangoMarkup(markdown: string): string {
    const html = parse(markdown);

    let result = html;
    for (const [pattern, replacement] of HTML_TO_PANGO) {
      result = result.replace(pattern, replacement);
    }

    // marked produces &quot; and &#39; which Pango doesn't need
    result = result.replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    return result.trim();
  }
}
