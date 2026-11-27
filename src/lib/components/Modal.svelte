<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let {
		open = $bindable(false),
		title = '',
		children
	}: { open?: boolean; title?: string; children?: import('svelte').Snippet } = $props();
</script>

{#if open}
	<div class="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
		<button
			type="button"
			aria-label="Закрыть"
			onclick={() => (open = false)}
			transition:fade={{ duration: 200 }}
			class="absolute inset-0 bg-ink/40 backdrop-blur-sm"
		></button>
		<div
			transition:scale={{ start: 0.92, duration: 280, easing: backOut }}
			class="relative m-2.5 w-full max-w-md overflow-y-auto rounded-4xl border border-white/70 bg-cream shadow-lift sm:m-4"
			style="max-height: min(86dvh, 720px)"
		>
			<div class="glass sticky top-0 z-10 flex items-center justify-between rounded-t-4xl px-5 py-3.5">
				<h3 class="font-hand text-2xl font-semibold text-ink/85">{title}</h3>
				<button
					type="button"
					onclick={() => (open = false)}
					aria-label="Закрыть"
					class="flex h-9 w-9 items-center justify-center rounded-full bg-shell text-lg font-bold text-ink/60 transition active:scale-90"
				>
					✕
				</button>
			</div>
			<div class="px-5 pb-6 pt-1">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
