import { logger } from "../logger.js";
import { LocalRepo } from "./local_repo.js";
import { SyncFile } from "./sync_file.js";
import { SyncResult } from "./sync_result.js";
import { ServerRepo } from "./server_repo.js";

const RESOURCE = "anga";

export class SyncAnga {
  private _serverRepo: ServerRepo;
  private _localRepo: LocalRepo;
  private _file: SyncFile;

  constructor(serverRepo: ServerRepo, localRepo: LocalRepo) {
    this._serverRepo = serverRepo;
    this._localRepo = localRepo;
    this._file = new SyncFile(serverRepo, localRepo, "ANGA");
  }

  async sync(result: SyncResult): Promise<void> {
    const serverFiles = await this._serverRepo.fetchList(RESOURCE);
    const localFiles = this._localRepo.listFiles(RESOURCE);

    logger.log(
      `Anga - Server: ${serverFiles.length}, Local: ${localFiles.length}`
    );

    if (serverFiles.length === localFiles.length) {
      logger.log("Anga counts match, skipping anga sync");
      return;
    }

    const toDownload = serverFiles.filter((f) => !localFiles.includes(f));
    const toUpload = localFiles.filter((f) => !serverFiles.includes(f));

    logger.log(
      `Anga - Download: ${toDownload.length}, Upload: ${toUpload.length}`
    );

    for (const filename of toDownload) {
      await this._file.downloadFile(RESOURCE, filename, filename, result);
    }

    for (const filename of toUpload) {
      const contentType = this._serverRepo.mimeTypeFor(filename);
      await this._file.uploadFile(RESOURCE, filename, contentType, result);
    }
  }
}
