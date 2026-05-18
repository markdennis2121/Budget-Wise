import * as RNWeb from 'react-native-web';

// Re-export everything from react-native-web
export * from 'react-native-web';

// Export stubs for native-only APIs that native packages attempt to import
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => null,
};

export default RNWeb;
