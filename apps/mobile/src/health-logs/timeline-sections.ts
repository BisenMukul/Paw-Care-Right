import type { TimelineItem } from "../api/health-logs-api";

export interface TimelineSection {
  title: string;
  data: TimelineItem[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Device-local `YYYY-MM` bucket key — NOT UTC (T067 plan decision 7). */
function localMonthKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/**
 * Groups a newest-first health-timeline feed into device-local-month
 * sections (T067 plan decision 7), preserving both the section order and
 * the item order within each section exactly as given. The feed is already
 * sorted newest-first by the server (`HealthLogsService.list`, T064), so
 * items sharing a month are always contiguous — this groups by consecutive
 * run rather than re-sorting or bucketing into a map (pure, no React).
 */
export function groupTimelineByMonth(items: TimelineItem[]): TimelineSection[] {
  const sections: TimelineSection[] = [];

  for (const item of items) {
    const title = localMonthKey(item.occurredAt);
    const current = sections[sections.length - 1];
    if (current !== undefined && current.title === title) {
      current.data.push(item);
    } else {
      sections.push({ title, data: [item] });
    }
  }

  return sections;
}
