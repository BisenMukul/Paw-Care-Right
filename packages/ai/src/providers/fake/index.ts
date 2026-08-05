import type {
  ImageGenerateOptions,
  ImageProvider,
  ImageResult,
  ProviderUsage,
  TextGenerateOptions,
  TextProvider,
  TextResult,
  TextStreamChunk,
  VisionGenerateOptions,
  VisionProvider,
} from "../types";

/** Deterministic usage shared by every fake provider — fixed, no `Date.now()`. */
const FAKE_USAGE: ProviderUsage = {
  latencyMs: 1,
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  costMicroUsd: 0,
};

export interface FakeTextProviderOptions {
  /** Fixed canned response used when no script is provided. */
  canned?: TextResult;
  /** Scripted sequence consumed in order, one entry per `generate()` call. */
  script?: TextResult[];
  /** When set, `generateStream` yields these chunks in order (T081 plan decision D3). */
  streamChunks?: string[];
  /** When set, thrown (rejected) after `streamChunks` has been fully yielded. */
  streamError?: Error;
}

const DEFAULT_CANNED_TEXT: TextResult = {
  text: "fake text provider response",
  model: "fake-text-model",
  usage: FAKE_USAGE,
};

/** Deterministic, no-network `TextProvider` for tests/CI and the T040 eval harness. */
export class FakeTextProvider implements TextProvider {
  private readonly canned: TextResult;
  private readonly script: TextResult[] | undefined;
  private readonly streamChunks: string[] | undefined;
  private readonly streamError: Error | undefined;
  private cursor = 0;

  /**
   * `generateStream` (T081 plan decision D3) is assigned as an instance
   * property, and ONLY when `streamChunks` is configured — so a fake built
   * with no `streamChunks` has no `generateStream` at all (`undefined`,
   * `typeof` !== `"function"`), exactly like a real `TextProvider` that
   * never implemented the optional method. This lets `ChatService`'s
   * feature-detection fallback path be exercised with a plain
   * `new FakeTextProvider()`.
   */
  generateStream?: (options: TextGenerateOptions) => AsyncGenerator<TextStreamChunk>;

  constructor(options: FakeTextProviderOptions = {}) {
    this.canned = options.canned ?? DEFAULT_CANNED_TEXT;
    this.script = options.script;
    this.streamChunks = options.streamChunks;
    this.streamError = options.streamError;

    if (options.streamChunks) {
      this.generateStream = this.streamScriptedChunks.bind(this);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generate(_options: TextGenerateOptions): Promise<TextResult> {
    if (this.script) {
      const next = this.script[this.cursor];
      if (next === undefined) {
        return Promise.reject(
          new Error("FakeTextProvider: scripted sequence exhausted"),
        );
      }
      this.cursor += 1;
      return Promise.resolve(next);
    }

    return Promise.resolve(this.canned);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async *streamScriptedChunks(_options: TextGenerateOptions): AsyncGenerator<TextStreamChunk> {
    for (const text of this.streamChunks ?? []) {
      yield { text };
    }

    if (this.streamError) {
      throw this.streamError;
    }
  }
}

export interface FakeVisionProviderOptions {
  canned?: TextResult;
  script?: TextResult[];
}

const DEFAULT_CANNED_VISION: TextResult = {
  text: "fake vision provider response",
  model: "fake-vision-model",
  usage: FAKE_USAGE,
};

/** Deterministic, no-network `VisionProvider` for tests/CI and the T040 eval harness. */
export class FakeVisionProvider implements VisionProvider {
  private readonly canned: TextResult;
  private readonly script: TextResult[] | undefined;
  private cursor = 0;

  constructor(options: FakeVisionProviderOptions = {}) {
    this.canned = options.canned ?? DEFAULT_CANNED_VISION;
    this.script = options.script;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generate(_options: VisionGenerateOptions): Promise<TextResult> {
    if (this.script) {
      const next = this.script[this.cursor];
      if (next === undefined) {
        return Promise.reject(
          new Error("FakeVisionProvider: scripted sequence exhausted"),
        );
      }
      this.cursor += 1;
      return Promise.resolve(next);
    }

    return Promise.resolve(this.canned);
  }
}

export interface FakeImageProviderOptions {
  canned?: ImageResult;
  script?: ImageResult[];
}

const DEFAULT_CANNED_IMAGE: ImageResult = {
  imageBase64: "ZmFrZS1pbWFnZS1ieXRlcw==",
  model: "fake-image-model",
  usage: FAKE_USAGE,
};

/** Deterministic, no-network `ImageProvider` for tests/CI and the T040 eval harness. */
export class FakeImageProvider implements ImageProvider {
  private readonly canned: ImageResult;
  private readonly script: ImageResult[] | undefined;
  private cursor = 0;

  constructor(options: FakeImageProviderOptions = {}) {
    this.canned = options.canned ?? DEFAULT_CANNED_IMAGE;
    this.script = options.script;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateImage(_options: ImageGenerateOptions): Promise<ImageResult> {
    if (this.script) {
      const next = this.script[this.cursor];
      if (next === undefined) {
        return Promise.reject(
          new Error("FakeImageProvider: scripted sequence exhausted"),
        );
      }
      this.cursor += 1;
      return Promise.resolve(next);
    }

    return Promise.resolve(this.canned);
  }
}
