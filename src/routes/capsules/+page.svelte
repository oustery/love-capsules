<script lang="ts">
	import { fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import type { Capsule, TimeCapsule } from '$lib/types';
	import { CAPSULE_META } from '$lib/config';
	import { toast } from '$lib/toast.svelte';
	import { getSignedUrl } from '$lib/storage';
	import { plural } from '$lib/format';
	import Modal from '$lib/components/Modal.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';

	let now = $state(Date.now());
	let loaded = $state(false);
	let capsules = $state<Capsule[]>([]);
	let timeCapsules = $state<TimeCapsule[]>([]);

	// открытая капсула «Открой, когда...»
	let modalOpen = $state(false);
	let active = $state<Capsule | null>(null);
	let activeAudio = $state<string | null>(null);

	// открытая капсула времени
	let timeOpen = $state(false);
	let activeTime = $state<TimeCapsule | null>(null);
	let timeAudio = $state<string | null>(null);

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	$effect(() => {
		if (!loaded) load();
	});

	async function load() {
		const [capsRes, timeRes] = await Promise.all([
			supabase.from('capsules').select('*').order('sort_order'),
			supabase.from('time_capsules').select('*').order('unlock_at')
		]);
		if (capsRes.error || timeRes.error) {
			toast('Капсулы не загрузились 🥺');
		} else {
			capsules = (capsRes.data ?? []) as Capsule[];
			timeCapsules = (timeRes.data ?? []) as TimeCapsule[];
		}
		loaded = true;
	}

	const locked = $derived(
		timeCapsules.filter((tc) => new Date(tc.unlock_at).getTime() > now)
	);
	const unlocked = $derived(
		timeCapsules.filter((tc) => new Date(tc.unlock_at).getTime() <= now)
	);

	async function openCapsule(c: Capsule) {
		active = c;
		activeAudio = null;
		modalOpen = true;
		if (c.audio_path) {
			activeAudio = await getSignedUrl(c.audio_path);
			if (!activeAudio) toast('Голосовое сообщение не нашлось в хранилище 🥺');
		}
	}

	async function openTime(tc: TimeCapsule) {
		activeTime = tc;
		timeAudio = null;
		timeOpen = true;
		if (!tc.opened_at) {
			supabase
				.from('time_capsules')
				.update({ opened_at: new Date().toISOString() })
				.eq('id', tc.id)
				.then(() => {
					tc.opened_at = new Date().toISOString();
				});
		}
		if (tc.audio_path) {
			timeAudio = await getSignedUrl(tc.audio_path);
			if (!timeAudio) toast('Голосовое сообщение не нашлось в хранилище 🥺');
		}
	}

	/** Живой обратный отсчёт до unlock_at */
	function countdown(unlockAt: string) {
		const diff = Math.max(0, unlock_at_safe(unlockAt) - now);
		return {
			d: Math.floor(diff / 86_400_000),
			h: Math.floor((diff % 86_400_000) / 3_600_000),
			m: Math.floor((diff % 3_600_000) / 60_000),
			s: Math.floor((diff % 60_000) / 1000)
		};
	}

	function unlock_at_safe(v: string): number {
		return new Date(v).getTime();
	}

	function meta(slug: string) {
		return CAPSULE_META[slug] ?? { emoji: '💌', hint: 'письмо' };
	}
</script>

<svelte:head>
	<title>Капсулы · Наши капсулы</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
	<header>
		<h1 class="text-2xl font-extrabold text-ink">Капсулы и письма</h1>
		<p class="mt-0.5 text-sm text-ink/55">тёплые слова на каждый случай и письма в будущее</p>
	</header>

	{#if loaded && capsules.length === 0 && timeCapsules.length === 0}
		<div class="card mt-5 p-6 text-center">
			<p class="text-4xl">💌</p>
			<p class="mt-2 font-hand text-2xl text-ink/70">Капсулы ещё пустые</p>
			<p class="mt-1 text-sm text-ink/50">Запиши первые письма в админке — раздел «Диктофон».</p>
		</div>
	{/if}

	<!-- Капсула времени -->
	{#if locked.length > 0}
		<section class="mt-5">
			{#each locked as tc (tc.id)}
				{@const cd = countdown(tc.unlock_at)}
				<div
					class="card relative overflow-hidden p-5"
					style="background: linear-gradient(160deg, #fdf8f5 40%, #f7efea)"
				>
					<div class="flex items-center justify-between">
						<h2 class="font-hand text-2xl font-semibold text-ink/85">{tc.title}</h2>
						<span class="text-2xl">🔒</span>
					</div>
					<p class="mt-1 text-xs font-bold text-ink/45">
						откроется {new Date(tc.unlock_at).toLocaleDateString('ru-RU', {
							day: 'numeric',
							month: 'long',
							year: 'numeric'
						})}
					</p>
					<div class="mt-3 grid grid-cols-4 gap-2">
						<div class="rounded-2xl bg-ivory py-2.5 text-center shadow-soft">
							<div class="text-xl font-extrabold tabular-nums text-rose-deep">{String(cd.d).padStart(2, '0')}</div>
							<div class="text-[10px] font-bold text-ink/45">{plural(cd.d, ['день', 'дня', 'дней'])}</div>
						</div>
						<div class="rounded-2xl bg-ivory py-2.5 text-center shadow-soft">
							<div class="text-xl font-extrabold tabular-nums text-rose-deep">{String(cd.h).padStart(2, '0')}</div>
							<div class="text-[10px] font-bold text-ink/45">{plural(cd.h, ['час', 'часа', 'часов'])}</div>
						</div>
						<div class="rounded-2xl bg-ivory py-2.5 text-center shadow-soft">
							<div class="text-xl font-extrabold tabular-nums text-rose-deep">{String(cd.m).padStart(2, '0')}</div>
							<div class="text-[10px] font-bold text-ink/45">{plural(cd.m, ['мин', 'мин', 'мин'])}</div>
						</div>
						<div class="rounded-2xl bg-ivory py-2.5 text-center shadow-soft">
							<div class="text-xl font-extrabold tabular-nums text-rose-deep">{String(cd.s).padStart(2, '0')}</div>
							<div class="text-[10px] font-bold text-ink/45">{plural(cd.s, ['сек', 'сек', 'сек'])}</div>
						</div>
					</div>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Раскрытые капсулы времени -->
	{#if unlocked.length > 0}
		<section class="mt-4 space-y-3">
			{#each unlocked as tc (tc.id)}
				<button type="button" class="card w-full p-5 text-left" onclick={() => openTime(tc)}>
					<div class="flex items-center justify-between">
						<div class="min-w-0">
							<h2 class="font-hand text-2xl font-semibold text-ink/85">{tc.title}</h2>
							<p class="mt-1 text-xs font-bold text-ink/45">
								письмо из прошлого · можно открывать
							</p>
						</div>
						<span class="animate-heartbeat text-2xl">🔓</span>
					</div>
				</button>
			{/each}
		</section>
	{/if}

	<!-- Капсулы «Открой, когда...» -->
	<section class="mt-4 space-y-3">
		{#each capsules as c (c.id)}
			<button
				type="button"
				class="card w-full p-5 text-left transition active:scale-[0.98]"
				onclick={() => openCapsule(c)}
				in:fade
			>
				<div class="flex items-center gap-3.5">
					<span
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-shell text-2xl shadow-soft"
						>{meta(c.slug).emoji}</span
					>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-hand text-2xl font-semibold text-ink/85">{c.title}</span>
						<span class="block truncate text-xs font-bold text-ink/45">
							{c.subtitle || meta(c.slug).hint}{c.audio_path ? ' · есть голос' : ''}
						</span>
					</span>
					<span class="shrink-0 text-lg text-ink/30">→</span>
				</div>
			</button>
		{/each}
	</section>
</div>

<!-- Письмо «Открой, когда...» -->
<Modal bind:open={modalOpen} title={active?.title ?? ''}>
	{#if active}
		<p class="text-xs font-bold uppercase tracking-wide text-ink/40">
			{meta(active.slug).hint}
		</p>
		<p class="mt-3 font-hand text-[22px] leading-snug text-ink/85">{active.body}</p>
		{#if activeAudio}
			<div class="mt-4">
				<AudioPlayer src={activeAudio} />
			</div>
		{/if}
	{/if}
</Modal>

<!-- Капсула времени после открытия -->
<Modal bind:open={timeOpen} title={activeTime?.title ?? ''}>
	{#if activeTime}
		<p class="text-xs font-bold uppercase tracking-wide text-ink/40">
			письмо из прошлого · открыто {new Date(activeTime.opened_at ?? Date.now()).toLocaleDateString('ru-RU')}
		</p>
		<p class="mt-3 font-hand text-[22px] leading-snug text-ink/85">{activeTime.body}</p>
		{#if timeAudio}
			<div class="mt-4">
				<AudioPlayer src={timeAudio} />
			</div>
		{/if}
	{/if}
</Modal>
