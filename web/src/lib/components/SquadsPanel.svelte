<script lang="ts">
	/**
	 * Viewer-only squad library UI. Every row is stored XWS text plus its
	 * rendering preview — nothing here judges whether a squad is legal.
	 */
	import {
		deleteSquad,
		listHistory,
		listSquads,
		saveSquad,
		toggleStar,
		type SquadRecord
	} from '$lib/squad-store';
	import { formatSquadCount, formatXwsPreview } from '$lib/xws-preview';

	type Filter = 'select' | 'all' | 'star';

	let {
		onLoadYour,
		onLoadBot,
		onSaveCurrent,
		currentRaw = ''
	}: {
		onLoadYour: (squad: SquadRecord) => void;
		onLoadBot: (squad: SquadRecord) => void;
		onSaveCurrent?: () => void;
		currentRaw?: string;
	} = $props();

	let filter = $state<Filter>('all');
	let squads = $state<SquadRecord[]>(listSquads());
	// localStorage is not observable; this version forces history-derived state
	// to be recomputed after any store mutation.
	let version = $state(0);

	function refresh() {
		squads = listSquads();
		version += 1;
	}

	const selectedIds = $derived.by(() => {
		void version;
		return new Set(listHistory().map((entry) => entry.squadId));
	});

	const visible = $derived(
		squads.filter((squad) => {
			if (filter === 'all') return true;
			if (filter === 'star') return squad.starred;
			return selectedIds.has(squad.id);
		})
	);

	function load(squad: SquadRecord, target: 'your' | 'bot') {
		if (target === 'your') onLoadYour(squad);
		else onLoadBot(squad);
		refresh();
	}

	function saveCurrent() {
		if (onSaveCurrent) onSaveCurrent();
		else if (currentRaw.trim()) saveSquad(currentRaw);
		refresh();
	}
</script>

<div class="rounded-sm border border-border-dark bg-black/30 p-2" data-testid="squads-panel">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<span class="text-[10px] uppercase tracking-widest text-secondary/60">Saved squads</span>
		<button
			type="button"
			class="rounded-sm border border-republic/50 bg-republic/10 px-2 py-0.5 font-mono text-[10px] text-republic hover:border-republic"
			data-testid="save-current-squad"
			onclick={saveCurrent}
		>
			+ Save current paste
		</button>
	</div>
	<div class="mb-2 flex gap-1" role="group" aria-label="Squad filter">
		<button
			type="button"
			class="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:border-white/40"
			class:border-republic={filter === 'select'}
			class:text-republic={filter === 'select'}
			class:border-border-dark={filter !== 'select'}
			class:text-secondary={filter !== 'select'}
			aria-pressed={filter === 'select'}
			title="Squads you have loaded into a box"
			onclick={() => (filter = 'select')}
		>
			Select
		</button>
		<button
			type="button"
			class="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:border-white/40"
			class:border-republic={filter === 'all'}
			class:text-republic={filter === 'all'}
			class:border-border-dark={filter !== 'all'}
			class:text-secondary={filter !== 'all'}
			aria-pressed={filter === 'all'}
			onclick={() => (filter = 'all')}
		>
			All
		</button>
		<button
			type="button"
			class="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:border-white/40"
			class:border-republic={filter === 'star'}
			class:text-republic={filter === 'star'}
			class:border-border-dark={filter !== 'star'}
			class:text-secondary={filter !== 'star'}
			aria-pressed={filter === 'star'}
			onclick={() => (filter = 'star')}
		>
			star
		</button>
	</div>
	{#if visible.length === 0}
		<p class="text-[10px] text-secondary/60">Nothing here yet — paste a squad and save it.</p>
	{:else}
		<ul class="scroll-thin max-h-64 space-y-1 overflow-y-auto" data-testid="squads-list">
			{#each visible as squad (squad.id)}
				<li class="rounded-sm border border-border-dark px-2 py-1.5">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="truncate text-[11px] text-primary" title={formatXwsPreview(squad.preview)}>
								{formatXwsPreview(squad.preview)}
							</div>
							<div class="font-mono text-[10px] text-secondary/70" data-squad-count>
								{formatSquadCount(squad.preview)}
							</div>
						</div>
						<button
							type="button"
							class="shrink-0 rounded-sm px-1.5 py-0.5 text-[13px] text-secondary hover:text-republic"
							title={squad.starred ? 'Remove star' : 'Star this squad'}
							aria-label={squad.starred ? 'Remove star' : 'Star this squad'}
							aria-pressed={squad.starred}
							data-testid="squad-star"
							onclick={() => {
								toggleStar(squad.id);
								refresh();
							}}
						>
							{squad.starred ? '★' : '☆'}
						</button>
					</div>
					<div class="mt-1 flex flex-wrap gap-1">
						<button
							type="button"
							class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-republic hover:text-republic"
							data-testid="load-squad-your"
							onclick={() => load(squad, 'your')}
						>
							Load into YOUR SQUAD
						</button>
						<button
							type="button"
							class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-republic hover:text-republic"
							data-testid="load-squad-bot"
							onclick={() => load(squad, 'bot')}
						>
							Load into BOT'S SQUAD
						</button>
						<button
							type="button"
							class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-rebel hover:text-rebel"
							data-testid="delete-squad"
							onclick={() => {
								deleteSquad(squad.id);
								refresh();
							}}
						>
							delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
