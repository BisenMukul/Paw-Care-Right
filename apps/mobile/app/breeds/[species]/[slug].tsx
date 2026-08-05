import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { BreedGuideSections } from "../../../src/components/breed-guide-sections";
import { EmptyState } from "../../../src/components/empty-state";
import { ScreenScaffold } from "../../../src/components/screen-scaffold";
import { VetDisclaimer } from "../../../src/components/vet-disclaimer";
import { parseSpeciesParam, resolveBreedGuideEntry } from "../../../src/content/breed-guide-content";
import { useNavBack } from "../../../src/hooks/use-nav-back";
import { strings } from "../../../src/strings";

/**
 * T087 plan step 6 — breed guide detail screen and deep-link target
 * (`bombaypetcompany://breeds/dog/labrador-retriever`). D2: the route is
 * `(species)/(slug)` because slugs are unique only WITHIN a species; a
 * single-segment route could resolve the wrong species' guide.
 *
 * Data is the frozen, published-only local dataset parsed at module load
 * (D6) — there is no loading/error/offline state to render, only the
 * not-found guard below (a draft/unknown slug never reaches guide content —
 * safety statement 4). Cold-start safe: everything renders from the URL
 * params plus local data, with no navigation state, store, or query read.
 * `<VetDisclaimer/>` renders unconditionally on this content-bearing screen
 * (D3) — the §5 component itself is untouched (D4).
 */
export default function BreedGuideDetailScreen() {
  const { species: rawSpecies, slug } = useLocalSearchParams<{ species?: string; slug?: string }>();
  const onBack = useNavBack("/breeds");

  const species = parseSpeciesParam(rawSpecies);
  if (species === null || slug === undefined || slug.length === 0) {
    return <Redirect href="/breeds" />;
  }

  const entry = resolveBreedGuideEntry(species, slug);

  if (entry === null) {
    return (
      <View testID="breed-guide-screen" className="flex-1">
        <ScreenScaffold onBack={onBack} scrollTestID="breed-guide-scroll">
          <EmptyState
            testID="breed-guide-not-found"
            icon="alert-circle-outline"
            title={strings.breedGuide.notFoundTitle}
            body={strings.breedGuide.notFoundBody}
            ctaLabel={strings.breedGuide.notFoundCta}
            ctaTestID="breed-guide-not-found-cta"
            onCtaPress={onBack}
          />
        </ScreenScaffold>
      </View>
    );
  }

  return (
    <View testID="breed-guide-screen" className="flex-1">
      <ScreenScaffold
        title={strings.breedGuide.title(entry.breedName)}
        onBack={onBack}
        scrollTestID="breed-guide-scroll"
      >
        <BreedGuideSections guide={entry.guide} />
        <VetDisclaimer />
      </ScreenScaffold>
    </View>
  );
}
