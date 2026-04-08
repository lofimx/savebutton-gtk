import { Clock, SystemClock } from "./clock.js";
import { Timestamp } from "./timestamp.js";

export interface DroppedFile {
  filename: string;
  filenameWithNanos: string;
  contents: Uint8Array;
}

export class Dropped {
  originalFilename = "";
  contents: Uint8Array = new Uint8Array();
  clock: Clock = new SystemClock();

  constructor(originalFilename: string, contents: Uint8Array, clock: Clock) {
    this.originalFilename = originalFilename;
    this.contents = contents;
    this.clock = clock;
  }

  toDroppedFile(): DroppedFile {
    const timestamp = new Timestamp(this.clock.now());
    const encodedFilename = encodeURIComponent(this.originalFilename);

    return {
      filename: `${timestamp.plain}-${encodedFilename}`,
      filenameWithNanos: `${timestamp.withNanos}-${encodedFilename}`,
      contents: this.contents,
    };
  }
}
