export interface SyncResult {
  downloaded: string[];
  uploaded: string[];
  errors: Array<{ file: string; operation: string; error: string }>;
}
