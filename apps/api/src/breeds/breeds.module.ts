import { Module } from "@nestjs/common";

import { RedisModule } from "../redis/redis.module";
import { BreedsController } from "./breeds.controller";
import { BreedsService } from "./breeds.service";

@Module({
  imports: [RedisModule],
  controllers: [BreedsController],
  providers: [BreedsService],
})
export class BreedsModule {}
