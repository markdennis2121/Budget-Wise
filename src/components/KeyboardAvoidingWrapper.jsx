import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';

const KeyboardAvoidingWrapper = function(props) {
  if (Platform.OS === 'web') {
    return React.createElement(View, { testID: props.testID, style: props.style }, props.children);
  }
  return React.createElement(KeyboardAvoidingView, props);
};

export default KeyboardAvoidingWrapper;
