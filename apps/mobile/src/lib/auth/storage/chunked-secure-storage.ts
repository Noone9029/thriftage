import type { AsyncKeyValueStorage, SecureKeyValueBackend } from './storage.types';

const DEFAULT_CHUNK_SIZE = 1_800;

interface ChunkMetadata {
  readonly chunks: number;
  readonly generation: number;
  readonly version: 1;
}

function metadataKey(key: string): string {
  return `${key}.__meta`;
}

function chunkKey(key: string, generation: number, index: number): string {
  return `${key}.__chunk.${generation}.${index}`;
}

function parseMetadata(value: string | null): ChunkMetadata | null {
  if (value === null) {
    return null;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new Error('Secure authentication storage metadata is corrupted.');
  }
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !('version' in candidate) ||
    candidate.version !== 1 ||
    !('chunks' in candidate) ||
    !Number.isSafeInteger(candidate.chunks) ||
    Number(candidate.chunks) < 1 ||
    !('generation' in candidate) ||
    !Number.isSafeInteger(candidate.generation) ||
    Number(candidate.generation) < 1
  ) {
    throw new Error('Secure authentication storage metadata is invalid.');
  }

  return {
    chunks: Number(candidate.chunks),
    generation: Number(candidate.generation),
    version: 1,
  };
}

function splitValue(value: string, chunkSize: number): string[] {
  if (value.length === 0) {
    return [''];
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    chunks.push(value.slice(offset, offset + chunkSize));
  }
  return chunks;
}

export class ChunkedSecureStorage implements AsyncKeyValueStorage {
  public constructor(
    private readonly backend: SecureKeyValueBackend,
    private readonly chunkSize = DEFAULT_CHUNK_SIZE,
  ) {
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
      throw new Error('Secure storage chunk size must be a positive integer.');
    }
  }

  public async getItem(key: string): Promise<string | null> {
    const metadata = parseMetadata(await this.backend.getItemAsync(metadataKey(key)));
    if (metadata === null) {
      return null;
    }

    const chunks: string[] = [];
    for (let index = 0; index < metadata.chunks; index += 1) {
      const chunk = await this.backend.getItemAsync(chunkKey(key, metadata.generation, index));
      if (chunk === null) {
        throw new Error('Secure authentication storage is incomplete.');
      }
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  public async setItem(key: string, value: string): Promise<void> {
    const previous = parseMetadata(await this.backend.getItemAsync(metadataKey(key)));
    const generation = (previous?.generation ?? 0) + 1;
    const chunks = splitValue(value, this.chunkSize);

    for (const [index, chunk] of chunks.entries()) {
      await this.backend.setItemAsync(chunkKey(key, generation, index), chunk);
    }
    await this.backend.setItemAsync(
      metadataKey(key),
      JSON.stringify({ chunks: chunks.length, generation, version: 1 } satisfies ChunkMetadata),
    );

    if (previous !== null) {
      await this.removeChunks(key, previous);
    }
  }

  public async removeItem(key: string): Promise<void> {
    const metadata = parseMetadata(await this.backend.getItemAsync(metadataKey(key)));
    await this.backend.deleteItemAsync(metadataKey(key));
    if (metadata !== null) {
      await this.removeChunks(key, metadata);
    }
  }

  private async removeChunks(key: string, metadata: ChunkMetadata): Promise<void> {
    for (let index = 0; index < metadata.chunks; index += 1) {
      await this.backend.deleteItemAsync(chunkKey(key, metadata.generation, index));
    }
  }
}
