import { Injectable } from "@nestjs/common";
import { defineEnv } from "@pawcareright/config/env";

import { apiEnvSchema, type ApiEnv } from "./env.schema";

@Injectable()
export class AppConfigService {
  private readonly env: ApiEnv;

  constructor() {
    this.env = defineEnv(apiEnvSchema);
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): ApiEnv["NODE_ENV"] {
    return this.env.NODE_ENV;
  }
}
