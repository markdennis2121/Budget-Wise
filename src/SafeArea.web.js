import React, { createContext } from 'react';
import { View } from 'react-native';

export const SafeAreaProvider = function(props) {
  return React.createElement(View, { style: Object.assign({ flex: 1 }, props.style) }, props.children);
};

export const useSafeAreaInsets = function() {
  return { top: 0, left: 0, right: 0, bottom: 0 };
};

export const useSafeAreaFrame = function() {
  return { x: 0, y: 0, width: typeof window !== 'undefined' ? window.innerWidth : 360, height: typeof window !== 'undefined' ? window.innerHeight : 640 };
};

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: typeof window !== 'undefined' ? window.innerWidth : 360, height: typeof window !== 'undefined' ? window.innerHeight : 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export const SafeAreaFrameContext = createContext({ x: 0, y: 0, width: 360, height: 640 });
export const SafeAreaInsetsContext = createContext({ top: 0, left: 0, right: 0, bottom: 0 });
