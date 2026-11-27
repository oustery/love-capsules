<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { fade, fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import HeartLock from '$lib/components/HeartLock.svelte';
	import PetalRain from '$lib/components/PetalRain.svelte';
	import { auth } from '$lib/auth.svelte';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';

	let word = $state('');
	let unlocked = $state(false);
	let bursts = $state(0);
	let shakeKey = $state(0);

	const canSubmit = $derived(word.trim().length > 0 && !auth.busy && !unlocked);

	async function tryUnlock(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		const ok = await auth.unlock(word);
		if (ok) {
			buzz([18, 60, 26]);
			unlocked = true;
			bursts += 1;
			setTimeout(() => goto(`${base}/`, { replaceState: true }), 1100);
		} else {
			buzz([40, 60, 40]);
			shakeKey += 1;
			toast('Не то словечко 🙈 Подсказка: оно про нас двоих');
		}
	}
</script>

<svelte:head>
	<title>Вход · Для тебя 💗</title>
</svelte:head>

<PetalRain bursts={bursts} />

<div class="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 py-10 text-center">
	{#if !auth.ready}
		<div class="animate-heartbeat text-5xl">🤍</div>
		<p class="mt-4 text-sm font-semibold text-ink/45">Проверяем ключик…</p>
	{:else if unlocked}
		<div in:scale={{ duration: 400, easing: backOut }} class="flex flex-col items-center">
			<HeartLock open size={140} />
			<p in:fly={{ y: 12, duration: 350, delay: 250 }} class="mt-6 font-hand text-3xl text-rose-deep">
				Открываю наш мир…
			</p>
		</div>
	{:else}
		{#key shakeKey}
			<div class="shake-once flex w-full flex-col items-center" in:fade={{ duration: 300 }}>
				<HeartLock size={130} />

				<h1 class="mt-6 font-hand text-4xl font-semibold text-ink/90">наш маленький мир</h1>
				<p class="mt-1 text-sm text-ink/50">только для нас двоих — произнеси слово</p>

				<form onsubmit={tryUnlock} class="mt-8 w-full">
					<input
						type="text"
						bind:value={word}
						placeholder="кодовое слово…"
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						aria-label="Кодовое слово"
						class="w-full rounded-3xl border border-white bg-shell px-5 py-4 text-center text-lg font-bold text-ink shadow-inset outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-rose/50"
					/>
					<button
						type="submit"
						disabled={!canSubmit}
						class="mt-3.5 w-full rounded-3xl bg-linear-to-r from-rose to-peach py-4 text-base font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-50"
					>
						{auth.busy ? 'Подбираю ключик…' : 'Открыть 🔓'}
					</button>
				</form>

				<p class="mt-5 text-xs text-ink/35">одно слово, без регистра и лишних пробелов</p>
			</div>
		{/key}
	{/if}
</div>
