import fs from "node:fs";
import { v2 as cloudinary } from "cloudinary";
import { storageKindFor } from "@repo/services/form-upload";

import { env, isCloudinaryConfigured } from "./env";

export interface StoredFile {
  publicId: string;
  url: string;
  resourceType: string;
}

export interface FileStorage {
  upload(input: {
    localPath: string;
    formId: string;
    uploadId: string;
    originalName: string;
    mimeType: string;
  }): Promise<StoredFile>;
}

export class PermanentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentStorageError";
  }
}

export class StorageNotConfiguredError extends PermanentStorageError {
  constructor() {
    super(
      "Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET",
    );
    this.name = "StorageNotConfiguredError";
  }
}

function asPermanent(message: string): PermanentStorageError | null {
  const text = message.toLowerCase();

  if (text.includes("too large")) {
    const max = message.match(/maximum is (\d+)/i)?.[1];
    const got = message.match(/got (\d+)/i)?.[1];

    const limit = max ? `${(Number(max) / (1024 * 1024)).toFixed(0)}MB` : "the allowed size";
    const actual = got ? `${(Number(got) / (1024 * 1024)).toFixed(1)}MB` : "that file";

    return new PermanentStorageError(
      `File is ${actual}, over the storage limit of ${limit}. Please upload a smaller file.`,
    );
  }

  if (
    text.includes("cloud_name") ||
    text.includes("api key") ||
    text.includes("invalid signature") ||
    text.includes("api_key")
  ) {
    return new PermanentStorageError("File storage is misconfigured — contact the form owner.");
  }

  if (text.includes("unsupported") || text.includes("invalid") || text.includes("empty file")) {
    return new PermanentStorageError(
      "That file could not be processed — the format may be unsupported or the file corrupt.",
    );
  }

  return null;
}

let configured = false;

const resourceTypeFor = storageKindFor;

function rawExtensionFor(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  if (dot === -1) return "";

  const cleaned = originalName
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);

  return cleaned ? `.${cleaned}` : "";
}

export const cloudinaryStorage: FileStorage = {
  async upload({ localPath, formId, uploadId, originalName, mimeType }) {
    if (!isCloudinaryConfigured()) throw new StorageNotConfiguredError();

    if (!configured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      configured = true;
    }

    const resourceType = resourceTypeFor(mimeType);

    const publicId =
      resourceType === "raw" ? `${uploadId}${rawExtensionFor(originalName)}` : uploadId;

    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/${formId}`,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
          use_filename: false,
          unique_filename: false,
          context: { original_name: originalName },
        },
        (error, result) => {
          if (error) {
            const message = error.message || "Cloudinary upload failed";
            return reject(asPermanent(message) ?? new Error(message));
          }
          if (!result) return reject(new Error("Cloudinary returned no result"));

          resolve({
            publicId: result.public_id,
            url: result.secure_url,
            resourceType: result.resource_type ?? resourceType,
          });
        },
      );

      const source = fs.createReadStream(localPath);
      source.on("error", (err) => {
        stream.destroy();

        /* The temp file is gone — the API container's disk is not this
         * container's disk, the file was swept, or a retry outlived it.
         * Retrying cannot bring it back, and the raw ENOENT (which carries a
         * server path) must never reach the respondent. */
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return reject(
            new PermanentStorageError(
              "The uploaded file is no longer available on the server. Please attach it again.",
            ),
          );
        }

        reject(err);
      });
      source.pipe(stream);
    });
  },
};
