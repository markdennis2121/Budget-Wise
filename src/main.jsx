import { AppRegistry } from 'react-native';
import ComponentFunction from './ComponentFunction';

// Register the main application component
AppRegistry.registerComponent('BudgetApp', () => ComponentFunction);

// Mount it to the #root element
AppRegistry.runApplication('BudgetApp', {
  initialProps: {},
  rootTag: document.getElementById('root'),
});
