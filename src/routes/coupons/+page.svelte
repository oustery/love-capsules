<script lang="ts">
	import { fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import type { Coupon, WishItem } from '$lib/types';
	import { WISH_CATEGORIES } from '$lib/config';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';
	import { fullDate } from '$lib/format';
	import Modal from '$lib/components/Modal.svelte';

	let loaded = $state(false);
	let coupons = $state<Coupon[]>([]);
	let wishlist = $state<WishItem[]>([]);

	// подтверждение активации
	let confirmOpen = $state(false);
	let pending = $state<Coupon | null>(null);
	let tearing = $state<string | null>(null);
	let justUsed = $state<string | null>(null);

	// новый пункт вишлиста
	let newWish = $state('');
	let newCat = $state<WishItem['category']>('place');
	let addingWish = $state(false);

	// новый купон прямо со страницы — доступно нам обоим, без админки
	let addOpen = $state(false);
	let nIcon = $state('🎟️');
	let nTitle = $state('');
	let nSub = $state('');
	let addingC = $state(false);

	// режим управления: выбросить купон, вернуть погашенный, убрать пункт плана
	let editMode = $state(false);
	let confirmId = $state<string | null>(null);

	function askDel(id: string) {
		buzz(10);
		if (confirmId === id) {
			confirmId = null;
			return true;
		}
		confirmId = id;
		setTimeout(() => (confirmId = null), 6000);
		return false;
	}

	const COUPON_ICONS = ['🎟️', '💌', '☕', '🍕', '🎬', '🎁', '💐', '✈️', '🌅', '🛋️'];

	async function addCouponHere() {
		const title = nTitle.trim();
		if (!title || addingC) return;
		addingC = true;
		try {
			const { data, error } = await supabase
				.from('coupons')
				.insert({ title, subtitle: nSub.trim() || null, icon: nIcon.trim() || '🎟️' })
				.select()
				.single();
			if (error || !data) {
				toast('Купон не напечатался 🥺');
				return;
			}
			coupons = [data as Coupon, ...coupons];
			addOpen = false;
			nTitle = '';
			nSub = '';
			nIcon = '🎟️';
			buzz([12, 40, 12]);
			toast('Купон напечатан! 🎟️');
		} finally {
			addingC = false;
		}
	}

	async function delCoupon(c: Coupon) {
		if (!askDel(c.id)) return;
		const { error } = await supabase.from('coupons').delete().eq('id', c.id);
		if (error) {
			toast('Купон не выбросился 🥺');
			return;
		}
		coupons = coupons.filter((x) => x.id !== c.id);
		buzz(12);
		toast('Купон убран 🗑️');
	}

	async function resetCoupon(c: Coupon) {
		buzz(12);
		const { error } = await supabase
			.from('coupons')
			.update({ status: 'active', used_at: null })
			.eq('id', c.id);
		if (error) {
			toast('Не вернулся в строй 🥺');
			return;
		}
		coupons = coupons.map((x) =>
			x.id === c.id ? { ...x, status: 'active' as const, used_at: null } : x
		);
		toast('Купон снова в строю! ✨');
	}

	async function delWish(w: WishItem) {
		if (!askDel(w.id)) return;
		const { error } = await supabase.from('wishlist').delete().eq('id', w.id);
		if (error) {
			toast('Не удалилось 🥺');
			return;
		}
		wishlist = wishlist.filter((x) => x.id !== w.id);
		buzz(12);
	}

	$effect(() => {
		if (!loaded) load();
	});

	async function load() {
		const [cRes, wRes] = await Promise.all([
			supabase.from('coupons').select('*').order('created_at'),
			supabase.from('wishlist').select('*').order('done').order('created_at')
		]);
		if (cRes.error || wRes.error) {
			toast('Купонник не загрузился 🥺');
		} else {
			coupons = (cRes.data ?? []) as Coupon[];
			wishlist = (wRes.data ?? []) as WishItem[];
		}
		loaded = true;
	}

	function askActivate(c: Coupon) {
		buzz(15);
		pending = c;
		confirmOpen = true;
	}

	async function activate() {
		if (!pending) return;
		const c = pending;
		confirmOpen = false;
		tearing = c.id; // анимация надрыва
		await new Promise((r) => setTimeout(r, 560));

		const { error } = await supabase
			.from('coupons')
			.update({ status: 'used', used_at: new Date().toISOString() })
			.eq('id', c.id);
		if (error) {
			tearing = null;
			toast('Купон не погасился 🥺');
			return;
		}
		coupons = coupons.map((x) =>
			x.id === c.id ? { ...x, status: 'used' as const, used_at: new Date().toISOString() } : x
		);
		tearing = null;
		justUsed = c.id;
		buzz([14, 50, 26]);
		toast('Купон активирован — домой с ним! 🎟️');
		setTimeout(() => (justUsed = null), 1600);
		pending = null;
	}

	async function toggleWish(w: WishItem) {
		const done = !w.done;
		w.done = done;
		w.done_at = done ? new Date().toISOString() : null;
		buzz(done ? [10, 40, 10] : 10);
		const { error } = await supabase
			.from('wishlist')
			.update({ done, done_at: done ? new Date().toISOString() : null })
			.eq('id', w.id);
		if (error) {
			w.done = !done;
			toast('Не сохранилось 🥺');
		}
	}

	async function addWish() {
		const title = newWish.trim();
		if (!title || addingWish) return;
		addingWish = true;
		try {
			const { data, error } = await supabase
				.from('wishlist')
				.insert({ title, category: newCat })
				.select()
				.single();
			if (error || !data) {
				toast('Не получилось добавить 🥺');
				return;
			}
			wishlist = [...wishlist, data as WishItem];
			newWish = '';
			buzz(14);
			toast('План в списке! ✨');
		} finally {
			addingWish = false;
		}
	}

	const activeCoupons = $derived(coupons.filter((c) => c.status === 'active'));
	const usedCoupons = $derived(coupons.filter((c) => c.status === 'used'));

	function catMeta(id: WishItem['category']) {
		return WISH_CATEGORIES.find((c) => c.id === id) ?? WISH_CATEGORIES[4];
	}
</script>

<svelte:head>
	<title>Купонник · Для тебя 💗</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
	<header>
		<h1 class="text-2xl font-extrabold text-ink">Купонник и планы</h1>
		<p class="mt-0.5 text-sm text-ink/55">предъявителю — исполнение по первому требованию</p>
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				onclick={() => (addOpen = true)}
				class="flex-1 rounded-2xl bg-linear-to-r from-rose to-peach py-3 text-sm font-extrabold text-white shadow-lift transition active:scale-95"
			>
				🎟️ Новый купон
			</button>
			<button
				type="button"
				onclick={() => {
					editMode = !editMode;
					confirmId = null;
					buzz(10);
				}}
				aria-label="Режим управления"
				class="rounded-2xl bg-shell px-4 py-3 text-sm font-extrabold text-ink/60 transition active:scale-95 {editMode
					? 'text-rose-deep ring-2 ring-rose'
					: ''}"
			>
				{editMode ? '✓ готово' : '✏️'}
			</button>
		</div>
		{#if editMode}
			<p class="mt-2 text-[11px] font-bold text-ink/40">
				режим управления: можно выбросить купон, вернуть погашенный или убрать пункт из планов
			</p>
		{/if}
	</header>

	<!-- Активные купоны -->
	<section class="mt-5 space-y-3.5">
		{#if loaded && coupons.length === 0}
			<div class="card p-6 text-center">
				<p class="text-4xl">🎟️</p>
				<p class="mt-2 font-hand text-2xl text-ink/70">Купоны ещё не напечатаны</p>
				<p class="mt-1 text-sm text-ink/50">Нажми «Новый купон» — он появится у нас обоих.</p>
			</div>
		{/if}

		{#each activeCoupons as c (c.id)}
			<div
				class="relative flex overflow-hidden rounded-3xl border border-white/80 bg-ivory shadow-soft {tearing === c.id
					? 'tearing'
					: ''}"
			>
				<!-- иконка -->
				<div class="flex w-[76px] shrink-0 items-center justify-center text-4xl">{c.icon}</div>
				<!-- перфорация -->
				<div class="relative w-px shrink-0">
					<span class="absolute -top-2.5 -left-[9px] h-5 w-5 rounded-full bg-cream"></span>
					<span class="absolute -bottom-2.5 -left-[9px] h-5 w-5 rounded-full bg-cream"></span>
					<span class="absolute top-2 h-[calc(100%-16px)] border-l-2 border-dashed border-ink/15"></span>
				</div>
				<!-- содержание -->
				<div class="min-w-0 flex-1 px-4 py-3.5">
					<p class="truncate text-[15px] font-extrabold text-ink">{c.title}</p>
					{#if c.subtitle}
						<p class="mt-0.5 line-clamp-2 text-xs text-ink/55">{c.subtitle}</p>
					{/if}
					{#if editMode}
						<button
							type="button"
							onclick={() => delCoupon(c)}
							class="mt-2.5 w-full rounded-2xl border-2 border-rose/30 bg-rose/10 py-2.5 text-xs font-extrabold text-rose-deep transition active:scale-95"
						>
							{confirmId === c.id ? 'точно выбросить? ✕' : '✕ выбросить купон'}
						</button>
					{:else}
						<button
							type="button"
							onclick={() => askActivate(c)}
							class="mt-2.5 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-2.5 text-xs font-extrabold text-white shadow-lift transition active:scale-95"
						>
							Активировать
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</section>

	<!-- Использованные -->
	{#if usedCoupons.length > 0}
		<section class="mt-6">
			<p class="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">уже использованы</p>
			<div class="space-y-2.5">
				{#each usedCoupons as c (c.id)}
					<div class="relative flex items-center gap-3 overflow-hidden rounded-3xl border border-white/70 bg-ivory/60 px-4 py-3 opacity-70">
						<span class="text-2xl">{c.icon}</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold text-ink/60 line-through">{c.title}</p>
							{#if c.used_at}
								<p class="text-[11px] font-semibold text-ink/40">активирован {fullDate(new Date(c.used_at))}</p>
							{/if}
						</div>
						{#if editMode}
							<div class="flex shrink-0 flex-col gap-1.5">
								<button
									type="button"
									onclick={() => resetCoupon(c)}
									aria-label="Вернуть купон в строй"
									class="flex h-9 w-9 items-center justify-center rounded-full bg-sage text-sm text-white transition active:scale-90"
								>
									↺
								</button>
								<button
									type="button"
									onclick={() => delCoupon(c)}
									aria-label="Удалить купон"
									class="flex h-9 w-9 items-center justify-center rounded-full bg-shell text-xs text-ink/50 transition active:scale-90"
								>
									{confirmId === c.id ? '✕!' : '✕'}
								</button>
							</div>
						{:else if justUsed === c.id}
							<span class="stamp-in shrink-0 rounded-xl border-2 border-rose-deep px-2.5 py-1 text-[11px] font-extrabold uppercase text-rose-deep">
								Использован
							</span>
						{:else}
							<span class="shrink-0 text-lg text-sage-deep">✓</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Вишлист -->
	<section class="mt-8">
		<div class="flex items-end justify-between">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">наши планы после возвращения</h2>
			<span class="text-xs font-extrabold text-ink/40">
				{wishlist.filter((w) => w.done).length}/{wishlist.length}
			</span>
		</div>

		<div class="mt-3 space-y-2.5">
			{#if loaded && wishlist.length === 0}
				<p class="card p-5 text-center text-sm text-ink/50">Список пуст — добавь первую мечту ниже.</p>
			{/if}
			{#each wishlist as w (w.id)}
				<div class="card flex w-full items-center gap-1 p-1.5 {w.done ? 'opacity-65' : ''}" in:fly>
					<button
						type="button"
						onclick={() => toggleWish(w)}
						class="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2.5 text-left transition active:scale-[0.98]"
					>
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition {w.done
								? 'bg-sage text-white'
								: 'bg-shell text-ink/30 shadow-inset'}"
						>
							{w.done ? '✓' : ''}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-bold text-ink {w.done ? 'line-through' : ''}">{w.title}</span>
						</span>
						<span class="shrink-0 text-lg">{catMeta(w.category).emoji}</span>
					</button>
					{#if editMode}
						<button
							type="button"
							onclick={() => delWish(w)}
							aria-label="Удалить план"
							class="shrink-0 rounded-2xl bg-shell px-3 py-2.5 text-xs font-extrabold text-ink/50 transition active:scale-90"
						>
							{confirmId === w.id ? 'точно?' : '✕'}
						</button>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Добавить пункт -->
		<div class="card mt-4 p-4">
			<input
				bind:value={newWish}
				placeholder="новое место, фильм, еда, дело…"
				maxlength="120"
				onkeydown={(e) => e.key === 'Enter' && addWish()}
				class="w-full rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-rose/40"
			/>
			<div class="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
				{#each WISH_CATEGORIES as cat (cat.id)}
					<button
						type="button"
						onclick={() => (newCat = cat.id)}
						class="shrink-0 rounded-2xl px-3 py-2 text-xs font-bold transition {newCat === cat.id
							? 'bg-rose/15 text-rose-deep ring-2 ring-rose'
							: 'bg-shell text-ink/55'}"
					>
						{cat.emoji} {cat.label}
					</button>
				{/each}
			</div>
			<button
				type="button"
				onclick={addWish}
				disabled={!newWish.trim() || addingWish}
				class="mt-2.5 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-50"
			>
				{addingWish ? 'Добавляю…' : 'Добавить в список'}
			</button>
		</div>
	</section>
</div>

<!-- Новый купон — для нас обоих, без админки -->
<Modal bind:open={addOpen} title="Новый купон">
	<div>
		<p class="text-xs font-bold text-ink/55">эмодзи</p>
		<div class="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
			{#each COUPON_ICONS as e (e)}
				<button
					type="button"
					onclick={() => (nIcon = e)}
					class="shrink-0 rounded-2xl px-2.5 py-2 text-lg transition {nIcon === e
						? 'bg-rose/15 ring-2 ring-rose'
						: 'bg-shell'}"
				>
					{e}
				</button>
			{/each}
		</div>
		<input
			bind:value={nIcon}
			maxlength="4"
			aria-label="Свой эмодзи"
			placeholder="или свой"
			class="mt-1.5 w-24 rounded-2xl bg-shell px-4 py-2.5 text-center text-lg outline-none"
		/>
		<input
			bind:value={nTitle}
			placeholder="название купона"
			maxlength="40"
			class="mt-2.5 w-full rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
		/>
		<input
			bind:value={nSub}
			placeholder="условия исполнения"
			maxlength="80"
			class="mt-2.5 w-full rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
		/>
		<button
			type="button"
			onclick={addCouponHere}
			disabled={addingC || !nTitle.trim()}
			class="mt-4 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-50"
		>
			{addingC ? 'Печатаю…' : 'Напечатать купон 🎟️'}
		</button>
	</div>
</Modal>

<!-- Подтверждение активации -->
<Modal bind:open={confirmOpen} title="Активировать купон?">
	{#if pending}
		<div class="text-center">
			<p class="text-5xl">{pending.icon}</p>
			<p class="mt-3 text-lg font-extrabold text-ink">{pending.title}</p>
			<p class="mt-2 font-hand text-xl leading-snug text-ink/70">
				Купон одноразовый: после активации он надорвётся и его уже не вернуть. Подтверждаешь?
			</p>
			<div class="mt-5 flex gap-3">
				<button
					type="button"
					onclick={() => (confirmOpen = false)}
					class="flex-1 rounded-2xl bg-shell py-3.5 text-sm font-extrabold text-ink/70 transition active:scale-95"
				>
					Пока нет
				</button>
				<button
					type="button"
					onclick={activate}
					class="flex-1 rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95"
				>
					Надорвать 🎟️
				</button>
			</div>
		</div>
	{/if}
</Modal>
