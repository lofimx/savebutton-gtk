import { logger } from "../logger.js";
import { LocalRepo } from "./local_repo.js";
import { SyncFile } from "./sync_file.js";
import { SyncResult } from "./sync_result.js";
import { ServerRepo } from "./server_repo.js";

const RESOURCE = "meta";
const CONTENT_TYPE = "application/toml";

export class SyncMeta {
  private _serverRepo: ServerRepo;
  private _localRepo: LocalRepo;
  private _file: SyncFile;

  constructor(serverRepo: ServerRepo, localRepo: LocalRepo) {
    this._serverRepo = serverRepo;
    this._localRepo = localRepo;
    this._file = new SyncFile(serverRepo, localRepo, "META");
  }

  async sync(result: SyncResult): Promise<void> {
    this._localRepo.ensureDir(RESOURCE);

    let serverFiles: string[];
    try {
      serverFiles = await this._serverRepo.fetchList(RESOURCE);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error(`Failed to fetch server meta files: ${error}`);
      return;
    }

    const localFiles = this._localRepo
      .listFiles(RESOURCE)
      .filter((f) => f.endsWith(".toml"));

    logger.log(
      `Meta - Server: ${serverFiles.length}, Local: ${localFiles.length}`
    );

    if (serverFiles.length === localFiles.length) {
      logger.log("Meta counts match, skipping meta sync");
      return;
    }

    const toDownload = serverFiles.filter((f) => !localFiles.includes(f));
    const toUpload = localFiles.filter((f) => !serverFiles.includes(f));

    logger.log(
      `Meta - Download: ${toDownload.length}, Upload: ${toUpload.length}`
    );

    for (const filename of toDownload) {
      await this._file.downloadFile(RESOURCE, filename, filename, result);
    }

    for (const filename of toUpload) {
      await this._file.uploadFile(RESOURCE, filename, CONTENT_TYPE, result);
    }
  }
}
