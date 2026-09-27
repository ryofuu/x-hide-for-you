import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome120',
    lib: {
      entry: 'src/content/index.ts',
      name: 'XHideForYou',
      formats: ['iife'],
      fileName: () => 'content.js',
      cssFileName: 'content',
    },
  },
});
