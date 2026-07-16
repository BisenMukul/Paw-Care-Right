import { Text, View } from 'react-native';

export default function TestApp() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>Native test app</Text>
      <Text style={{ marginTop: 8, fontSize: 16, color: '#444' }}>If this appears, the native shell is fine.</Text>
    </View>
  );
}
