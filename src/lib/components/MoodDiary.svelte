<script lang="ts">
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { MOODS } from '$lib/config';
	import type { MoodOption } from '$lib/config';
	import type { MoodLog } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';
	import { pullPhrase } from '$lib/jar.svelte';
	import { shortTime, startOfTodayISO } from '$lib/format';

	let logs = $state<MoodLog[]>([]);
	let selected = $state<MoodOption | null>(null);
	let note = $state('');
	let saving = $state(false);
	let loaded = $state(false);

	$effect(() => {
		loadToday();
	});

	async function loadToday() {
		const { data } = await supabase
			.from('mood_logs')
			.select('id, mood, note, created_at')
			.gte('created_at', startOfTodayISO())
			.order('created_at', { ascending: false })
			.limit(20);
		if (data) logs = data as MoodLog[];
		loaded = true;
	}

	/** Выбрано «грустно» или «устала» → сразу показываем тёплую поддержку */
	const gentle = $derived(selected?.gentle ?? false);

	async function save() {
		if (!selected || saving) return;
		saving = true;
		try {
			const { data, error } = await supabase
				.from('mood_logs')
				.insert({ mood: selected.label, note: note.trim() || null })
				.select()
				.single();
			if (error || !data) {
				toast('Не сохранилось — попробуй ещё раз 🥺');
				return;
			}
			logs = [data as MoodLog, ...logs];
			note = '';
			buzz(18);
			toast('Чек-ин сохранён, спасибо, что поделилась 💛');
		} finally {
			saving = false;
		}
	}

	function emojiFor(moodLabel: string): string {
		return MOODS.find((m) => m.label === moodLabel)?.emoji ?? '🤍';
	}
</script>

<div class="card p-5">
	<h2 class="font-hand text-2xl font-semibold text-ink/85">как настроение?</h2>

	<div class="mt-3 grid grid-cols-2 gap-2.5">
		{#each MOODS as m (m.id)}
			<button type="button" class="mood-chip" class:active={selected?.id === m.id} onclick={() => (selected = m)}>
				<span class="text-2xl leading-none">{m.emoji}</span>
				<span class="text-xs font-bold leading-tight">{m.label}</span>
			</button>
		{/each}
	</div>

	{#if selected}
		<textarea
			bind:value={note}
			rows="2"
			maxlength="300"
			placeholder="пара слов — по желанию"
			class="mt-3 w-full resize-none rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-rose/40"
		></textarea>
		<button
			onclick={save}
			disabled={saving}
			class="mt-3 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
		>
			{saving ? 'Сохраняю…' : 'Сохранить чек-ин'}
		</button>
	{/if}

	{#if gentle && selected}
		<div in:fly={{ y: 14, duration: 300 }} class="mt-4 rounded-3xl border border-sage/40 bg-sage/15 p-4">
			<p class="font-hand text-xl leading-snug text-ink/85">{selected.support}</p>
			<div class="mt-3 flex gap-2.5">
				<button
					type="button"
					onclick={() => {
						buzz(15);
						pullPhrase();
					}}
					class="flex-1 rounded-2xl bg-ivory px-3 py-2.5 text-xs font-bold text-ink/75 shadow-soft transition active:scale-95"
				>
					🍪 Из баночки поддержки
				</button>
				<button
					type="button"
					onclick={() => toast('Аудиокапсулы приедут в следующей части 💛')}
					class="flex-1 rounded-2xl bg-ivory px-3 py-2.5 text-xs font-bold text-ink/75 shadow-soft transition active:scale-95"
				>
					🎧 Аудиокапсула
				</button>
			</div>
		</div>
	{/if}

	{#if loaded && logs.length > 0}
		<div class="mt-4 space-y-2">
			<p class="text-[11px] font-bold tracking-wide text-ink/40 uppercase">чек-ины за сегодня</p>
			{#each logs as log (log.id)}
				<div class="rounded-2xl bg-shell px-4 py-2.5">
					<div class="flex items-center justify-between text-sm font-bold text-ink/80">
						<span>{emojiFor(log.mood)} {log.mood}</span>
						<span class="text-xs font-semibold text-ink/40">{shortTime(new Date(log.created_at))}</span>
					</div>
					{#if log.note}
						<p class="mt-1 text-sm text-ink/60">{log.note}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
