import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5199,
		// Development: the Rust server owns /api. Production serves web/build.
		proxy: { '/api': 'http://127.0.0.1:8787' }
	}
});
