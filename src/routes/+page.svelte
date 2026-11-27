<script lang="ts">
	import { fade } from 'svelte/transition';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/auth.svelte';
	import type { SettingsMap } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';
	import { plural, prettyDate, parseDate, startOfTodayISO } from '$lib/format';
	import PetalRain from '$lib/components/PetalRain.svelte';
	import CountdownCard from '$lib/components/CountdownCard.svelte';
	import TogetherCounter from '$lib/components/TogetherCounter.svelte';
	import MoodDiary from '$lib/components/MoodDiary.svelte';
	import SupportJar from '$lib/components/SupportJar.svelte';

	let now = $state(Date.now());
	let loaded = $state(false);
	let settings = $state<SettingsMap>({});
	let missToday = $state(0);
	let bursts = $state(0);

	// живые секунды для таймеров
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	// грузим данные, как только открылась сессия
	$effect(() => {
		if (auth.session && !loaded) loadAll();
	});

	async function loadAll() {
		const [setRes, missRes] = await Promise.all([
			supabase.from('settings').select('key, value'),
			supabase
				.from('miss_clicks')
				.select('clicked_at', { count: 'exact', head: true })
				.gte('clicked_at', startOfTodayISO())
		]);
		if (setRes.error) {
			toast('Настройки не загрузились 🥺');
		} else if (setRes.data) {
			for (const row of setRes.data as { key: string; value: string }[]) {
				settings[row.key] = row.value;
			}
		}
		missToday = missRes.count ?? 0;
		loaded = true;
	}

	/** Кнопка «Скучаю»: лепестки, вибрация и счётчик за сегодня */
	async function miss() {
		bursts += 1;
		buzz([12, 40, 12, 40, 28]);
		missToday += 1;
		const { error } = await supabase.from('miss_clicks').insert({});
		if (error) {
			missToday -= 1;
			toast('Не долетело… попробуй ещё раз 🥺');
		}
	}

	const targetDate = $derived(parseDate(settings['target_date']));
	const targetFrom = $derived(parseDate(settings['target_from']) ?? parseDate(settings['start_date']));
	const startDate = $derived(parseDate(settings['start_date']));

	const greeting = $derived.by(() => {
		const h = new Date(now).getHours();
		if (h < 5) return 'Тёплой ночи';
		if (h < 12) return 'Доброе утро';
		if (h < 18) return 'Добрый день';
		return 'Добрый вечер';
	});
	const dateLabel = $derived(prettyDate(new Date(now)));
</script>

<svelte:head>
	<title>Главная · Наши капсулы</title>
</svelte:head>

<PetalRain bursts={bursts} />

{#if !auth.ready || !auth.session || !loaded}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-3">
		<span class="animate-heartbeat text-5xl">🤍</span>
		<p class="text-sm font-semibold text-ink/45">Раскрываем капсулы…</p>
	</div>
{:else}
	<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
		<!-- Шапка: приветствие + скрытая кнопка «Скучаю» в углу -->
		<header class="flex items-start justify-between gap-3">
			<div>
				<h1 class="text-2xl font-extrabold text-ink">{greeting}, солнце</h1>
				<p class="mt-0.5 text-sm text-ink/55 capitalize">{dateLabel}</p>
			</div>
			<button
				type="button"
				onclick={miss}
				aria-label="Нажать «Скучаю»"
				class="flex shrink-0 items-center gap-1.5 rounded-full border border-rose/30 bg-ivory px-3.5 py-2 text-xs font-extrabold text-rose-deep shadow-soft transition active:scale-90"
			>
				<span class="animate-heartbeat text-base leading-none">🤍</span>
				Скучаю
			</button>
		</header>

		{#if missToday > 0}
			{#key missToday}
				<p
					in:fade={{ duration: 200 }}
					class="mt-3 w-fit rounded-full bg-rose/12 px-4 py-1.5 text-xs font-bold text-rose-deep"
				>
					Сегодня нажато «Скучаю»: {missToday}
					{plural(missToday, ['раз', 'раза', 'раз'])}
				</p>
			{/key}
		{/if}

		<!-- Двойной таймер -->
		<section class="mt-5 space-y-4">
			<CountdownCard target={targetDate} since={targetFrom} {now} />
			<TogetherCounter start={startDate} {now} />
		</section>

		<!-- Дневник настроения -->
		<section class="mt-4">
			<MoodDiary />
		</section>

		<!-- Баночка с поддержкой -->
		<section class="mt-4">
			<SupportJar />
		</section>

		<footer class="mt-8 pb-2 text-center">
			<a
				href={`${base}/admin`}
				aria-label="Админка"
				class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-lg text-ink/40 shadow-soft transition active:scale-90"
			>
				⚙️
			</a>
			<p class="mt-2 font-hand text-lg text-ink/45">сделано с любовью — только для нас двоих</p>
		</footer>
	</div>
{/if}
