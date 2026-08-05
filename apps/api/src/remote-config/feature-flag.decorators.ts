import { SetMetadata } from "@nestjs/common";
import type { FeatureKey } from "@bombaypetcompany/types";

/**
 * T106 — metadata key read by `FeatureFlagGuard`. `@RequiresFeature(key)`
 * can be placed on a single handler or on a whole controller class; the
 * guard reads handler metadata first, falling back to class metadata
 * (`Reflector.getAllAndOverride`), so a method-level flag always wins.
 */
export const FEATURE_FLAG_METADATA = "feature-flag:requires";

export const RequiresFeature = (key: FeatureKey): MethodDecorator & ClassDecorator =>
  SetMetadata(FEATURE_FLAG_METADATA, key);
