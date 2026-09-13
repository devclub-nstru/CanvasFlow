import fs from "node:fs/promises";
import { existsSync, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

class StorageService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), "uploads");
    this.initLocal();

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;

    this.isR2Enabled = Boolean(accessKeyId && secretAccessKey && bucketName);

    if (this.isR2Enabled) {
      const endpoint = process.env.S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
      this.bucketName = bucketName;
      this.publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN;

      this.s3Client = new S3Client({
        region: "auto",
        ...(endpoint ? { endpoint } : {}),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log(`[StorageService] Cloudflare R2 / S3 Storage enabled for bucket "${this.bucketName}"`);
    } else {
      console.log(`[StorageService] Using local filesystem storage at ${this.uploadDir}`);
    }
  }

  initLocal() {
    if (!existsSync(this.uploadDir)) {
      fs.mkdir(this.uploadDir, { recursive: true }).catch((err) => {
        console.error("Failed to create uploads directory:", err);
      });
    }
  }

  _resolveSafePath(destKey) {
    const resolved = path.resolve(this.uploadDir, destKey);
    if (!resolved.startsWith(this.uploadDir)) {
      throw new Error("Security Error: Path traversal detected");
    }
    return resolved;
  }

  /**
   * Uploads a local file to storage (Cloudflare R2 or local disk)
   */
  async uploadFile(localFilePath, destKey) {
    const cleanKey = destKey.replace(/\\/g, "/");

    if (this.isR2Enabled) {
      const fileStream = createReadStream(localFilePath);
      let contentType = "application/octet-stream";
      if (cleanKey.endsWith(".png")) contentType = "image/png";
      else if (cleanKey.endsWith(".jpg") || cleanKey.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (cleanKey.endsWith(".pptx")) contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      else if (cleanKey.endsWith(".pdf")) contentType = "application/pdf";

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
          Body: fileStream,
          ContentType: contentType,
        })
      );

      try {
        await fs.unlink(localFilePath);
      } catch {}

      return cleanKey;
    }

    // Local filesystem storage
    const destinationPath = this._resolveSafePath(cleanKey);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(localFilePath, destinationPath);
    try {
      await fs.unlink(localFilePath);
    } catch {}
    return cleanKey;
  }

  /**
   * Downloads a file from storage to a local filesystem path (for processing)
   */
  async downloadFile(destKey, targetLocalPath) {
    const cleanKey = destKey.replace(/\\/g, "/");
    console.log(
      `[StorageService] Downloading storageKey="${cleanKey}" -> targetLocalPath="${targetLocalPath}" (R2Enabled=${this.isR2Enabled})`
    );

    if (this.isR2Enabled) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        })
      );
      if (!response.Body) {
        throw new Error(`Object not found in R2 storage: ${cleanKey}`);
      }
      await fs.mkdir(path.dirname(targetLocalPath), { recursive: true });
      await pipeline(response.Body, createWriteStream(targetLocalPath));
      console.log(`[StorageService] Downloaded from R2 successfully to "${targetLocalPath}"`);
      return targetLocalPath;
    }

    // Local filesystem storage
    const sourcePath = this._resolveSafePath(cleanKey);
    console.log(`[StorageService] Local storage resolving source file from: "${sourcePath}"`);
    if (!existsSync(sourcePath)) {
      throw new Error(`Original file not found in local storage at ${sourcePath}`);
    }
    await fs.mkdir(path.dirname(targetLocalPath), { recursive: true });
    await fs.copyFile(sourcePath, targetLocalPath);
    console.log(`[StorageService] Copied local storage file from "${sourcePath}" -> "${targetLocalPath}"`);
    return targetLocalPath;
  }

  /**
   * Deletes a file from storage
   */
  async deleteFile(destKey) {
    const cleanKey = destKey.replace(/\\/g, "/");

    if (this.isR2Enabled) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          })
        );
      } catch (err) {
        console.error(`Failed to delete R2 object ${cleanKey}:`, err.message);
      }
      return;
    }

    // Local storage
    const filePath = this._resolveSafePath(cleanKey);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error(`Failed to delete local file ${cleanKey}:`, err.message);
      }
    }
  }

  /**
   * Returns the public URL for a given storage key
   */
  getUrl(destKey) {
    const cleanKey = destKey.replace(/\\/g, "/");
    if (this.isR2Enabled && this.publicDomain) {
      const base = this.publicDomain.replace(/\/$/, "");
      return `${base}/${cleanKey}`;
    }
    const host = process.env.WEB_URL || `http://localhost:${process.env.MENTI_PORT || 8080}`;
    return `${host}/uploads/${cleanKey}`;
  }
}

export const storageService = new StorageService();
