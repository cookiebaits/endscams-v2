// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path from "path";
import fs from "fs";
var __vite_injected_original_dirname = "/home/project";
function copyPublicSafe() {
  return {
    name: "copy-public-safe",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const srcDir = path.resolve(__vite_injected_original_dirname, "public/images");
      const destDir = path.resolve(__vite_injected_original_dirname, "dist/images");
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        if (file.includes(" ")) continue;
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        try {
          fs.copyFileSync(src, dest);
        } catch {
        }
      }
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), copyPublicSafe()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    copyPublicDir: false
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5cbmZ1bmN0aW9uIGNvcHlQdWJsaWNTYWZlKCk6IGltcG9ydCgndml0ZScpLlBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2NvcHktcHVibGljLXNhZmUnLFxuICAgIGFwcGx5OiAnYnVpbGQnLFxuICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICBjbG9zZUJ1bmRsZSgpIHtcbiAgICAgIGNvbnN0IHNyY0RpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMvaW1hZ2VzJyk7XG4gICAgICBjb25zdCBkZXN0RGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2Rpc3QvaW1hZ2VzJyk7XG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc3JjRGlyKSkgcmV0dXJuO1xuICAgICAgZnMubWtkaXJTeW5jKGRlc3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZzLnJlYWRkaXJTeW5jKHNyY0RpcikpIHtcbiAgICAgICAgaWYgKGZpbGUuaW5jbHVkZXMoJyAnKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHNyYyA9IHBhdGguam9pbihzcmNEaXIsIGZpbGUpO1xuICAgICAgICBjb25zdCBkZXN0ID0gcGF0aC5qb2luKGRlc3REaXIsIGZpbGUpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzcmMsIGRlc3QpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBza2lwIGxvY2tlZCBmaWxlc1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGNvcHlQdWJsaWNTYWZlKCldLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICB9LFxuICBidWlsZDoge1xuICAgIGNvcHlQdWJsaWNEaXI6IGZhbHNlLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBSGYsSUFBTSxtQ0FBbUM7QUFLekMsU0FBUyxpQkFBd0M7QUFDL0MsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUztBQUFBLElBQ1QsY0FBYztBQUNaLFlBQU0sU0FBUyxLQUFLLFFBQVEsa0NBQVcsZUFBZTtBQUN0RCxZQUFNLFVBQVUsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFDckQsVUFBSSxDQUFDLEdBQUcsV0FBVyxNQUFNLEVBQUc7QUFDNUIsU0FBRyxVQUFVLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUN6QyxpQkFBVyxRQUFRLEdBQUcsWUFBWSxNQUFNLEdBQUc7QUFDekMsWUFBSSxLQUFLLFNBQVMsR0FBRyxFQUFHO0FBQ3hCLGNBQU0sTUFBTSxLQUFLLEtBQUssUUFBUSxJQUFJO0FBQ2xDLGNBQU0sT0FBTyxLQUFLLEtBQUssU0FBUyxJQUFJO0FBQ3BDLFlBQUk7QUFDRixhQUFHLGFBQWEsS0FBSyxJQUFJO0FBQUEsUUFDM0IsUUFBUTtBQUFBLFFBRVI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDO0FBQUEsRUFDbkMsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLEVBQ2pCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
