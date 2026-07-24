/**
 * Auto-scroll-pin helper (T083 plan decision D11). The screen pins the
 * transcript scroll view to the bottom while streaming ONLY while the user
 * has not scrolled away — an `onScroll` handler feeds these numbers (RN's
 * `NativeScrollEvent` shape) into this PURE function, and a
 * `userPinnedToBottom` ref gates the `scrollToEnd` call. Kept as a pure
 * helper (rather than asserted through simulated native scroll metrics,
 * which RNTL cannot produce) so it's directly unit-testable (plan R9).
 */

export const NEAR_BOTTOM_THRESHOLD_PX = 80;

export interface NearBottomArgs {
  contentHeight: number;
  layoutHeight: number;
  offsetY: number;
}

export function isNearBottom({ contentHeight, layoutHeight, offsetY }: NearBottomArgs): boolean {
  const distanceFromBottom = contentHeight - layoutHeight - offsetY;
  return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
}
