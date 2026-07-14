import { Redis } from "ioredis";

import type { AppConfigService } from "../config/app-config.service";
import { RedisService } from "./redis.service";

jest.mock("ioredis", () => ({ Redis: jest.fn() }));

interface FakeRedisClient {
  ping: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
  incrby: jest.Mock;
  expire: jest.Mock;
  quit: jest.Mock;
}

describe("RedisService", () => {
  function buildService(): { service: RedisService; client: FakeRedisClient } {
    const client: FakeRedisClient = {
      ping: jest.fn().mockResolvedValue("PONG"),
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue("value"),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      incrby: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue("OK"),
    };

    (Redis as unknown as jest.Mock).mockImplementation(() => client);

    const config = { redisUrl: "redis://localhost:6379" } as unknown as AppConfigService;
    const service = new RedisService(config);

    return { service, client };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("ping delegates to the client", async () => {
    const { service, client } = buildService();

    await expect(service.ping()).resolves.toBe("PONG");
    expect(client.ping).toHaveBeenCalledTimes(1);
  });

  it("set delegates to the client with EX ttl", async () => {
    const { service, client } = buildService();

    await service.set("key", "value", 60);

    expect(client.set).toHaveBeenCalledWith("key", "value", "EX", 60);
  });

  it("setNx returns true on OK and passes EX ttl NX", async () => {
    const { service, client } = buildService();
    client.set.mockResolvedValue("OK");

    await expect(service.setNx("key", "value", 60)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith("key", "value", "EX", 60, "NX");
  });

  it("setNx returns false on null", async () => {
    const { service, client } = buildService();
    client.set.mockResolvedValue(null);

    await expect(service.setNx("key", "value", 60)).resolves.toBe(false);
  });

  it("get delegates to the client", async () => {
    const { service, client } = buildService();

    await expect(service.get("key")).resolves.toBe("value");
    expect(client.get).toHaveBeenCalledWith("key");
  });

  it("del with no keys returns 0 without calling the client", async () => {
    const { service, client } = buildService();

    await expect(service.del()).resolves.toBe(0);
    expect(client.del).not.toHaveBeenCalled();
  });

  it("del with keys delegates to the client", async () => {
    const { service, client } = buildService();
    client.del.mockResolvedValue(2);

    await expect(service.del("a", "b")).resolves.toBe(2);
    expect(client.del).toHaveBeenCalledWith("a", "b");
  });

  it("incr delegates to the client", async () => {
    const { service, client } = buildService();

    await expect(service.incr("key")).resolves.toBe(1);
    expect(client.incr).toHaveBeenCalledWith("key");
  });

  it("incrBy delegates to the client", async () => {
    const { service, client } = buildService();
    client.incrby.mockResolvedValue(5);

    await expect(service.incrBy("key", 5)).resolves.toBe(5);
    expect(client.incrby).toHaveBeenCalledWith("key", 5);
  });

  it("expire delegates to the client", async () => {
    const { service, client } = buildService();

    await service.expire("key", 30);

    expect(client.expire).toHaveBeenCalledWith("key", 30);
  });

  it("onModuleDestroy quits the client", async () => {
    const { service, client } = buildService();

    await service.onModuleDestroy();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
