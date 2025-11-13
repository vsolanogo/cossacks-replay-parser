import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: 'index.html',
      precompress: false,
    }),
    paths: {
      base: "/cossacks-replay-parser",
    }, 
  },
};

export default config;
