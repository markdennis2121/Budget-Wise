import { View } from 'react-native-web';

export default function codegenNativeComponent(name, options) {
  // In web, just return the View or a string component name
  return View;
}

export function codegenNativeCommands(options) {
  return {};
}
