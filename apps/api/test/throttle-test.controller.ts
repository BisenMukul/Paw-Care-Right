import { Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../src/auth/auth.decorators";

// Test-only controller. Never imported by AppModule and excluded from
// tsconfig.build.json (so it never ships in production dist) — mirrors
// `test-throw.controller.ts` / `household-scoped-test.controller.ts`. It is
// injected directly into the Nest testing module by `security.e2e-spec.ts`
// to exercise a deterministic, tight 429 without touching the global
// default throttler (100/60s) that every other suite relies on.
@Public()
@Controller("__test__/throttle")
export class ThrottleTestController {
  @Get("ping")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  ping(): { ok: true } {
    return { ok: true };
  }
}
