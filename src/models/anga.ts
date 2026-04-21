import { Clock, SystemClock } from "./clock.js";
import { Timestamp } from "./timestamp.js";

export interface AngaFile {
  filename: string;
  filenameWithNanos: string;
  contents: string;
}

export class Anga {
  text = "";
  clock = new SystemClock();

  constructor(text: string, clock: Clock) {
    this.text = text;
    this.clock = clock;
  }

  toAngaFile(): AngaFile {
    const timestamp = new Timestamp(this.clock.now());
    if (this.text.startsWith("http://") || this.text.startsWith("https://")) {
      return {
        filename: `${timestamp.plain}-bookmark.url`,
        filenameWithNanos: `${timestamp.withNanos}-bookmark.url`,
        contents: `[InternetShortcut]
URL=${this.text}
`,
      } as AngaFile;
    }
    return {
      filename: `${timestamp.plain}-blurb.md`,
      filenameWithNanos: `${timestamp.withNanos}-blurb.md`,
      contents: this.text,
    } as AngaFile;
  }
}
