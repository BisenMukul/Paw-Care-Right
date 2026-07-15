import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { usePhotoViewUrls } from "../api/pet-photos-api";
import { strings } from "../strings";

export interface TimelinePhotoStripProps {
  petId: string;
  entryId: string;
  photoKeys: string[];
  kindLabel: string;
  date: string;
  onOpenPhoto: (args: { petId: string; photoKeys: string[]; index: number }) => void;
}

/**
 * Thumbnail strip for a timeline row's `photoKeys` (T069 plan). A
 * *separately* memoized component so its `usePhotoViewUrls` query resolving
 * never re-invokes `TimelineRow`'s body / `getKindDisplay` (T067's
 * render-count AC, plan decision 4) -- only this strip re-renders when the
 * URLs land. Each tile degrades to a neutral placeholder (never a crash)
 * while the query is pending, on error, or when a key's rendition isn't
 * present in the response yet (worker not finished) -- CLAUDE §7: photos are
 * records only, no interpretive copy.
 */
export const TimelinePhotoStrip = memo(function TimelinePhotoStrip({
  petId,
  entryId,
  photoKeys,
  kindLabel,
  date,
  onOpenPhoto,
}: TimelinePhotoStripProps) {
  const { data } = usePhotoViewUrls(petId, photoKeys);

  return (
    <View className="flex-row flex-wrap gap-2 pt-2">
      {photoKeys.map((key, index) => {
        const item = data?.items.find((candidate) => candidate.key === key);
        return (
          <Pressable
            key={key}
            testID={`timeline-photo-thumb-${entryId}-${index}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={strings.timeline.photoThumbA11y(index + 1, photoKeys.length, kindLabel, date)}
            onPress={() => onOpenPhoto({ petId, photoKeys, index })}
          >
            {item !== undefined ? (
              <Image
                testID={`timeline-photo-thumb-image-${entryId}-${index}`}
                source={{ uri: item.thumbUrl }}
                className="h-16 w-16 rounded-md"
              />
            ) : (
              <View
                testID={`timeline-photo-thumb-placeholder-${entryId}-${index}`}
                className="h-16 w-16 rounded-md bg-brand-100"
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
});
