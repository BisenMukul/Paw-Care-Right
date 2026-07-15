import { Image } from "expo-image";
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, Text, View } from "react-native";

import type { PhotoViewItem } from "../api/pet-photos-api";
import { usePhotoViewUrls } from "../api/pet-photos-api";
import { strings } from "../strings";

export interface TimelinePhotoViewerProps {
  visible: boolean;
  petId: string;
  photoKeys: string[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Full-screen photo viewer (T069 plan) -- an in-screen `Modal` overlay with
 * a horizontally-paged `FlatList` (no new route, no lightbox dependency).
 * Shares `usePhotoViewUrls`'s query key with `TimelinePhotoStrip`, so it
 * reuses the strip's already-cached URLs instantly. Every page and the
 * close control carry a meaningful accessibility label (the AC) -- CLAUDE
 * §7: photos are records only, no interpretive copy.
 */
export function TimelinePhotoViewer({ visible, petId, photoKeys, initialIndex, onClose }: TimelinePhotoViewerProps) {
  const { data, isLoading } = usePhotoViewUrls(petId, photoKeys);
  const items = data?.items ?? [];
  const pageWidth = Dimensions.get("window").width;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID="timeline-photo-viewer">
      <View className="flex-1 bg-black">
        <Pressable
          testID="timeline-photo-viewer-close"
          accessibilityRole="button"
          accessibilityLabel={strings.timeline.photoViewerClose}
          onPress={onClose}
          className="absolute right-4 top-12 z-10"
        >
          <Text className="text-lg font-semibold text-white">{"✕"}</Text>
        </Pressable>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator testID="timeline-photo-viewer-loading" color="#ffffff" />
          </View>
        ) : items.length > 0 ? (
          <FlatList
            testID="timeline-photo-viewer-list"
            data={items}
            horizontal
            pagingEnabled
            initialScrollIndex={initialIndex}
            getItemLayout={(_data, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
            keyExtractor={(item: PhotoViewItem) => item.key}
            renderItem={({ item, index }: { item: PhotoViewItem; index: number }) => (
              <View
                testID={`timeline-photo-viewer-page-${index}`}
                accessibilityLabel={strings.timeline.photoViewerPageA11y(index + 1, items.length)}
                style={{ width: pageWidth }}
                className="items-center justify-center"
              >
                <Image
                  testID={`timeline-photo-viewer-image-${index}`}
                  source={{ uri: item.mainUrl }}
                  contentFit="contain"
                  style={{ width: pageWidth, height: pageWidth }}
                />
              </View>
            )}
          />
        ) : null}
      </View>
    </Modal>
  );
}
