import { Readable } from "node:stream";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";

const PRESIGN_EXPIRY_SECONDS = 300;

/**
 * DI token for the `S3Client` instance. Declared here (rather than in
 * `storage.module.ts`, which provides it via a factory) so `StorageModule`
 * can import it from `StorageService` without a circular module reference.
 */
export const S3_CLIENT = Symbol("S3_CLIENT");

/**
 * Thin S3/MinIO wrapper. All object I/O for the photo pipeline goes through
 * this service so the AWS SDK surface is confined to one place.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly config: AppConfigService,
  ) {}

  async getPresignedPutUrl(args: { key: string; contentType: string }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: args.key,
      ContentType: args.contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  }

  async getPresignedGetUrl(args: { key: string; expiresInSeconds?: number }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: args.key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: args.expiresInSeconds ?? PRESIGN_EXPIRY_SECONDS,
    });
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.s3Bucket, Key: key }),
    );

    return this.streamToBuffer(result.Body as Readable);
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.s3Bucket, Key: key }));
  }

  /**
   * Lists every object key under `prefix` (T091 plan step 7), following the
   * `ContinuationToken` across as many pages as the bucket returns. Returns
   * `[]` (no `send` call needed beyond the first page) when the prefix has
   * no objects — the erasure/export services (T091) need the FULL key set
   * under a pet's or an account's S3 namespace, not just the first page.
   */
  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.s3Bucket,
          Prefix: prefix,
          ...(continuationToken !== undefined ? { ContinuationToken: continuationToken } : {}),
        }),
      );

      for (const object of page.Contents ?? []) {
        if (object.Key !== undefined) {
          keys.push(object.Key);
        }
      }

      continuationToken = page.IsTruncated === true ? page.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);

    return keys;
  }

  /**
   * Deletes every key in `keys` (T091 plan step 7). No-op on an empty array
   * — deliberately simple (a per-key `deleteObject` loop, not the batched
   * `DeleteObjectsCommand`) so this stays idempotent by construction: a
   * repeat call against already-deleted keys is a set of no-op deletes, not
   * a partial-batch error to reconcile.
   */
  async deleteObjects(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      await this.deleteObject(key);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: key }));
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /** Idempotent: swallows "bucket already exists/owned" errors. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.s3Bucket }));
    } catch (error) {
      if (this.isBucketAlreadyExistsError(error)) {
        return;
      }
      this.logger.error(`ensureBucket failed for ${this.config.s3Bucket}`, error as Error);
      throw error;
    }
  }

  private isNotFoundError(error: unknown): boolean {
    const name = this.errorName(error);
    const statusCode = this.errorStatusCode(error);
    return name === "NotFound" || name === "NoSuchKey" || statusCode === 404;
  }

  private isBucketAlreadyExistsError(error: unknown): boolean {
    const name = this.errorName(error);
    return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
  }

  private errorName(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "name" in error) {
      return (error as { name?: unknown }).name as string | undefined;
    }
    return undefined;
  }

  private errorStatusCode(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "$metadata" in error) {
      const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
      return metadata?.httpStatusCode;
    }
    return undefined;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }
}
