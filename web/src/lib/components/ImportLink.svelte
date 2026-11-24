<script lang="ts">
	/**
	 * Fetch an XWS squad from a URL and hand the raw text to the page.
	 * The page owns the paste boxes; this component owns only the network read,
	 * the size/type gate, and any error shown next to its own input.
	 */
	import { parseXwsPreview } from '$lib/xws-preview';

	let {
		value = $bindable(''),
		onImport,
		label = 'Import link'
	}: {
		value?: string;
		onImport: (raw: string) => void;
		label?: string;
	} = $props();

	const MAX_BYTES = 1_000_000;
	const TIMEOUT_MS = 8_000;

	let error = $state<string | null>(null);
	let busy = $state(false);

	function isAbort(err: unknown): boolean {
		// DOMException is not an Error subclass in every engine.
		return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
	}

	function isNetwork(err: unknown): boolean {
		return (
			err instanceof TypeError ||
			(err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message))
		);
	}

	async function run() {
		error = null;
		const rawUrl = value.trim();
		if (!rawUrl) {
			error = 'enter a link first';
			return;
		}

		let target: URL;
		try {
			target = new URL(rawUrl);
		} catch {
			error = 'that is not a valid link';
			return;
		}
		if (target.protocol !== 'http:' && target.protocol !== 'https:') {
			error = 'only http and https links are allowed';
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		busy = true;
		try {
			const response = await fetch(target.href, { signal: controller.signal });
			if (!response.ok) throw new Error(`link returned HTTP ${response.status}`);

			const declared = Number(response.headers.get('content-length'));
			if (Number.isFinite(declared) && declared > MAX_BYTES) {
				throw new Error('link is over 1 MB — paste the JSON instead');
			}
			const text = await response.text();
			if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
				throw new Error('link is over 1 MB — paste the JSON instead');
			}

			// Reuse the renderer's parser as the gate; no legality is decided here.
			const preview = parseXwsPreview(text);
			if (!preview.ok) throw new Error(`link did not contain XWS JSON (${preview.reason})`);

			onImport(text);
			value = '';
		} catch (err) {
			if (isAbort(err)) error = 'link took too long to respond — paste the JSON instead';
			else if (isNetwork(err)) error = 'link did not allow reading — paste the JSON instead';
			else error = err instanceof Error ? err.message : String(err);
		} finally {
			clearTimeout(timer);
			busy = false;
		}
	}
</script>

<form
	class="mt-1 flex flex-wrap items-center gap-1"
	onsubmit={(event) => {
		event.preventDefault();
		void run();
	}}
>
	<input
		type="url"
		bind:value
		placeholder="https://…/squad.json"
		aria-label="XWS squad link"
		spellcheck="false"
		class="min-w-0 flex-1 rounded-sm border border-border-dark bg-black/40 px-2 py-0.5 font-mono text-[10px] text-primary"
	/>
	<button
		type="submit"
		disabled={busy}
		class="shrink-0 rounded-sm border border-border-dark px-2 py-0.5 font-mono text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
	>
		{busy ? 'loading…' : label}
	</button>
</form>
{#if error}
	<p class="mt-1 font-mono text-[10px] text-rebel" data-import-link-error>{error}</p>
{/if}
