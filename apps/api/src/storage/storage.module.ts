import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { S3_CLIENT, StorageService } from "./storage.service";

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): S3Client =>
        new S3Client({
          endpoint: config.s3Endpoint,
          region: config.s3Region,
          credentials: {
            accessKeyId: config.s3AccessKey,
            secretAccessKey: config.s3SecretKey,
          },
          forcePathStyle: true,
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
