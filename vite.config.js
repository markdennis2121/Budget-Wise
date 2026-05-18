import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  resolve: {
    extensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      'react-native/Libraries/Utilities/codegenNativeComponent': fileURLToPath(new URL('./src/codegen-stub.js', import.meta.url)),
      'react-native/Libraries/Utilities/codegenNativeCommands': fileURLToPath(new URL('./src/codegen-stub.js', import.meta.url)),
      'react-native': fileURLToPath(new URL('./src/react-native-web-wrapper.js', import.meta.url)),
      '@expo/vector-icons': fileURLToPath(new URL('./src/vector-icons-mock.jsx', import.meta.url)),
      'platform-hooks': fileURLToPath(new URL('./src/platform-hooks.js', import.meta.url)),
      'react-native-safe-area-context': fileURLToPath(new URL('./src/SafeArea.web.js', import.meta.url)),
    },
  },
});
