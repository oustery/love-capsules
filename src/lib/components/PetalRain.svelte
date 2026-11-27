<script lang="ts">
	/**
	 * Лепестки и сердечки, засыпающие экран после «Скучаю».
	 * Увеличивай prop `bursts` — каждая новая волна запускает дождь.
	 */
	import { untrack } from 'svelte';

	let { bursts = 0 }: { bursts?: number } = $props();

	interface Petal {
		id: number;
		left: number;
		drift: number;
		delay: number;
		dur: number;
		size: number;
		spin: number;
		glyph: string;
	}

	const GLYPHS = ['❤️', '💗', '🌸', '🩷', '💞', '🌷'];

	let petals = $state<Petal[]>([]);
	let veil = $state(false);
	let seq = 0;

	$effect(() => {
		// зависимость только от bursts; spawnWave читает и пишет petals —
		// без untrack эффект подписывался бы на собственную запись и зависал
		const wave = bursts;
		if (wave > 0) untrack(() => spawnWave());
	});

	function spawnWave() {
		const batch: Petal[] = Array.from({ length: 26 }, (_, i) => {
			const delay = Math.random() * 700;
			const dur = 2400 + Math.random() * 2200;
			return {
				id: seq++,
				left: Math.random() * 96,
				drift: (Math.random() - 0.5) * 140,
				delay,
				dur,
				size: 16 + Math.random() * 22,
				spin: (Math.random() - 0.5) * 480,
				glyph: GLYPHS[(seq + i) % GLYPHS.length]
			};
		});

		petals = [...petals, ...batch];
		veil = true;

		for (const p of batch) {
			setTimeout(() => {
				petals = petals.filter((x) => x.id !== p.id);
			}, p.delay + p.dur + 120);
		}
		setTimeout(() => {
			veil = false;
		}, 1800);
	}
</script>

{#if petals.length > 0}
	<div class="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
		<!-- мягкая вуаль, засыпающая экран -->
		<div
			class="absolute inset-0 transition-opacity duration-1000 {veil ? 'opacity-100' : 'opacity-0'}"
			style="background: radial-gradient(ellipse at 50% 40%, rgb(229 152 155 / 0.16), rgb(255 180 162 / 0.06) 55%, transparent 75%)"
		></div>
		{#each petals as p (p.id)}
			<span
				class="petal absolute select-none"
				style="--drift:{p.drift}px; --spin:{p.spin}deg; --dur:{p.dur}ms; --delay:{p.delay}ms; left:{p.left}%; font-size:{p.size}px"
				aria-hidden="true">{p.glyph}</span
			>
		{/each}
	</div>
{/if}
