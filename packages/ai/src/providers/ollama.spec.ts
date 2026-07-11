import { OllamaTextProvider } from "./ollama-text";
import { OllamaVisionProvider } from "./ollama-vision";

const CANNED_RESPONSE = {
  model: "returned-model",
  choices: [{ message: { content: "hello from ollama" } }],
  usage: { prompt_tokens: 12, completion_tokens: 8 },
};

function mockFetchOnce(body: unknown): jest.SpyInstance {
  return jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("OllamaTextProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs to /v1/chat/completions with bearer auth and temperature 0 by default", async () => {
    const fetchSpy = mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaTextProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "test-model",
    });

    await provider.generate({ prompt: "hi" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.example/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(init.body as string) as {
      model: string;
      temperature: number;
      stream: boolean;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0);
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("prepends a system message when `system` is provided", async () => {
    const fetchSpy = mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaTextProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "test-model",
    });

    await provider.generate({ prompt: "hi", system: "be safe" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]).toEqual({ role: "system", content: "be safe" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
  });

  it("maps the response content, model, and usage", async () => {
    mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaTextProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "test-model",
    });

    const result = await provider.generate({ prompt: "hi" });

    expect(result.text).toBe("hello from ollama");
    expect(result.model).toBe("returned-model");
    expect(result.usage.inputTokens).toBe(12);
    expect(result.usage.outputTokens).toBe(8);
    expect(result.usage.totalTokens).toBe(20);
    expect(typeof result.usage.latencyMs).toBe("number");
  });
});

describe("OllamaVisionProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds a data URL image part from base64 + mimeType", async () => {
    const fetchSpy = mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaVisionProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "vision-model",
    });

    await provider.generate({
      prompt: "what is this",
      images: [{ base64: "YWJj", mimeType: "image/png" }],
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.example/v1/chat/completions");

    const body = JSON.parse(init.body as string) as {
      messages: {
        role: string;
        content: { type: string; text?: string; image_url?: { url: string } }[];
      }[];
    };
    expect(body.messages[0]?.role).toBe("user");
    expect(body.messages[0]?.content).toEqual([
      { type: "text", text: "what is this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } },
    ]);
  });

  it("uses the passed url directly when no base64 is given", async () => {
    const fetchSpy = mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaVisionProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "vision-model",
    });

    await provider.generate({
      prompt: "what is this",
      images: [{ url: "https://img.example/cat.png", mimeType: "image/png" }],
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: { content: { image_url?: { url: string } }[] }[];
    };
    expect(body.messages[0]?.content[1]?.image_url?.url).toBe(
      "https://img.example/cat.png",
    );
  });

  it("maps the response into a TextResult with usage", async () => {
    mockFetchOnce(CANNED_RESPONSE);
    const provider = new OllamaVisionProvider({
      baseUrl: "https://ollama.example",
      apiKey: "test-key",
      model: "vision-model",
    });

    const result = await provider.generate({
      prompt: "what is this",
      images: [{ base64: "YWJj", mimeType: "image/png" }],
    });

    expect(result.text).toBe("hello from ollama");
    expect(result.usage.inputTokens).toBe(12);
    expect(result.usage.outputTokens).toBe(8);
  });
});
