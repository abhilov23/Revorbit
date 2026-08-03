import type { ChangedFile } from "@revorbit/shared";

const DEFAULT_CHUNK_CHARACTERS = 40_000;

export function chunkFiles(
  files: ChangedFile[],
  maxCharacters: number = DEFAULT_CHUNK_CHARACTERS,
): ChangedFile[][] {
  const chunks: ChangedFile[][] = [];
  let current: ChangedFile[] = [];
  let currentSize = 0;

  for (const file of files) {
    const size = file.patch?.length ?? 0;

    if (size > maxCharacters) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      chunks.push([file]);
      continue;
    }

    if (currentSize + size > maxCharacters && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(file);
    currentSize += size;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
