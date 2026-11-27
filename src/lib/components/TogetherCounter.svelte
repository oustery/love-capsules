<script lang="ts">
	import { plural, fullDateFixed } from '$lib/format';

	let { start, now }: { start: Date | null; now: number } = $props();

	const HOUR = 3_600_000;
	const DAY = 86_400_000;

	const days = $derived(start ? Math.max(0, Math.floor((now - start.getTime()) / DAY)) : 0);
	const totalHours = $derived(start ? Math.max(0, Math.floor((now - start.getTime()) / HOUR)) : 0);
	const startLabel = $derived(start ? fullDateFixed(start) : '');
</script>

<div class="card p-5">
	<h2 class="font-hand text-2xl font-semibold text-ink/85">мы вместе уже</h2>

	{#if start}
		<div class="mt-3 flex items-end gap-3">
			<span class="text-6xl font-extrabold leading-none tabular-nums text-rose-deep">{days}</span>
			<span class="pb-1 text-lg font-bold text-ink/70">{plural(days, ['день', 'дня', 'дней'])}</span>
			<span class="animate-heartbeat pb-1 text-2xl">💗</span>
		</div>
		<p class="mt-2 text-sm text-ink/55">
			или {totalHours} {plural(totalHours, ['час', 'часа', 'часов'])} — и каждая по-своему счастье
		</p>
		<p class="mt-0.5 text-xs font-semibold text-ink/40">с {startLabel}</p>
	{:else}
		<p class="py-6 text-center text-sm text-ink/45">
			Добавь дату начала отношений в таблицу settings (ключ start_date).
		</p>
	{/if}
</div>
