import { GeminiImageProvider } from "./gemini-image";

const CANNED_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [{ inlineData: { data: "ZmFrZS1pbWFnZS1ieXRlcw==" } }],
      },
    },
  ],
  usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 7 },
};

function mockFetchOnce(body: unknown): jest.SpyInstance {
  return jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("GeminiImageProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs to the generateContent endpoint with the model + key in the URL", async () => {
    const fetchSpy = mockFetchOnce(CANNED_RESPONSE);
    const provider = new GeminiImageProvider({
      apiKey: "test-gemini-key",
      model: "test-image-model",
    });

    await provider.generateImage({ prompt: "a cat wearing a hat" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/test-image-model:generateContent?key=test-gemini-key",
    );
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string) as {
      contents: { parts: { text: string }[] }[];
      generationConfig: { responseModalities: string[] };
    };
    expect(body.contents).toEqual([{ parts: [{ text: "a cat wearing a hat" }] }]);
    expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"] });
  });

  it("extracts imageBase64 from candidates[0].content.parts[].inlineData.data", async () => {
    mockFetchOnce(CANNED_RESPONSE);
    const provider = new GeminiImageProvider({
      apiKey: "test-gemini-key",
      model: "test-image-model",
    });

    const result = await provider.generateImage({ prompt: "a cat" });

    expect(result.imageBase64).toBe("ZmFrZS1pbWFnZS1ieXRlcw==");
    expect(result.model).toBe("test-image-model");
    expect(result.usage.inputTokens).toBe(3);
    expect(result.usage.outputTokens).toBe(7);
  });

  it("leaves imageBase64 undefined when no inlineData part is present", async () => {
    mockFetchOnce({ candidates: [{ content: { parts: [] } }] });
    const provider = new GeminiImageProvider({
      apiKey: "test-gemini-key",
      model: "test-image-model",
    });

    const result = await provider.generateImage({ prompt: "a cat" });

    expect(result.imageBase64).toBeUndefined();
  });
});
