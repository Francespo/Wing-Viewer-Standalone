import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Static output: a replay viewer has no server. `npm run build` writes to
		// build/, servable by any static host or `npm run preview`.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
