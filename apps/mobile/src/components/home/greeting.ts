export type GreetingKey = "morning" | "afternoon" | "evening";

/**
 * Time-based greeting bucket for the home tab header (founder UI overhaul):
 * device-local hour -> greeting key. 05:00-11:59 morning, 12:00-17:59
 * afternoon, everything else (18:00-04:59) evening. A pure function (not
 * reading `Date` itself) so tests can drive it with a plain number instead
 * of fake-timers gymnastics.
 */
export function greetingKeyForHour(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 18) {
    return "afternoon";
  }
  return "evening";
}
