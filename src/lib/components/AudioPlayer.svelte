<script lang="ts">
	import { buzz } from '$lib/haptics';

	let { src }: { src: string } = $props();

	let audio: HTMLAudioElement | null = $state(null);
	let paused = $state(true);
	let current = $state(0);
	let duration = $state(0);
	let rate = $state(1);
	let seeking = $state(false);

	const RATES = [1, 1.25, 1.5];
	const pct = $derived(duration > 0 ? Math.min(100, (current / duration) * 100) : 0);

	function toggle() {
		buzz(12);
		if (!audio) return;
		if (paused) audio.play();
		else audio.pause();
	}

	function cycleRate() {
		rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
		if (audio) audio.playbackRate = rate;
		buzz(10);
	}

	/** Перемотка касанием: доля клика по полосе → позиция воспроизведения */
	function seek(e: PointerEvent) {
		if (!audio || duration <= 0) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		audio.currentTime = ratio * duration;
		current = audio.currentTime;
	}

	function fmt(s: number): string {
		if (!Number.isFinite(s)) return '0:00';
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	}
</script>

<div class="rounded-3xl bg-shell p-3.5 shadow-inset">
	<div class="flex items-center gap-3">
		<button
			type="button"
			aria-label={paused ? 'Воспроизвести' : 'Пауза'}
			onclick={toggle}
			class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-rose to-peach text-xl text-white shadow-lift transition active:scale-90 {paused
				? ''
				: 'animate-heartbeat'}"
		>
			{paused ? '▶' : '❚❚'}
		</button>

		<div class="min-w-0 flex-1">
			<div
				role="slider"
				aria-label="Перемотка"
				aria-valuemin="0"
				aria-valuemax={Math.round(duration)}
				aria-valuenow={Math.round(current)}
				tabindex="0"
				onpointerdown={seek}
				onkeydown={(e) => {
					if (!audio || duration <= 0) return;
					if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
					if (e.key === 'ArrowRight') audio.currentTime = Math.min(duration, audio.currentTime + 5);
				}}
				class="h-2.5 cursor-pointer overflow-hidden rounded-full bg-ivory shadow-inset"
				style="touch-action: none"
			>
				<div
					class="h-full rounded-full bg-linear-to-r from-rose to-peach transition-[width] duration-150 ease-out"
					style="width: {pct}%"
				></div>
			</div>
			<div class="mt-1 flex justify-between text-[11px] font-bold tabular-nums text-ink/45">
				<span>{fmt(current)}</span>
				<span>{fmt(duration)}</span>
			</div>
		</div>

		<button
			type="button"
			onclick={cycleRate}
			aria-label="Скорость воспроизведения"
			class="shrink-0 rounded-2xl bg-ivory px-2.5 py-2 text-xs font-extrabold text-ink/60 shadow-soft transition active:scale-90"
		>
			{rate}x
		</button>
	</div>

	<audio
		bind:this={audio}
		bind:paused
		bind:currentTime={current}
		bind:duration
		bind:playbackRate={rate}
		{src}
		preload="metadata"
	></audio>
</div>
