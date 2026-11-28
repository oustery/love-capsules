<script lang="ts">
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import type { Note } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';
	import { fullDate } from '$lib/format';
	import Modal from '$lib/components/Modal.svelte';

	let loaded = $state(false);
	let poems = $state<Note[]>([]);

	// новый стих — может добавить каждый из нас, без админки
	let addOpen = $state(false);
	let newText = $state('');
	let addingP = $state(false);

	// режим управления: убрать стихотворение
	let editMode = $state(false);
	let confirmId = $state<string | null>(null);

	function askDel(id: string) {
		buzz(10);
		if (confirmId === id) {
			confirmId = null;
			return true;
		}
		confirmId = id;
		setTimeout(() => (confirmId = null), 6000);
		return false;
	}

	$effect(() => {
		if (!loaded) load();
	});

	async function load() {
		const { data, error } = await supabase
			.from('notes')
			.select('*')
			.eq('kind', 'poem')
			.order('created_at');
		if (error) {
			toast('Стихи не загрузились 🥺');
		} else {
			poems = (data ?? []) as Note[];
		}
		loaded = true;
	}

	async function addPoem() {
		const body = newText.trim();
		if (!body || addingP) return;
		addingP = true;
		try {
			const { data, error } = await supabase
				.from('notes')
				.insert({ kind: 'poem', body })
				.select()
				.single();
			if (error || !data) {
				toast('Стихотворение не сохранилось 🥺');
				return;
			}
			poems = [...poems, data as Note];
			addOpen = false;
			newText = '';
			buzz([12, 40, 12]);
			toast('Стихотворение в нашей секции! 🪶');
		} finally {
			addingP = false;
		}
	}

	async function delPoem(p: Note) {
		if (!askDel(p.id)) return;
		const { error } = await supabase.from('notes').delete().eq('id', p.id);
		if (error) {
			toast('Не удалилось 🥺');
			return;
		}
		poems = poems.filter((x) => x.id !== p.id);
		buzz(12);
		toast('Стихотворение убрано 🗑️');
	}
</script>

<svelte:head>
	<title>Стихи · Для тебя 💗</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
	<header>
		<h1 class="text-2xl font-extrabold text-ink">Стихи</h1>
		<p class="mt-0.5 text-sm text-ink/55">строки, которые мы пишем друг для друга</p>
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				onclick={() => (addOpen = true)}
				class="flex-1 rounded-2xl bg-linear-to-r from-rose to-peach py-3 text-sm font-extrabold text-white shadow-lift transition active:scale-95"
			>
				🪶 Новое стихотворение
			</button>
			<button
				type="button"
				onclick={() => {
					editMode = !editMode;
					confirmId = null;
					buzz(10);
				}}
				aria-label="Режим управления"
				class="rounded-2xl bg-shell px-4 py-3 text-sm font-extrabold text-ink/60 transition active:scale-95 {editMode
					? 'text-rose-deep ring-2 ring-rose'
					: ''}"
			>
				{editMode ? '✓ готово' : '✏️'}
			</button>
		</div>
		{#if editMode}
			<p class="mt-2 text-[11px] font-bold text-ink/40">
				режим управления: ✕ убирает стихотворение совсем
			</p>
		{/if}
	</header>

	<section class="mt-5 space-y-4">
		{#if loaded && poems.length === 0}
			<div class="card p-6 text-center">
				<p class="text-4xl">🪶</p>
				<p class="mt-2 font-hand text-2xl text-ink/70">Стихов пока нет</p>
				<p class="mt-1 text-sm text-ink/50">
					Нажми «Новое стихотворение» — переносы строк сохранятся, как в записке.
				</p>
			</div>
		{/if}

		{#each poems as p (p.id)}
			<article class="card relative p-5" in:fly>
				{#if editMode}
					<button
						type="button"
						onclick={() => delPoem(p)}
						aria-label="Удалить стихотворение"
						class="absolute -top-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-lift transition active:scale-90 {confirmId === p.id
							? 'bg-rose-deep'
							: 'bg-ink/80'}"
					>
						{confirmId === p.id ? '?!' : '✕'}
					</button>
				{/if}
				<p class="whitespace-pre-line font-hand text-[19px] leading-relaxed text-ink/85">
					{p.body}
				</p>
				<p class="mt-3 text-right text-[10px] font-bold text-ink/35">
					✍️ {fullDate(new Date(p.created_at))}
				</p>
			</article>
		{/each}
	</section>
</div>

<!-- Новый стих — для нас обоих -->
<Modal bind:open={addOpen} title="Новое стихотворение">
	<div>
		<textarea
			bind:value={newText}
			rows="8"
			maxlength="2000"
			placeholder={'вставь или напиши стих целиком —\nпереносы строк сохранятся'}
			class="w-full resize-none rounded-2xl bg-shell px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-rose/40"
		></textarea>
		<button
			type="button"
			onclick={addPoem}
			disabled={addingP || !newText.trim()}
			class="mt-3 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-50"
		>
			{addingP ? 'Сохраняю…' : 'Добавить в секцию 🪶'}
		</button>
	</div>
</Modal>
