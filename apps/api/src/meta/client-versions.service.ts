import { Injectable } from "@nestjs/common";
import { clientVersionsResponseSchema, type ClientVersionsResponse } from "@bombaypetcompany/types";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

interface ClientVersionQueryRow {
  day: string;
  appVersion: string | null;
  otaUpdateId: string | null;
  deviceCount: number;
}

/**
 * T117 step 16: `/v1/meta/client-versions`'s one read-only aggregate
 * (docs/OTA_UPDATES.md §7). D5: this is a coarse cross-check over
 * push-registered `Device` rows only — PostHog `ota_applied` (§7) remains
 * the authoritative adoption curve, since a device's reported
 * `{appVersion, otaUpdateId}` pair is only as fresh as its last JIT push
 * registration, not a per-launch report.
 */
@Injectable()
export class ClientVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregate(days: number): Promise<ClientVersionsResponse> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Bound parameter (never string interpolation) — `Prisma.sql`'s tagged
    // template parameterizes every `${...}` interpolation automatically, so
    // this stays injection-safe even though the query is raw SQL (an
    // aggregate `GROUP BY` shape Prisma's query builder cannot express
    // directly against a nullable-grouped day bucket).
    const rows = await this.prisma.$queryRaw<ClientVersionQueryRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc('day', "lastSeenAt"), 'YYYY-MM-DD') AS day,
        "appVersion",
        "otaUpdateId",
        COUNT(*)::int AS "deviceCount"
      FROM "Device"
      WHERE "lastSeenAt" >= ${cutoff}
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC, 4 DESC
    `);

    const mapped = {
      days,
      generatedAt: new Date().toISOString(),
      rows: rows.map((row) => ({
        day: row.day,
        appVersion: row.appVersion,
        updateId: row.otaUpdateId,
        deviceCount: row.deviceCount,
      })),
    };

    return clientVersionsResponseSchema.parse(mapped);
  }
}
