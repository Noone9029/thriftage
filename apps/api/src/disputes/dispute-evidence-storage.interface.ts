export interface DisputeEvidenceStorage {
  upload(key: string, body: Buffer): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  signedUrls(keys: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
export const DISPUTE_EVIDENCE_STORAGE = Symbol('DISPUTE_EVIDENCE_STORAGE');
