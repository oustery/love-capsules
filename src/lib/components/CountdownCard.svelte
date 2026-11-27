<script lang="ts">
	import { plural } from '$lib/format';

	let { target, since, now }: { target: Date | null; since: Date | null; now: number } = $props();

	const DAY = 86_400_000;
	const HOUR = 3_600_000;
	const MIN = 60_000;
	const SEC = 1_000;

	const arrived = $derived(target !== null && now >= target.getTime());

	const parts = $derived.by(() => {
		if (!target) return null;
		const diff = Math.max(0, target.getTime() - now);
		return {
			d: Math.floor(diff / DAY),
			h: Math.floor((diff % DAY) / HOUR),
			m: Math.floor((diff % HOUR) / MIN),
			s: Math.floor((diff % MIN) / SEC)
		};
	});

	const tiles = $derived(
		parts
			? [
					{ n: parts.d, label: plural(parts.d, ['день', 'дня', 'дней']) },
					{ n: parts.h, label: plural(parts.h, ['час', 'часа', 'часов']) },
					{ n: parts.m, label: plural(parts.m, ['минута', 'минуты', 'минут']) },
					{ n: parts.s, label: plural(parts.s, ['секунда', 'секунды', 'секунд']) }
				]
			: []
	);

	const pct = $derived.by(() => {
		if (!target) return null;
		if (arrived) return 100;
		if (!since) return null;
		const total = target.getTime() - since.getTime();
		if (total <= 0) return null;
		const passed = now - since.getTime();
		return Math.min(100, Math.max(0, Math.round((passed / total) * 100)));
	});
</script>

<div class="card p-5">
	<div class="flex items-baseline justify-between">
		<h2 class="font-hand text-2xl font-semibold text-ink/85">до возвращения домой</h2>
		{#if pct !== null}
			<span class="text-xs font-extrabold text-rose-deep">{pct}%</span>
		{/if}
	</div>

	{#if arrived}
		<p class="py-8 text-center font-hand text-3xl text-rose-deep">Ты дома. Обнимаю! 🎉</p>
	{:else if parts}
		<div class="mt-4 grid grid-cols-4 gap-2.5">
			{#each tiles as t (t.label)}
				<div class="rounded-2xl bg-shell px-1 py-3 text-center shadow-inset">
					<div class="text-2xl font-extrabold tabular-nums text-ink">{String(t.n).padStart(2, '0')}</div>
					<div class="mt-0.5 text-[11px] font-bold text-ink/50">{t.label}</div>
				</div>
			{/each}
		</div>

		{#if pct !== null}
			<div class="mt-4 h-3 overflow-hidden rounded-full bg-shell shadow-inset">
				<div
					class="h-full rounded-full bg-linear-to-r from-rose to-peach transition-[width] duration-700 ease-out"
					style="width: {pct}%"
				></div>
			</div>
		{/if}
	{:else}
		<p class="py-6 text-center text-sm text-ink/45">
			Дата возвращения ещё не задана — добавь её в таблицу settings (ключ target_date).
		</p>
	{/if}
</div>
