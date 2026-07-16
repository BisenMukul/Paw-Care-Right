import { Text, View } from "react-native";

export default function StartupSafeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "600", textAlign: "center" }}>Paw Care Right</Text>
      <Text style={{ marginTop: 8, fontSize: 16, color: "#444", textAlign: "center" }}>
        Starting up safely. If this appears, the app shell is loading.
      </Text>
    </View>
  );
}
