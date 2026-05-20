import { AppRegistry } from 'react-native';
import ComponentFunction from './ComponentFunction';

// Suppress harmless react-native-web deprecation warnings for a clean console
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('"shadow*" style props are deprecated')) return;
  if (args[0] && typeof args[0] === 'string' && args[0].includes('props.pointerEvents is deprecated')) return;
  originalWarn(...args);
};

// Register the main application component
AppRegistry.registerComponent('BudgetApp', () => ComponentFunction);

// Mount it to the #root element
AppRegistry.runApplication('BudgetApp', {
  initialProps: {},
  rootTag: document.getElementById('root'),
});
