import { renderToStaticMarkup } from "react-dom/server";

import type { AdminAuditPage, AdminKpisResponse, AdminUserSummary } from "@bombaypetcompany/types";

import type { AdminFetchResult } from "../../admin/admin-api";
import { AdminAuditView } from "./admin-audit-view";
import { AdminKpisView } from "./admin-kpis-view";
import { AdminShell } from "./admin-shell";
import { AdminUserLookupView } from "./admin-user-lookup-view";

const PLANTED_SYMPTOM_TEXT = "vomiting since this morning, ate a whole chocolate bar";
const PLANTED_PET_NAME = "Fido Woofington";

function buildKpisResult(overrides: Partial<AdminKpisResponse> = {}): AdminFetchResult<AdminKpisResponse> {
  return {
    kind: "ok",
    data: {
      days: 30,
      generatedAt: "2026-07-30T00:00:00.000Z",
      daily: [
        {
          day: "2026-07-30",
          devicesCreated: 3,
          checksCreated: 5,
          checksDone: 3,
          checksFallback: 2,
          fallbackRate: 0.4,
          billingEventsProcessed: 1,
          subscriptionsUpdated: 1,
        },
        {
          day: "2026-07-29",
          devicesCreated: 1,
          checksCreated: 0,
          checksDone: 0,
          checksFallback: 0,
          fallbackRate: null,
          billingEventsProcessed: 0,
          subscriptionsUpdated: 0,
        },
      ],
      tiers: { totalUsers: 10, premiumSubscriptions: 2, expiredOrInactiveSubscriptions: 1, activeReferralGrants: 0 },
      ...overrides,
    },
  };
}

function buildAuditResult(overrides: Partial<AdminAuditPage> = {}): AdminFetchResult<AdminAuditPage> {
  return {
    kind: "ok",
    data: {
      rows: [
        {
          id: "audit-1",
          surface: "CHECK",
          checkId: "check-1",
          threadId: null,
          promptVersion: "v1",
          modelId: "model-1",
          detectorFlags: ["red_flag_hit"],
          costMicroUsd: 120,
          latencyMs: 800,
          status: "OK",
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      nextCursor: "audit-2",
      ...overrides,
    },
  };
}

function buildUserResult(overrides: Partial<AdminUserSummary> = {}): AdminFetchResult<AdminUserSummary> {
  return {
    kind: "ok",
    data: {
      userId: "user-1",
      email: "owner@bombaypetcompany.local",
      createdAt: "2026-01-01T00:00:00.000Z",
      locale: "en",
      region: "US",
      analyticsOptOut: false,
      deletionScheduledAt: null,
      householdIds: ["household-1"],
      entitlement: { entitled: true, source: "own", plan: "annual", expiresAt: null, billingIssue: false },
      counters: {
        pets: 2,
        symptomChecksTotal: 5,
        symptomChecksFallback: 1,
        chatThreads: 1,
        chatMessages: 3,
        reminders: 4,
        healthLogs: 6,
        devices: 1,
        feedbackReports: 0,
        accountExports: 0,
        referralGrantsActive: 0,
      },
      ...overrides,
    },
  };
}

const kpisMarkup = renderToStaticMarkup(<AdminKpisView result={buildKpisResult()} />);
const auditMarkup = renderToStaticMarkup(<AdminAuditView result={buildAuditResult()} />);
const userMarkup = renderToStaticMarkup(
  <AdminUserLookupView result={buildUserResult()} email="owner@bombaypetcompany.local" />,
);
const shellMarkup = renderToStaticMarkup(
  <AdminShell>
    <p>child</p>
  </AdminShell>,
);

describe("AdminKpisView", () => {
  it("renders the seeded day row", () => {
    expect(kpisMarkup).toContain("2026-07-30");
    expect(kpisMarkup).toContain("2026-07-29");
  });

  it("renders the em-dash placeholder for a null fallbackRate, never a fake 0%", () => {
    expect(kpisMarkup).toContain("—");
    // The zero-denominator day's row must not render a fake "0%" anywhere
    // (the negative lookbehind excludes "40%", the real, correct value).
    const zeroPercentOccurrences = (kpisMarkup.match(/(?<!\d)0%/g) ?? []).length;
    expect(zeroPercentOccurrences).toBe(0);
  });

  it("renders the 40% fallback rate for the populated day", () => {
    expect(kpisMarkup).toContain("40%");
  });

  it("renders the MRR-events limitation note and the installs-proxy caveat", () => {
    expect(kpisMarkup).toContain("event counts");
    expect(kpisMarkup).toContain("push-registration proxy");
  });

  it("does not render <VetDisclaimer/> (no §5 AI-result content on this surface)", () => {
    expect(kpisMarkup).not.toContain('data-testid="vet-disclaimer"');
  });
});

describe("AdminAuditView", () => {
  it("renders exactly the 11 pinned column headers", () => {
    const PINNED_COLUMNS = [
      "ID",
      "Surface",
      "Check ID",
      "Thread ID",
      "Prompt version",
      "Model",
      "Detector flags",
      "Cost (micro-USD)",
      "Latency (ms)",
      "Status",
      "Created",
    ];
    for (const column of PINNED_COLUMNS) {
      expect(auditMarkup).toContain(column);
    }
    const headerMatches = [...auditMarkup.matchAll(/<th>/g)];
    expect(headerMatches).toHaveLength(11);
  });

  it("contains none of a planted symptom-text/pet-name fixture (codes-only)", () => {
    const contaminated = renderToStaticMarkup(
      <AdminAuditView
        result={buildAuditResult({
          rows: [
            {
              id: "audit-2",
              surface: "CHECK",
              checkId: PLANTED_PET_NAME,
              threadId: null,
              promptVersion: "v1",
              modelId: "model-1",
              detectorFlags: [PLANTED_SYMPTOM_TEXT],
              costMicroUsd: 0,
              latencyMs: null,
              status: "OK",
              createdAt: "2026-07-30T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        })}
      />,
    );
    // Non-vacuity: the fixture DOES appear when planted directly into a
    // real field (proving the render isn't just failing to render at all) --
    // the actual production data never contains this (T090's schema
    // discipline), which is exactly the point this view depends on.
    expect(contaminated).toContain(PLANTED_PET_NAME);

    expect(auditMarkup).not.toContain(PLANTED_SYMPTOM_TEXT);
    expect(auditMarkup).not.toContain(PLANTED_PET_NAME);
  });

  it("the pagination link href carries the cursor", () => {
    expect(auditMarkup).toContain("cursor=audit-2");
  });

  it("renders no next-page link when nextCursor is null", () => {
    const lastPageMarkup = renderToStaticMarkup(<AdminAuditView result={buildAuditResult({ nextCursor: null })} />);
    expect(lastPageMarkup).not.toContain("cursor=");
  });

  it("does not render <VetDisclaimer/>", () => {
    expect(auditMarkup).not.toContain('data-testid="vet-disclaimer"');
  });
});

describe("AdminUserLookupView", () => {
  it("renders the counters", () => {
    expect(userMarkup).toContain("owner@bombaypetcompany.local");
    expect(userMarkup).toContain(">2<"); // pets counter value
  });

  it("renders a <form method=\"get\">", () => {
    expect(userMarkup).toContain('method="get"');
  });

  it("never renders a pet name (D4 scope exclusion)", () => {
    expect(userMarkup).not.toContain(PLANTED_PET_NAME);
  });

  it("renders the not-found state", () => {
    const notFoundMarkup = renderToStaticMarkup(
      <AdminUserLookupView result={{ kind: "not-found" }} email="nobody@example.com" />,
    );
    expect(notFoundMarkup).toContain("No user found");
  });

  it("renders the unconfigured state", () => {
    const unconfiguredMarkup = renderToStaticMarkup(
      <AdminUserLookupView result={{ kind: "unconfigured" }} email="x@example.com" />,
    );
    expect(unconfiguredMarkup).toContain("not configured");
  });

  it("renders the prompt state when no query has been submitted yet", () => {
    const promptMarkup = renderToStaticMarkup(<AdminUserLookupView result={null} email={undefined} />);
    expect(promptMarkup).toContain("Enter an email");
  });

  it("does not render <VetDisclaimer/>", () => {
    expect(userMarkup).not.toContain('data-testid="vet-disclaimer"');
  });
});

describe("AdminShell", () => {
  it("renders the three nav links and the internal/read-only note", () => {
    expect(shellMarkup).toContain('href="/admin"');
    expect(shellMarkup).toContain('href="/admin/users"');
    expect(shellMarkup).toContain('href="/admin/audit"');
    expect(shellMarkup).toContain("Internal, read-only");
  });

  it("does not render <VetDisclaimer/>", () => {
    expect(shellMarkup).not.toContain('data-testid="vet-disclaimer"');
  });
});
