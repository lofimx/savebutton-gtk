import { Filename } from "../../models/filename.js";
import { logger } from "../logger.js";
import { LocalRepo } from "./local_repo.js";
import { SyncResult } from "./sync_result.js";
import { ServerRepo } from "./server_repo.js";

export class SyncFile {
  private _serverRepo: ServerRepo;
  private _localRepo: LocalRepo;
  private _logPrefix: string;

  constructor(serverRepo: ServerRepo, localRepo: LocalRepo, logPrefix: string) {
    this._serverRepo = serverRepo;
    this._localRepo = localRepo;
    this._logPrefix = logPrefix;
  }

  async downloadFile(
    resource: string,
    filename: string,
    displayName: string,
    result: SyncResult
  ): Promise<void> {
    try {
      const data = await this._serverRepo.download(resource, filename);
      this._localRepo.writeFile(resource, filename, data);
      result.downloaded.push(displayName);
      logger.log(`[${this._logPrefix} DOWNLOAD] ${displayName}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      result.errors.push({
        file: displayName,
        operation: "download",
        error,
      });
      logger.error(
        `[${this._logPrefix} DOWNLOAD FAILED] ${displayName}: ${error}`
      );
    }
  }

  async uploadFile(
    resource: string,
    filename: string,
    contentType: string,
    result: SyncResult
  ): Promise<void> {
    const filenameValidator = new Filename(filename);
    if (!filenameValidator.isValid()) {
      logger.error(
        `Filename contains URL-invalid characters: '${filename}'. Skipping upload.`
      );
      result.errors.push({
        file: filename,
        operation: "upload",
        error: "Filename contains URL-illegal characters",
      });
      return;
    }

    try {
      const contents = this._localRepo.readFile(resource, filename);
      await this._serverRepo.upload(resource, filename, contents, contentType);
      result.uploaded.push(filename);
      logger.log(`[${this._logPrefix} UPLOAD] ${filename}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      result.errors.push({ file: filename, operation: "upload", error });
      logger.error(`[${this._logPrefix} UPLOAD FAILED] ${filename}: ${error}`);
    }
  }
}
