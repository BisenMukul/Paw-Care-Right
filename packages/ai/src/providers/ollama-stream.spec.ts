import { ProviderError } from "./types";
import { OllamaTextProvider } from "./ollama-text";

function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
  });
}

function mockStreamResponse(chunks: readonly string[], status = 200): jest.SpyInstance {
  return jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(streamFromChunks(chunks), { status, headers: { "content-type": "text/event-stream" } }),
  );
}

async function collect(provider: OllamaTextProvider): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of provider.generateStream({ prompt: "hi" })) {
    out.push(chunk.text);
  }
  return out;
}

function provider(): OllamaTextProvider {
  return new OllamaTextProvider({ baseUrl: "https://ollama.example", apiKey: "test-key", model: "test-model" });
}

describe("OllamaTextProvider.generateStream", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("yields deltas in order", async () => {
    mockStreamResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const chunks = await collect(provider());
    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("reassembles a delta split across two network chunks", async () => {
    mockStreamResponse([
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const chunks = await collect(provider());
    expect(chunks).toEqual(["Hello"]);
  });

  it("ignores the terminal [DONE] line and stops cleanly after the stream closes", async () => {
    mockStreamResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', "data: [DONE]\n\n"]);

    const chunks = await collect(provider());
    expect(chunks).toEqual(["ok"]);
  });

  it("throws a ProviderError with code 'http_error' on a non-200 response", async () => {
    mockStreamResponse(["data: {}\n\n"], 500);

    await expect(collect(provider())).rejects.toMatchObject({
      constructor: ProviderError,
      code: "http_error",
    });
  });

  it("skips a malformed data: line rather than throwing", async () => {
    mockStreamResponse([
      "data: not-json\n\n",
      'data: {"choices":[{"delta":{"content":"still works"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const chunks = await collect(provider());
    expect(chunks).toEqual(["still works"]);
  });

  it("skips blank lines", async () => {
    mockStreamResponse(["\n", 'data: {"choices":[{"delta":{"content":"a"}}]}\n\n', "\n", "data: [DONE]\n\n"]);

    const chunks = await collect(provider());
    expect(chunks).toEqual(["a"]);
  });
});
