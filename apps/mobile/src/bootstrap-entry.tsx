import React from 'react';
import { Text, View } from 'react-native';
import AppEntry from './app-entry';

export const USE_MINIMAL_BOOTSTRAP = false;

export default function BootstrapEntry() {
  if (USE_MINIMAL_BOOTSTRAP) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'white',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600', textAlign: 'center' }}>Minimal RN app</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: '#4b5563', textAlign: 'center' }}>
          Start here while the full app bootstrap is being debugged.
        </Text>
      </View>
    );
  }

  return <AppEntry />;
}
