<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '$lib/toast.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4">
	{#each toasts as t (t.id)}
		<div
			in:fly={{ y: -12, duration: 250 }}
			out:fly={{ y: -8, duration: 180 }}
			class="pointer-events-auto max-w-sm rounded-2xl bg-ink/85 px-4 py-2.5 text-center text-sm font-semibold text-cream shadow-lift"
		>
			{t.text}
		</div>
	{/each}
</div>
