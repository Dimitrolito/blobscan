import IORedis from "ioredis";

import {
  createStorageFromEnv,
  getBlobStorageManager,
} from "@blobscan/blob-storage-manager";
import type { BlobStorageManager } from "@blobscan/blob-storage-manager";
import type { BlobscanPrismaClient } from "@blobscan/db";
import { prisma } from "@blobscan/db";
import { env } from "@blobscan/env";

import { BlobPropagator } from "./BlobPropagator";

async function createBlobPropagator(
  blobStorageManager: BlobStorageManager,
  prisma: BlobscanPrismaClient
) {
  const connection = new IORedis(env.REDIS_URI, { maxRetriesPerRequest: null });

  if (
    !blobStorageManager
      .getAllStorages()
      .find((storage) => storage.name === env.BLOB_PROPAGATOR_TMP_BLOB_STORAGE)
  ) {
    try {
      const tmpStorage = await createStorageFromEnv(
        env.BLOB_PROPAGATOR_TMP_BLOB_STORAGE
      );

      if (tmpStorage) {
        blobStorageManager.addStorage(tmpStorage);
      }
    } catch (err) {
      throw new Error(`Failed to create temporary blob storage: ${err}`);
    }
  }

  return new BlobPropagator({
    blobStorageManager,
    prisma,
    tmpBlobStorage: env.BLOB_PROPAGATOR_TMP_BLOB_STORAGE,
    workerOptions: {
      connection,
    },
  });
}

let blobPropagator: BlobPropagator | undefined;

async function getBlobPropagator() {
  if (!blobPropagator) {
    const blobStorageManager = await getBlobStorageManager();

    blobPropagator = await createBlobPropagator(blobStorageManager, prisma);
  }

  return blobPropagator;
}

export { getBlobPropagator, createBlobPropagator };
