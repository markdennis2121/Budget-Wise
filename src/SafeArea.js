import React from 'react';
import { View, Platform } from 'react-native';
import * as NativeSafeArea from 'react-native-safe-area-context';

export const SafeAreaProvider = function(props) {
  if (Platform.OS === 'web') {
    return React.createElement(View, { style: Object.assign({ flex: 1 }, props.style) }, props.children);
  }
  return React.createElement(NativeSafeArea.SafeAreaProvider, props);
};

export const useSafeAreaInsets = function() {
  if (Platform.OS === 'web') {
    return { top: 0, left: 0, right: 0, bottom: 0 };
  }
  return NativeSafeArea.useSafeAreaInsets();
};
