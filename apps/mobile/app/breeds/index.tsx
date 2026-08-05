import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { EmptyState } from "../../src/components/empty-state";
import { ListRow } from "../../src/components/list-row";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { SectionHeader } from "../../src/components/section-header";
import { guideRouteParams, listPublishedBreedGuides } from "../../src/content/breed-guide-content";
import { useNavBack } from "../../src/hooks/use-nav-back";
import { strings } from "../../src/strings";

/**
 * T087 plan step 7 — breed guides explore list, grouped DOG then CAT
 * (`listPublishedBreedGuides`'s own sort). Static local dataset parsed at
 * module load (D6) — no loading/error/offline state applies; the only
 * guarded state is empty (untestable with today's 5 exemplars via real
 * data, so `breed-guide-explore.test.tsx` proves the branch is live via a
 * mocked-empty content module, R6). Reachable from Settings (D5) so it is
 * never dead code for the 45 of 50 breeds without a pet on this screen.
 */
export default function BreedGuidesExploreScreen() {
  const router = useRouter();
  const onBack = useNavBack("/(tabs)/settings");
  const entries = listPublishedBreedGuides();

  const dogEntries = entries.filter((entry) => entry.guide.species === "DOG");
  const catEntries = entries.filter((entry) => entry.guide.species === "CAT");

  function goToGuide(entry: (typeof entries)[number]) {
    router.push({ pathname: "/breeds/[species]/[slug]", params: guideRouteParams(entry) });
  }

  return (
    <View testID="breeds-explore-screen" className="flex-1">
      <ScreenScaffold
        title={strings.breedGuide.listTitle}
        subtitle={strings.breedGuide.listSubtitle}
        onBack={onBack}
        scrollTestID="breeds-explore-scroll"
      >
        {entries.length === 0 ? (
          <EmptyState
            testID="breeds-explore-empty"
            icon="book-outline"
            title={strings.breedGuide.emptyTitle}
            body={strings.breedGuide.emptyBody}
          />
        ) : (
          <>
            {dogEntries.length > 0 ? (
              <View testID="breeds-group-dog" className="gap-2">
                <SectionHeader title={strings.breedGuide.speciesGroup.DOG} />
                {dogEntries.map((entry) => (
                  <ListRow
                    key={entry.guide.slug}
                    testID={`breeds-row-dog-${entry.guide.slug}`}
                    title={entry.breedName}
                    leadingIcon="book-outline"
                    accessibilityLabel={strings.breedGuide.rowA11y(entry.breedName)}
                    onPress={() => goToGuide(entry)}
                  />
                ))}
              </View>
            ) : null}
            {catEntries.length > 0 ? (
              <View testID="breeds-group-cat" className="gap-2">
                <SectionHeader title={strings.breedGuide.speciesGroup.CAT} />
                {catEntries.map((entry) => (
                  <ListRow
                    key={entry.guide.slug}
                    testID={`breeds-row-cat-${entry.guide.slug}`}
                    title={entry.breedName}
                    leadingIcon="book-outline"
                    accessibilityLabel={strings.breedGuide.rowA11y(entry.breedName)}
                    onPress={() => goToGuide(entry)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
        <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.breedGuide.listNote}
        </Text>
      </ScreenScaffold>
    </View>
  );
}
