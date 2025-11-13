import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "dist/stats.html", // Output file
      open: true, // Automatically open the report in your browser
      gzipSize: true, // Show gzipped sizes
    }),
  ],
  build: {
    target: "es2019",
    minify: "terser",
    terserOptions: {
      compress: {
        // Remove console.log, console.info, etc.
        drop_console: true,
        // Remove debugger statements
        drop_debugger: true,
        // Remove specific function calls (more granular than drop_console)
        // pure_funcs: ['console.log', 'console.info'],
      },
      format: {
        comments: false, // Remove all comments
      },
    },
  },
  base: '/cossacks-replay-parser/',
});
