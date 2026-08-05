/**
 * T100 plan step 16 (§6 AC2-a) -- proves the screenshot kit mechanically
 * produces the 8-shot set x 4 device profiles from captures. Inputs are
 * synthesized in-memory with this kit's own encoder and written to a real
 * `mkdtempSync(tmpdir())` directory -- never inside the repo, never a
 * committed binary fixture. Full-resolution compositing is exercised for
 * ONE shot across all 4 real profiles (plan D8); the full 8-shot set is
 * additionally exercised at a `/10`-scaled profile list derived from the
 * same table, to keep this fast.
 */
export {};

declare const __dirname: string;

interface DirEntry {
  name: string;
  isFile(): boolean;
}
interface NodeFs {
  mkdtempSync(prefix: string): string;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: Uint8Array | string): void;
  readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}
interface NodePath {
  join(...parts: string[]): string;
}
interface NodeOs {
  tmpdir(): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors store-assets/generate-assets.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const os = require("node:os") as NodeOs;

import { composeShotSet } from "../store-assets/tools/compose";
import { storeMarketing } from "../store-assets/marketing-strings";
import { encodePng } from "../store-assets/tools/png-encode";
import { decodePng, readPngHeader } from "../store-assets/tools/png-decode";
import { DEVICE_PROFILES, SHOT_SET, type DeviceProfile } from "../store-assets/tools/screenshot-profiles";

const APP_ROOT = path.join(__dirname, "..", "app");

/** `/10`-scaled profile list (plan D8) -- exercises all 8 shots without a full-resolution 8x4 sweep. */
const SCALED_PROFILES: readonly DeviceProfile[] = DEVICE_PROFILES.map((profile) => ({
  ...profile,
  width: Math.round(profile.width / 10),
  height: Math.round(profile.height / 10),
}));

function makeCapturePng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 100;
    rgba[i + 1] = 150;
    rgba[i + 2] = 200;
    rgba[i + 3] = 255;
  }
  return encodePng(rgba, width, height, { alpha: false });
}

function writeAllCaptures(inputDir: string): void {
  fs.mkdirSync(inputDir, { recursive: true });
  for (const shot of SHOT_SET) {
    fs.writeFileSync(path.join(inputDir, `${shot.id}.png`), makeCapturePng(400, 800));
  }
}

const ROUTE_TO_FILE: Readonly<Record<string, string>> = {
  "/(tabs)": path.join(APP_ROOT, "(tabs)", "index.tsx"),
  "/(tabs)/care": path.join(APP_ROOT, "(tabs)", "care.tsx"),
  "/(tabs)/timeline": path.join(APP_ROOT, "(tabs)", "timeline.tsx"),
  "/check": path.join(APP_ROOT, "check", "index.tsx"),
  "/check/result/[checkId]": path.join(APP_ROOT, "check", "result", "[checkId].tsx"),
  "/chat": path.join(APP_ROOT, "chat", "index.tsx"),
  "/paywall": path.join(APP_ROOT, "paywall.tsx"),
};

describe("store-assets screenshot kit", () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "t100-screenshot-kit-"));
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("SHOT_SET has exactly 8 ordered shots with unique ids and real routes", () => {
    expect(SHOT_SET.length).toBe(8);
    const ids = SHOT_SET.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(8);
    expect(SHOT_SET.map((shot) => shot.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const shot of SHOT_SET) {
      const file = ROUTE_TO_FILE[shot.route];
      expect(file).toBeDefined();
      expect(fs.existsSync(file!)).toBe(true);
    }
  });

  it('the profile table pins the store dimensions for 6.7", 6.1", 5.5" and Android', () => {
    expect(DEVICE_PROFILES.find((p) => p.id === "ios-6-7")).toMatchObject({ width: 1290, height: 2796, store: "app-store" });
    expect(DEVICE_PROFILES.find((p) => p.id === "ios-6-1")).toMatchObject({ width: 1179, height: 2556, store: "app-store" });
    expect(DEVICE_PROFILES.find((p) => p.id === "ios-5-5")).toMatchObject({ width: 1242, height: 2208, store: "app-store" });
    expect(DEVICE_PROFILES.find((p) => p.id === "android-phone")).toMatchObject({ width: 1080, height: 1920, store: "play-store" });
  });

  it("produces one framed PNG per shot for the full 8-shot set", () => {
    const inputDir = path.join(tmpRoot, "raw-full-set");
    const outputDir = path.join(tmpRoot, "out-full-set");
    writeAllCaptures(inputDir);

    const written = composeShotSet({
      inputDir,
      outputDir,
      profiles: [SCALED_PROFILES[0]!],
      shots: SHOT_SET,
      marketing: storeMarketing,
      fs,
      decodePng,
      encodePng,
      joinPath: (...parts) => path.join(...parts),
    });

    for (const shot of SHOT_SET) {
      const pngPath = path.join(outputDir, SCALED_PROFILES[0]!.id, `${shot.id}.png`);
      expect(written).toContain(pngPath);
      expect(fs.existsSync(pngPath)).toBe(true);
    }
  });

  it("writes output at the exact profile dimensions for every real profile (one shot)", () => {
    const inputDir = path.join(tmpRoot, "raw-one-shot");
    const outputDir = path.join(tmpRoot, "out-one-shot");
    fs.mkdirSync(inputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, "01-home.png"), makeCapturePng(300, 650));

    composeShotSet({
      inputDir,
      outputDir,
      profiles: DEVICE_PROFILES,
      shots: [SHOT_SET[0]!],
      marketing: storeMarketing,
      fs,
      decodePng,
      encodePng,
      joinPath: (...parts) => path.join(...parts),
    });

    for (const profile of DEVICE_PROFILES) {
      const pngPath = path.join(outputDir, profile.id, "01-home.png");
      const header = readPngHeader(fs.readFileSync(pngPath));
      expect(header.width).toBe(profile.width);
      expect(header.height).toBe(profile.height);
    }
  });

  it("writes a caption sidecar per shot and a combined copy-blocks.md", () => {
    const inputDir = path.join(tmpRoot, "raw-captions");
    const outputDir = path.join(tmpRoot, "out-captions");
    writeAllCaptures(inputDir);

    composeShotSet({
      inputDir,
      outputDir,
      profiles: [SCALED_PROFILES[0]!],
      shots: SHOT_SET,
      marketing: storeMarketing,
      fs,
      decodePng,
      encodePng,
      joinPath: (...parts) => path.join(...parts),
    });

    for (const shot of SHOT_SET) {
      const txtPath = path.join(outputDir, SCALED_PROFILES[0]!.id, `${shot.id}.txt`);
      const text = fs.readFileSync(txtPath, "utf8") as string;
      const copy = storeMarketing.en.shots[shot.captionKey as keyof typeof storeMarketing.en.shots];
      expect(text).toContain(copy.headline);
      expect(text).toContain(copy.subhead);
      expect(text).toContain(storeMarketing.en.disclosure);
    }

    const copyBlocks = fs.readFileSync(path.join(outputDir, "copy-blocks.md"), "utf8") as string;
    for (const shot of SHOT_SET) {
      expect(copyBlocks).toContain(shot.id);
    }
    expect(copyBlocks).toContain(storeMarketing.en.disclosure);
  });

  it("throws naming the missing capture path when an input is absent", () => {
    const inputDir = path.join(tmpRoot, "raw-missing");
    const outputDir = path.join(tmpRoot, "out-missing");
    fs.mkdirSync(inputDir, { recursive: true });
    // Deliberately do not write any capture files.

    expect(() =>
      composeShotSet({
        inputDir,
        outputDir,
        profiles: [SCALED_PROFILES[0]!],
        shots: [SHOT_SET[0]!],
        marketing: storeMarketing,
        fs,
        decodePng,
        encodePng,
        joinPath: (...parts) => path.join(...parts),
      }),
    ).toThrow(new RegExp(`${SHOT_SET[0]!.id}\\.png`));
  });
});
