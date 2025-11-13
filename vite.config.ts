import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    sveltekit(),
    visualizer({
      filename: "dist/stats.html",
      open: true,
      gzipSize: true,
    }),
  ],
  // build: {
  //   target: "es2019",
  //   minify: "terser",
  //   // terserOptions: {
  //   //   compress: {
  //   //     drop_console: true,
  //   //     drop_debugger: true,
  //   //   },
  //   //   format: {
  //   //     comments: false,
  //   //   },
  //   // },
  // },
});