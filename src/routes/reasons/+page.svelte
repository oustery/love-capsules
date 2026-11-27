<script lang="ts">
	import { spring } from 'svelte/motion';
	import { supabase } from '$lib/supabase';
	import type { Reason } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';

	let loaded = $state(false);
	let reasons = $state<Reason[]>([]);
	let index = $state(0);

	// свайп: смещение тянем пальцем, отпускаем — пружина возвращает или «вылетает»
	const drag = spring(0, { stiffness: 0.18, damping: 0.85 });
	let dragging = $state(false);
	let startX = 0;

	$effect(() => {
		if (!loaded) load();
	});

	async function load() {
		const { data, error } = await supabase
			.from('reasons')
			.select('id, position, text, favorite')
			.order('position');
		if (error) {
			toast('Колода не загрузилась 🥺');
		} else {
			reasons = (data ?? []) as Reason[];
		}
		loaded = true;
	}

	const current = $derived(reasons[index]);
	const behind = $derived(reasons.length > 1 ? reasons[(index + 1) % reasons.length] : null);
	const behind2 = $derived(reasons.length > 2 ? reasons[(index + 2) % reasons.length] : null);
	const favCount = $derived(reasons.filter((r) => r.favorite).length);

	function down(e: PointerEvent) {
		dragging = true;
		startX = e.clientX;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!dragging) return;
		drag.target = e.clientX - startX;
	}

	function up() {
		if (!dragging) return;
		dragging = false;
		const dx = drag.current;
		if (dx > 90) swipe(1);
		else if (dx < -90) swipe(-1);
		else drag.target = 0;
	}

	function swipe(direction: 1 | -1) {
		buzz(14);
		index = (index + direction + reasons.length) % reasons.length;
		drag.target = 0;
	}

	function random() {
		if (reasons.length < 2) return;
		buzz(14);
		let next = index;
		while (next === index) next = Math.floor(Math.random() * reasons.length);
		index = next;
		drag.target = 0;
	}

	async function toggleFavorite(r: Reason) {
		const next = !r.favorite;
		r.favorite = next;
		buzz(next ? [10, 40, 10] : 10);
		const { error } = await supabase.from('reasons').update({ favorite: next }).eq('id', r.id);
		if (error) {
			r.favorite = !next;
			toast('Не сохранилось 🥺');
		}
	}
</script>

<svelte:head>
	<title>100 причин · Для тебя 💗</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
	<header class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-extrabold text-ink">100 причин, почему я тебя люблю</h1>
			<p class="mt-0.5 text-sm text-ink/55">тяни карточку в сторону — листай колоду</p>
		</div>
		<span class="shrink-0 rounded-full bg-rose/15 px-3 py-1.5 text-xs font-extrabold text-rose-deep">
			❤️ {favCount}
		</span>
	</header>

	{#if loaded && reasons.length === 0}
		<div class="card mt-6 p-6 text-center">
			<p class="text-4xl">🃏</p>
		<p class="mt-2 font-hand text-2xl text-ink/70">Колода ещё пустая</p>
			<p class="mt-1 text-sm text-ink/50">
				Добавь причины в админке — можно вставить сразу списком построчно.
			</p>
		</div>
	{:else if current}
		<!-- Колода -->
		<div class="relative mt-6 h-[380px] select-none" style="touch-action: pan-y">
			{#if behind2}
				<div
					class="absolute inset-x-4 top-2 h-[360px] rounded-4xl border border-white/70 bg-ivory/60 shadow-soft"
				></div>
			{/if}
			{#if behind}
				<div
					class="absolute inset-x-2.5 top-1.5 h-[360px] rounded-4xl border border-white/70 bg-ivory shadow-soft"
				></div>
			{/if}

			<div
				role="slider"
				aria-label="Карточка причины — свайпай в стороны или листай стрелками"
				aria-valuemin="1"
				aria-valuemax={reasons.length}
				aria-valuenow={current.position}
				aria-valuetext={`Причина №${current.position}`}
				tabindex="0"
				onkeydown={(e) => {
					if (e.key === 'ArrowLeft') swipe(-1);
					if (e.key === 'ArrowRight') swipe(1);
				}}
				class="absolute inset-x-0 top-0 flex h-[370px] flex-col rounded-4xl border border-white/80 bg-ivory p-5 shadow-lift"
				style="transform: translate3d({drag.current}px, 0, 0) rotate({drag.current / 16}deg); opacity: {1 -
					Math.min(1, Math.abs(drag.current) / 440) * 0.55}"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
			>
				<div class="flex items-center justify-between">
					<span class="rounded-full bg-shell px-3.5 py-1.5 text-xs font-extrabold text-ink/60">
						Причина №{current.position} из {reasons.length}
					</span>
					<button
						type="button"
						aria-label="В избранное"
						onclick={() => toggleFavorite(current)}
						class="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition active:scale-90 {current.favorite
							? 'bg-rose/15'
							: 'bg-shell'}"
					>
						{current.favorite ? '❤️' : '🤍'}
					</button>
				</div>
				<p class="flex flex-1 items-center justify-center px-2 text-center font-hand text-[30px] leading-snug text-ink/85">
					{current.text}
				</p>
				<p class="text-center text-[11px] font-bold text-ink/35">← свайп или кнопки внизу →</p>
			</div>
		</div>

		<!-- Кнопки управления колодой -->
		<div class="mt-5 flex items-center justify-center gap-3">
			<button
				type="button"
				onclick={() => swipe(-1)}
				aria-label="Предыдущая"
				class="flex h-14 w-14 items-center justify-center rounded-3xl bg-ivory text-xl shadow-soft transition active:scale-90"
			>
				↩︎
			</button>
			<button
				type="button"
				onclick={random}
				class="h-14 flex-1 rounded-3xl bg-linear-to-r from-rose to-peach text-sm font-extrabold text-white shadow-lift transition active:scale-95"
			>
				🎲 Случайная
			</button>
			<button
				type="button"
				onclick={() => swipe(1)}
				aria-label="Следующая"
				class="flex h-14 w-14 items-center justify-center rounded-3xl bg-ivory text-xl shadow-soft transition active:scale-90"
			>
				↪︎
			</button>
		</div>
	{/if}
</div>
