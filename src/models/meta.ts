import { Clock, SystemClock } from "./clock.js";
import { Timestamp } from "./timestamp.js";

export interface MetaData {
  tags: string[];
  note: string;
}

export interface MetaFile {
  filename: string;
  filenameWithNanos: string;
  contents: string;
}

export class Meta {
  angaFilename = "";
  note = "";
  tags: string[] = [];
  clock: Clock = new SystemClock();

  constructor(
    angaFilename: string,
    note: string,
    tags: string[],
    clock: Clock
  ) {
    this.angaFilename = angaFilename;
    this.note = note;
    this.tags = tags;
    this.clock = clock;
  }

  toMetaFile(): MetaFile {
    const timestamp = new Timestamp(this.clock.now());
    const suffix = this._filenameSuffix();

    const metaLines: string[] = [];
    if (this.tags.length > 0) {
      const tagsArray = this.tags.map((t) => `"${t}"`).join(", ");
      metaLines.push(`tags = [${tagsArray}]`);
    }
    if (this.note.length > 0) {
      const sanitizedNote = this.note.replace(/'''/g, '"""');
      metaLines.push(`note = '''${sanitizedNote}'''`);
    }

    const tomlContent = `[anga]
filename = "${this.angaFilename}"

[meta]
${metaLines.join("\n")}
`;
    return {
      filename: `${timestamp.plain}-${suffix}.toml`,
      filenameWithNanos: `${timestamp.withNanos}-${suffix}.toml`,
      contents: tomlContent,
    };
  }

  private _filenameSuffix(): string {
    const hasNote = this.note.length > 0;
    const hasTags = this.tags.length > 0;
    if (hasNote && hasTags) return "meta";
    if (hasTags) return "tags";
    return "note";
  }
}
