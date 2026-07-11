import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { AppConfigService } from "../config/app-config.service";
import { StorageService } from "./storage.service";

describe("StorageService", () => {
  const config = new AppConfigService();

  function buildClientWithSend(send: jest.Mock): S3Client {
    return { send } as unknown as S3Client;
  }

  async function bufferBody(text: string): Promise<AsyncIterable<Buffer>> {
    const chunks = [Buffer.from(text.slice(0, 3)), Buffer.from(text.slice(3))];
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  }

  describe("getPresignedPutUrl", () => {
    it("returns a URL containing the bucket, key, and X-Amz-Signature — runs offline, no network", async () => {
      // A real S3Client, unmocked: presigning is a local computation (request
      // building + SigV4 signing), it never calls `send`/hits the network.
      const client = new S3Client({
        endpoint: config.s3Endpoint,
        region: config.s3Region,
        credentials: {
          accessKeyId: config.s3AccessKey,
          secretAccessKey: config.s3SecretKey,
        },
        forcePathStyle: true,
      });
      const service = new StorageService(client, config);

      const url = await service.getPresignedPutUrl({
        key: "pets/pet-1/original/abc.jpg",
        contentType: "image/jpeg",
      });

      expect(url).toContain(config.s3Bucket);
      expect(url).toContain("pets/pet-1/original/abc.jpg");
      expect(url).toContain("X-Amz-Signature");
    });
  });

  describe("getObject", () => {
    it("sends a GetObjectCommand bound to the bucket + key and concatenates the streamed body", async () => {
      const send = jest.fn().mockResolvedValue({ Body: await bufferBody("hello world") });
      const service = new StorageService(buildClientWithSend(send), config);

      const result = await service.getObject("pets/pet-1/original/abc.jpg");

      expect(result.toString()).toBe("hello world");
      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: config.s3Bucket, Key: "pets/pet-1/original/abc.jpg" });
    });
  });

  describe("putObject", () => {
    it("sends a PutObjectCommand binding Bucket, Key, Body, and ContentType", async () => {
      const send = jest.fn().mockResolvedValue({});
      const service = new StorageService(buildClientWithSend(send), config);
      const body = Buffer.from("image-bytes");

      await service.putObject("pets/pet-1/main/abc.jpg", body, "image/jpeg");

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: config.s3Bucket,
        Key: "pets/pet-1/main/abc.jpg",
        Body: body,
        ContentType: "image/jpeg",
      });
    });
  });

  describe("deleteObject", () => {
    it("sends a DeleteObjectCommand bound to the bucket + key", async () => {
      const send = jest.fn().mockResolvedValue({});
      const service = new StorageService(buildClientWithSend(send), config);

      await service.deleteObject("pets/pet-1/original/abc.jpg");

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: config.s3Bucket, Key: "pets/pet-1/original/abc.jpg" });
    });
  });

  describe("objectExists", () => {
    it("sends a HeadObjectCommand and returns true when it resolves", async () => {
      const send = jest.fn().mockResolvedValue({});
      const service = new StorageService(buildClientWithSend(send), config);

      const result = await service.objectExists("pets/pet-1/original/abc.jpg");

      expect(result).toBe(true);
      const command = send.mock.calls[0][0] as HeadObjectCommand;
      expect(command).toBeInstanceOf(HeadObjectCommand);
      expect(command.input).toEqual({ Bucket: config.s3Bucket, Key: "pets/pet-1/original/abc.jpg" });
    });

    it("returns false on a NotFound error", async () => {
      const notFound = Object.assign(new Error("not found"), { name: "NotFound" });
      const send = jest.fn().mockRejectedValue(notFound);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.objectExists("missing-key")).resolves.toBe(false);
    });

    it("returns false on a 404 $metadata.httpStatusCode error", async () => {
      const notFound = Object.assign(new Error("not found"), { $metadata: { httpStatusCode: 404 } });
      const send = jest.fn().mockRejectedValue(notFound);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.objectExists("missing-key")).resolves.toBe(false);
    });

    it("rethrows any other error", async () => {
      const outage = Object.assign(new Error("service unavailable"), { name: "ServiceUnavailable" });
      const send = jest.fn().mockRejectedValue(outage);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.objectExists("some-key")).rejects.toBe(outage);
    });
  });

  describe("ensureBucket", () => {
    it("sends a CreateBucketCommand bound to the configured bucket", async () => {
      const send = jest.fn().mockResolvedValue({});
      const service = new StorageService(buildClientWithSend(send), config);

      await service.ensureBucket();

      const command = send.mock.calls[0][0] as CreateBucketCommand;
      expect(command).toBeInstanceOf(CreateBucketCommand);
      expect(command.input).toEqual({ Bucket: config.s3Bucket });
    });

    it("swallows BucketAlreadyOwnedByYou", async () => {
      const owned = Object.assign(new Error("owned"), { name: "BucketAlreadyOwnedByYou" });
      const send = jest.fn().mockRejectedValue(owned);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.ensureBucket()).resolves.toBeUndefined();
    });

    it("swallows BucketAlreadyExists", async () => {
      const exists = Object.assign(new Error("exists"), { name: "BucketAlreadyExists" });
      const send = jest.fn().mockRejectedValue(exists);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.ensureBucket()).resolves.toBeUndefined();
    });

    it("rethrows any other error", async () => {
      const outage = Object.assign(new Error("service unavailable"), { name: "ServiceUnavailable" });
      const send = jest.fn().mockRejectedValue(outage);
      const service = new StorageService(buildClientWithSend(send), config);

      await expect(service.ensureBucket()).rejects.toBe(outage);
    });
  });
});
