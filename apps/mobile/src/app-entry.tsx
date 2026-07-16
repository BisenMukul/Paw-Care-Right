import React from 'react';
import { ExpoRoot } from 'expo-router';

export default function AppEntry() {
  const ctx = require.context('../app');
  return <ExpoRoot context={ctx} />;
}
