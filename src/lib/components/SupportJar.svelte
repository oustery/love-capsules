<script lang="ts">
	import { scale } from 'svelte/transition';
	import { jar, ensureJarLoaded, pullPhrase, pullNight } from '$lib/jar.svelte';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';

	let shaking = $state(false);

	$effect(() => {
		ensureJarLoaded();
	});

	// каждая вытянутая фраза встряхивает баночку
	$effect(() => {
		if (jar.pulls > 0) {
			shaking = true;
			const t = setTimeout(() => (shaking = false), 540);
			return () => clearTimeout(t);
		}
	});

	function shake() {
		buzz([12, 40, 10]);
		if (!pullPhrase()) toast('Баночка пустовата — добавь фраз в notes (kind=«support»)');
	}

	// ночное «спокойной ночи» из тех же ночных СМС
	function night() {
		buzz([10, 40, 12]);
		if (!pullNight()) toast('Ночных сообщений пока нет — добавьте их в notes (kind=«goodnight»)');
	}
</script>

<div class="card overflow-hidden p-5">
	<h2 class="font-hand text-2xl font-semibold text-ink/85">баночка поддержки</h2>

	<button
		type="button"
		aria-label="Встряхнуть баночку поддержки"
		onclick={shake}
		class="mx-auto mt-4 block w-44 transition active:scale-95"
		class:jar-shaking={shaking}
	>
		<!-- крышка -->
		<div class="mx-auto h-5 w-28 rounded-b-md rounded-t-xl bg-sage shadow-soft"></div>
		<!-- стеклянная банка -->
		<div
			class="relative h-40 rounded-b-[2.2rem] rounded-t-xl border-2 border-ink/10 bg-linear-to-b from-ivory to-shell shadow-soft"
		>
			<span class="animate-float absolute top-6 left-4 text-xl opacity-60">💗</span>
			<span class="animate-float absolute top-10 right-5 text-lg opacity-50" style="animation-delay: -2s">⭐️</span>
			<span class="animate-float absolute bottom-8 left-8 text-lg opacity-50" style="animation-delay: -1s">💛</span>
			<span class="animate-float absolute right-7 bottom-12 text-xl opacity-60" style="animation-delay: -3s">🩷</span>
		</div>
	</button>

	<div class="mt-3 flex justify-center">
		<button
			type="button"
			onclick={night}
			class="rounded-2xl bg-shell px-4 py-2.5 text-xs font-extrabold text-ink/60 transition active:scale-95"
		>
			🌙 Спокойной ночи
		</button>
	</div>

	{#if jar.current}
		{#key jar.current}
			<div
				in:scale={{ duration: 260, start: 0.7 }}
				class="mx-auto mt-4 max-w-xs rounded-3xl bg-ivory px-5 py-4 text-center shadow-lift"
			>
				<p class="font-hand text-[22px] leading-snug text-ink/85">{jar.current}</p>
			</div>
		{/key}
	{:else}
		<p class="mt-4 text-center text-sm text-ink/50">
			Нажми на баночку — и она выкатит тебе тёплое словечко.
		</p>
	{/if}
</div>
