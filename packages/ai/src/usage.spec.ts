import { computeUsage, startTimer } from "./usage";

describe("startTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("measures elapsed time in milliseconds", () => {
    const timer = startTimer();

    jest.advanceTimersByTime(250);

    expect(timer.elapsedMs()).toBe(250);
  });
});

describe("computeUsage", () => {
  it("always includes the measured latency", () => {
    expect(computeUsage({ latencyMs: 42 }).latencyMs).toBe(42);
  });

  it("computes totalTokens from input+output tokens", () => {
    const usage = computeUsage({ latencyMs: 1, inputTokens: 10, outputTokens: 5 });

    expect(usage.totalTokens).toBe(15);
  });

  it("defaults costMicroUsd to 0 with no rates", () => {
    const usage = computeUsage({ latencyMs: 1, inputTokens: 10, outputTokens: 5 });

    expect(usage.costMicroUsd).toBe(0);
  });

  it("computes costMicroUsd from non-zero CostRates", () => {
    const usage = computeUsage({
      latencyMs: 1,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      rates: { costPerMInputUsd: 1, costPerMOutputUsd: 2 },
    });

    // 1M input tokens @ $1/M + 1M output tokens @ $2/M = $3 = 3_000_000 micro-USD
    expect(usage.costMicroUsd).toBe(3_000_000);
  });

  it("omits token fields entirely when neither is provided", () => {
    const usage = computeUsage({ latencyMs: 1 });

    expect(usage.inputTokens).toBeUndefined();
    expect(usage.outputTokens).toBeUndefined();
    expect(usage.totalTokens).toBeUndefined();
  });
});
