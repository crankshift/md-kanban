import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'chakra',
              test: /node_modules[\\/]@(chakra-ui|zag-js|ark-ui|emotion|floating-ui|pandacss|internationalized)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
