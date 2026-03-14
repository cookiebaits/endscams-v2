import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function copyPublicSafe(): import('vite').Plugin {
  return {
    name: 'copy-public-safe',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'public/images');
      const destDir = path.resolve(__dirname, 'dist/images');
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        if (file.includes(' ')) continue;
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        try {
          fs.copyFileSync(src, dest);
        } catch {
          // skip locked files
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPublicSafe()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    copyPublicDir: false,
  },
});
