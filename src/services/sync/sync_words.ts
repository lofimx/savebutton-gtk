import { logger } from "../logger.js";
import { LocalRepo } from "./local_repo.js";
import { SyncFile } from "./sync_file.js";
import { SyncResult } from "./sync_result.js";
import { ServerRepo } from "./server_repo.js";

const RESOURCE = "words";

export class SyncWords {
  private _serverRepo: ServerRepo;
  private _localRepo: LocalRepo;
  private _file: SyncFile;

  constructor(serverRepo: ServerRepo, localRepo: LocalRepo) {
    this._serverRepo = serverRepo;
    this._localRepo = localRepo;
    this._file = new SyncFile(serverRepo, localRepo, "WORDS");
  }

  async sync(result: SyncResult): Promise<void> {
    this._localRepo.ensureDir(RESOURCE);

    let serverWords: string[];
    try {
      serverWords = await this._serverRepo.fetchList(RESOURCE);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(`Failed to fetch server words list: ${error}`);
      return;
    }

    const localWords = this._localRepo.listDirectories(RESOURCE);

    logger.log(
      `Words - Server: ${serverWords.length}, Local: ${localWords.length}`
    );

    if (serverWords.length === localWords.length) {
      logger.log("Words counts match, skipping words sync");
      return;
    }

    const wordsToDownload = serverWords.filter((w) => !localWords.includes(w));

    logger.log(`Words - Download: ${wordsToDownload.length}`);

    for (const anga of wordsToDownload) {
      await this._downloadWords(anga, result);
    }
  }

  private async _downloadWords(
    anga: string,
    result: SyncResult
  ): Promise<void> {
    const wordResource = `${RESOURCE}/${anga}`;
    this._localRepo.ensureDir(wordResource);

    let serverFiles: string[];
    try {
      serverFiles = await this._serverRepo.fetchList(wordResource);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(`Failed to fetch word file list for ${anga}: ${error}`);
      return;
    }

    for (const filename of serverFiles) {
      await this._file.downloadFile(
        wordResource,
        filename,
        `${anga}/${filename}`,
        result
      );
    }
  }
}
