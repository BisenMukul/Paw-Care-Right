import type { ImageResult, TextResult } from "../types";
import {
  FakeImageProvider,
  FakeTextProvider,
  FakeVisionProvider,
} from "./index";

describe("FakeTextProvider", () => {
  it("returns the canned response and never calls fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const provider = new FakeTextProvider();

    const result = await provider.generate({ prompt: "hello" });

    expect(result.text).toBe("fake text provider response");
    expect(result.model).toBe("fake-text-model");
    expect(result.usage).toEqual({
      latencyMs: 1,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      costMicroUsd: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("returns a custom canned response when provided", async () => {
    const canned: TextResult = {
      text: "custom",
      model: "custom-model",
      usage: { latencyMs: 5 },
    };
    const provider = new FakeTextProvider({ canned });

    await expect(provider.generate({ prompt: "hi" })).resolves.toEqual(canned);
  });

  it("consumes a scripted sequence in order", async () => {
    const script: TextResult[] = [
      { text: "first", model: "m", usage: { latencyMs: 1 } },
      { text: "second", model: "m", usage: { latencyMs: 1 } },
    ];
    const provider = new FakeTextProvider({ script });

    await expect(provider.generate({ prompt: "1" })).resolves.toEqual(script[0]);
    await expect(provider.generate({ prompt: "2" })).resolves.toEqual(script[1]);
  });

  it("throws once the scripted sequence is exhausted", async () => {
    const provider = new FakeTextProvider({
      script: [{ text: "only", model: "m", usage: { latencyMs: 1 } }],
    });

    await provider.generate({ prompt: "1" });

    await expect(provider.generate({ prompt: "2" })).rejects.toThrow(/exhausted/);
  });
});

describe("FakeVisionProvider", () => {
  it("returns the canned response and never calls fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const provider = new FakeVisionProvider();

    const result = await provider.generate({
      prompt: "what is this",
      images: [{ base64: "abc", mimeType: "image/png" }],
    });

    expect(result.text).toBe("fake vision provider response");
    expect(result.usage.latencyMs).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("consumes a scripted sequence in order", async () => {
    const script: TextResult[] = [
      { text: "first", model: "m", usage: { latencyMs: 1 } },
      { text: "second", model: "m", usage: { latencyMs: 1 } },
    ];
    const provider = new FakeVisionProvider({ script });
    const options = { prompt: "p", images: [] };

    await expect(provider.generate(options)).resolves.toEqual(script[0]);
    await expect(provider.generate(options)).resolves.toEqual(script[1]);
  });
});

describe("FakeImageProvider", () => {
  it("returns the canned response and never calls fetch", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const provider = new FakeImageProvider();

    const result = await provider.generateImage({ prompt: "a cat" });

    expect(result.imageBase64).toBe("ZmFrZS1pbWFnZS1ieXRlcw==");
    expect(result.model).toBe("fake-image-model");
    expect(result.usage.latencyMs).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("consumes a scripted sequence in order", async () => {
    const script: ImageResult[] = [
      { imageBase64: "first", model: "m", usage: { latencyMs: 1 } },
      { imageBase64: "second", model: "m", usage: { latencyMs: 1 } },
    ];
    const provider = new FakeImageProvider({ script });

    await expect(provider.generateImage({ prompt: "p" })).resolves.toEqual(script[0]);
    await expect(provider.generateImage({ prompt: "p" })).resolves.toEqual(script[1]);
  });
});
