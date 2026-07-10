import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
