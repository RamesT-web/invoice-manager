/**
 * Storage adapter — switches between local disk and S3-compatible object storage.
 *
 * Set STORAGE_DRIVER=local (default) or STORAGE_DRIVER=object in .env.
 * For object storage, configure S3_ENDPOINT, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME.
 */

import path from "path";
import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Driver detection ──────────────────────────────────────

const DRIVER = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
const isObject = DRIVER === "object";

// ─── Local config ──────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// ─── S3 config (lazy — only initialised when needed) ──────

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION ?? "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // needed for Supabase Storage / MinIO
  });
  return _s3;
}

function bucket(): string {
  return process.env.S3_BUCKET_NAME ?? "invoice-manager";
}

// ─── Public API ────────────────────────────────────────────

export const storage = {
  driver: DRIVER as "local" | "object",

  /**
   * Upload a file buffer and return the storage key.
   * The key is always a forward-slash-separated relative path.
   */
  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (isObject) {
      await getS3().send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    } else {
      const filePath = path.join(UPLOADS_DIR, ...key.split("/"));
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);
    }
  },

  /**
   * Download a file and return the buffer.
   * For object storage this streams the entire body into memory.
   */
  async download(key: string): Promise<Buffer> {
    if (isObject) {
      const resp = await getS3().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key })
      );
      const chunks: Uint8Array[] = [];
      // @ts-expect-error — Body is a readable stream in Node
      for await (const chunk of resp.Body!) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } else {
      const filePath = path.resolve(UPLOADS_DIR, ...key.split("/"));
      // Path traversal guard
      if (!filePath.startsWith(path.resolve(UPLOADS_DIR))) {
        throw new Error("Invalid storage key");
      }
      return fs.readFile(filePath);
    }
  },

  /**
   * Generate a signed URL valid for `expiresIn` seconds (object storage only).
   * Returns null for local driver.
   */
  async signedUrl(key: string, expiresIn = 3600): Promise<string | null> {
    if (!isObject) return null;
    const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
    return getSignedUrl(getS3(), command, { expiresIn });
  },

  /**
   * Delete a file. Best-effort — swallows errors.
   */
  async delete(key: string): Promise<void> {
    try {
      if (isObject) {
        await getS3().send(
          new DeleteObjectCommand({ Bucket: bucket(), Key: key })
        );
      } else {
        const filePath = path.resolve(UPLOADS_DIR, ...key.split("/"));
        if (filePath.startsWith(path.resolve(UPLOADS_DIR))) {
          await fs.unlink(filePath);
        }
      }
    } catch {
      // Best effort — file may already be deleted
    }
  },
};
