<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/auth.svelte';
	import type { Coupon, MoodLog, Note, Photo, Reason, TimeCapsule } from '$lib/types';
	import { CAPSULE_META, CAPSULE_SLUGS } from '$lib/config';
	import { toast } from '$lib/toast.svelte';
	import { buzz } from '$lib/haptics';
	import { recorder, startRecording, stopRecording, discardRecording, mmss } from '$lib/recorder.svelte';
	import { compressImage, kb } from '$lib/image';
	import { uploadToMedia, deleteFromMedia, getSignedUrl } from '$lib/storage';
	import { fullDate, shortTime } from '$lib/format';

	let loaded = $state(false);
	let busy = $state(false);

	// — Замок админки: пароль проверяется по SHA-256 из settings (admin_password_hash) —
	let unlocked = $state(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('capsules_admin') === '1');
	let gateWord = $state('');
	let gateBusy = $state(false);

	// — Даты —
	let targetDate = $state('');
	let targetFrom = $state('');
	let startDate = $state('');

	// — Статистика —
	let missToday = $state(0);
	let missTotal = $state(0);
	let recentMoods = $state<MoodLog[]>([]);
	let usedCoupons = $state<Coupon[]>([]);

	// — Управление содержимым (полный список, не только добавление) —
	let timeCapsules = $state<TimeCapsule[]>([]);
	let allCoupons = $state<Coupon[]>([]);
	let supportPhrases = $state<Note[]>([]);
	let reasons = $state<Reason[]>([]);
	let photos = $state<Photo[]>([]);
	let photoUrls = $state<Record<string, string>>({});
	let confirmKind = $state<string | null>(null);
	let confirmId = $state<string | null>(null);

	// — Смена пароля админки —
	let pwOld = $state('');
	let pwNew = $state('');
	let pwRepeat = $state('');

	function askDel(kind: string, id: string) {
		buzz(10);
		if (confirmKind === kind && confirmId === id) {
			confirmKind = null;
			confirmId = null;
			return true;
		}
		confirmKind = kind;
		confirmId = id;
		setTimeout(() => {
			if (confirmId === id) {
				confirmKind = null;
				confirmId = null;
			}
		}, 6000);
		return false;
	}

	// — Диктофон —
	let dest = $state<'capsule' | 'time'>('capsule');
	let destSlug = $state<(typeof CAPSULE_SLUGS)[number]>('sad');
	let unlockAt = $state('');
	let letterTitle = $state('');
	let letter = $state('');
	let publishing = $state(false);

	// — Фото —
	interface PhotoDraft {
		preview: string;
		blob: Blob;
		origKB: number;
		webpKB: number;
	}
	let drafts = $state<PhotoDraft[]>([]);
	let photoBusy = $state(false);
	let photoCaption = $state('');
	let photoDate = $state('');
	let fileInput: HTMLInputElement | null = $state(null);

	// — Контент —
	let supportText = $state('');
	let reasonsText = $state('');
	let couponTitle = $state('');
	let couponSubtitle = $state('');
	let couponIcon = $state('🎟️');

	$effect(() => {
		if (!loaded && auth.session && unlocked) loadAll();
	});

	async function sha256Hex(text: string): Promise<string> {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
		return Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	async function tryUnlock() {
		if (gateBusy) return;
		gateBusy = true;
		try {
			const { data, error } = await supabase
				.from('settings')
				.select('value')
				.eq('key', 'admin_password_hash')
				.single();
			const stored = ((data?.value as string | undefined) ?? '').trim().toLowerCase();
			const given = await sha256Hex(gateWord.trim());
			if (error || !stored || given !== stored) {
				toast('Не тот пароль 🙈');
				return;
			}
			sessionStorage.setItem('capsules_admin', '1');
			unlocked = true;
			gateWord = '';
			buzz([12, 40, 12]);
			toast('Админка открыта 💛');
		} finally {
			gateBusy = false;
		}
	}

	async function loadAll() {
		const [setRes, missRes, missTotalRes, moodRes, coupRes, tcRes, notesRes, reasonsRes, photosRes] =
			await Promise.all([
				supabase.from('settings').select('key, value'),
				supabase
					.from('miss_clicks')
					.select('clicked_at', { count: 'exact', head: true })
					.gte('clicked_at', startOfToday()),
				supabase.from('miss_clicks').select('clicked_at', { count: 'exact', head: true }),
				supabase.from('mood_logs').select('*').order('created_at', { ascending: false }).limit(5),
				supabase.from('coupons').select('*').order('created_at'),
				supabase.from('time_capsules').select('*').order('unlock_at'),
				supabase
					.from('notes')
					.select('*')
					.eq('kind', 'support')
					.order('created_at', { ascending: false }),
				supabase.from('reasons').select('*').order('position'),
				supabase.from('photos').select('*').order('created_at', { ascending: false }).limit(60)
			]);

		if (setRes.data) {
			const map: Record<string, string> = {};
			for (const row of setRes.data as { key: string; value: string }[]) map[row.key] = row.value;
			targetDate = toLocalInput(map['target_date']);
			targetFrom = toLocalInput(map['target_from']);
			startDate = toDayInput(map['start_date']);
		}
		missToday = missRes.count ?? 0;
		missTotal = missTotalRes.count ?? 0;
		recentMoods = (moodRes.data ?? []) as MoodLog[];
		allCoupons = (coupRes.data ?? []) as Coupon[];
		usedCoupons = allCoupons.filter((c) => c.status === 'used').slice(0, 8);
		timeCapsules = (tcRes.data ?? []) as TimeCapsule[];
		supportPhrases = (notesRes.data ?? []) as Note[];
		reasons = (reasonsRes.data ?? []) as Reason[];
		photos = (photosRes.data ?? []) as Photo[];
		loaded = true;

		// превью фото по подписанным ссылкам (лениво, параллельно)
		for (const p of photos) {
			getSignedUrl(p.storage_path).then((url) => {
				if (url) photoUrls = { ...photoUrls, [p.id]: url };
			});
		}
	}

	function startOfToday(): string {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.toISOString();
	}

	// Значения дат в форме показываем в тайзоне проекта (+03) — чтобы календарные даты не «уезжали» на день
	function mskParts(d: Date): string {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Europe/Moscow',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.format(d)
			.replace(',', '');
	}

	function toLocalInput(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const [date, time] = mskParts(d).split(' ');
		return `${date}T${time}`;
	}

	function toDayInput(iso: string | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return mskParts(d).split(' ')[0];
	}

	// — Сохранение дат —
	async function saveDates() {
		busy = true;
		try {
			const rows: { key: string; value: string }[] = [];
			if (targetDate) rows.push({ key: 'target_date', value: new Date(targetDate).toISOString() });
			if (targetFrom) rows.push({ key: 'target_from', value: new Date(targetFrom).toISOString() });
			if (startDate) rows.push({ key: 'start_date', value: new Date(`${startDate}T00:00:00`).toISOString() });
			if (rows.length === 0) {
				toast('Сначала заполни хотя бы одну дату');
				return;
			}
			const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
			if (error) {
				toast('Даты не сохранились 🥺');
				return;
			}
			buzz([12, 40, 12]);
			toast('Даты обновлены 💛');
		} finally {
			busy = false;
		}
	}

	// — Публикация письма/голоса —
	async function publish() {
		if (publishing) return;
		if (!recorder.blob && !letter.trim()) {
			toast('Запиши голосовое или напиши текст письма');
			return;
		}
		publishing = true;
		try {
			let audioPath: string | null = null;
			if (recorder.blob) {
				audioPath = `audio/${dest === 'time' ? 'time' : destSlug}-${Date.now()}.${recorder.ext}`;
				const ok = await uploadToMedia(audioPath, recorder.blob, recorder.blob.type);
				if (!ok) {
					toast('Аудио не загрузилось в хранилище 🥺');
					return;
				}
			}
			if (dest === 'time') {
				if (!unlockAt) {
					toast('Выбери дату открытия капсулы времени');
					return;
				}
				const { error } = await supabase.from('time_capsules').insert({
					title: letterTitle.trim() || 'Письмо в будущее',
					body: letter.trim() || null,
					audio_path: audioPath,
					unlock_at: new Date(unlockAt).toISOString()
				});
				if (error) {
					toast('Капсула времени не сохранилась 🥺');
					return;
				}
			} else {
				const { error } = await supabase
					.from('capsules')
					.update({ body: letter.trim() || null, audio_path: audioPath })
					.eq('slug', destSlug);
				if (error) {
					toast('Капсула не сохранилась 🥺');
					return;
				}
			}
			buzz([14, 50, 26]);
			toast('Опубликовано! 💛');
			discardRecording();
			letter = '';
			letterTitle = '';
			unlockAt = '';
		} finally {
			publishing = false;
		}
	}

	// — Фото —
	async function onPickPhotos(e: Event) {
		const files = Array.from((e.target as HTMLInputElement).files ?? []);
		if (files.length === 0) return;
		photoBusy = true;
		try {
			for (const f of files) {
				if (!f.type.startsWith('image/')) continue;
				const { blob } = await compressImage(f);
				drafts = [
					...drafts,
					{
						preview: URL.createObjectURL(blob),
						blob,
						origKB: Math.round(f.size / 1024),
						webpKB: Math.round(blob.size / 1024)
					}
				];
			}
		} finally {
			photoBusy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function removeDraft(i: number) {
		URL.revokeObjectURL(drafts[i].preview);
		drafts = drafts.filter((_, j) => j !== i);
	}

	async function uploadPhotos() {
		if (drafts.length === 0 || photoBusy) return;
		photoBusy = true;
		try {
			let done = 0;
			const stamp = Date.now();
			for (const [i, d] of drafts.entries()) {
				const path = `photos/${stamp}-${i}.webp`;
				const ok = await uploadToMedia(path, d.blob, 'image/webp');
				if (!ok) continue;
				const { error } = await supabase.from('photos').insert({
					storage_path: path,
					caption: photoCaption.trim() || null,
					taken_at: photoDate || null
				});
				if (!error) done++;
			}
			if (done > 0) {
				buzz([14, 50, 20]);
				toast(`Загружено фото: ${done} из ${drafts.length} 📷`);
			} else {
				toast('Фото не загрузились 🥺');
			}
			drafts.forEach((d) => URL.revokeObjectURL(d.preview));
			drafts = [];
			photoCaption = '';
			photoDate = '';
		} finally {
			photoBusy = false;
		}
	}

	// — Контент —
	async function addSupportPhrases() {
		const lines = supportText.split('\n').map((s) => s.trim()).filter(Boolean);
		if (lines.length === 0) return;
		busy = true;
		try {
			const { error } = await supabase.from('notes').insert(lines.map((body) => ({ kind: 'support', body })));
			if (error) {
				toast('Фразы не добавились 🥺');
				return;
			}
			toast(`В баночку добавлено фраз: ${lines.length} 🍪`);
			supportText = '';
		} finally {
			busy = false;
		}
	}

	async function addReasons() {
		const lines = reasonsText.split('\n').map((s) => s.trim()).filter(Boolean);
		if (lines.length === 0) return;
		busy = true;
		try {
			const { data: maxRow } = await supabase
				.from('reasons')
				.select('position')
				.order('position', { ascending: false })
				.limit(1);
			const next = ((maxRow?.[0]?.position as number | undefined) ?? 0) + 1;
			const rows = lines.map((text, i) => ({ position: next + i, text }));
			const { error } = await supabase.from('reasons').insert(rows);
			if (error) {
				toast('Причины не добавились 🥺 (проверь, что числа позиций не заняты)');
				return;
			}
			toast(`В колоду добавлено причин: ${lines.length} 🃏`);
			reasonsText = '';
		} finally {
			busy = false;
		}
	}

	async function addCoupon() {
		const title = couponTitle.trim();
		if (!title) return;
		busy = true;
		try {
			const { error } = await supabase.from('coupons').insert({
				title,
				subtitle: couponSubtitle.trim() || null,
				icon: couponIcon.trim() || '🎟️'
			});
			if (error) {
				toast('Купон не добавился 🥺');
				return;
			}
			toast('Купон напечатан! 🎟️');
			couponTitle = '';
			couponSubtitle = '';
			couponIcon = '🎟️';
			const { data } = await supabase.from('coupons').select('*').order('created_at');
			allCoupons = (data ?? []) as Coupon[];
		} finally {
			busy = false;
		}
	}

	// — Капсулы времени: список и удаление —
	async function delTimeCapsule(tc: TimeCapsule) {
		if (!askDel('tc', tc.id)) return;
		const { error } = await supabase.from('time_capsules').delete().eq('id', tc.id);
		if (error) {
			toast('Капсула не удалилась 🥺');
			return;
		}
		if (tc.audio_path) await deleteFromMedia(tc.audio_path);
		timeCapsules = timeCapsules.filter((x) => x.id !== tc.id);
		buzz(12);
		toast('Капсула удалена 🗑️');
	}

	// — Купоны: вернуть в строй / выбросить —
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
		allCoupons = allCoupons.map((x) =>
			x.id === c.id ? { ...x, status: 'active' as const, used_at: null } : x
		);
		toast('Купон снова в строю! ✨');
	}

	async function delCoupon(c: Coupon) {
		if (!askDel('coupon', c.id)) return;
		const { error } = await supabase.from('coupons').delete().eq('id', c.id);
		if (error) {
			toast('Купон не выбросился 🥺');
			return;
		}
		allCoupons = allCoupons.filter((x) => x.id !== c.id);
		buzz(12);
		toast('Купон убран 🗑️');
	}

	// — Баночка и колода: удаление фраз и причин —
	async function delPhrase(n: Note) {
		if (!askDel('note', n.id)) return;
		const { error } = await supabase.from('notes').delete().eq('id', n.id);
		if (error) {
			toast('Фраза не удалилась 🥺');
			return;
		}
		supportPhrases = supportPhrases.filter((x) => x.id !== n.id);
		buzz(12);
	}

	async function delReason(r: Reason) {
		if (!askDel('reason', r.id)) return;
		const { error } = await supabase.from('reasons').delete().eq('id', r.id);
		if (error) {
			toast('Причина не удалилась 🥺');
			return;
		}
		reasons = reasons.filter((x) => x.id !== r.id);
		buzz(12);
	}

	// — Фото: удалить из хранилища и из базы —
	async function delPhoto(p: Photo) {
		if (!askDel('photo', p.id)) return;
		await deleteFromMedia(p.storage_path);
		const { error } = await supabase.from('photos').delete().eq('id', p.id);
		if (error) {
			toast('Фото не удалилось 🥺');
			return;
		}
		photos = photos.filter((x) => x.id !== p.id);
		buzz(12);
		toast('Фото удалено 🗑️');
	}

	// — Смена пароля админки (это не кодовое слово входа!) —
	async function changePassword() {
		const next = pwNew.trim();
		if (next.length < 6) {
			toast('Новый пароль — минимум 6 символов');
			return;
		}
		if (next !== pwRepeat.trim()) {
			toast('Пароли не совпадают 🙈');
			return;
		}
		busy = true;
		try {
			const { data, error } = await supabase
				.from('settings')
				.select('value')
				.eq('key', 'admin_password_hash')
				.single();
			const stored = ((data?.value as string | undefined) ?? '').trim().toLowerCase();
			const given = await sha256Hex(pwOld.trim());
			if (error || !stored || given !== stored) {
				toast('Старый пароль не тот 🙈');
				return;
			}
			const { error: upErr } = await supabase
				.from('settings')
				.upsert({ key: 'admin_password_hash', value: await sha256Hex(next) }, { onConflict: 'key' });
			if (upErr) {
				toast('Пароль не сохранился 🥺');
				return;
			}
			pwOld = '';
			pwNew = '';
			pwRepeat = '';
			buzz([12, 40, 12]);
			toast('Пароль админки обновлён 🔐');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Админка · Для тебя 💗</title>
</svelte:head>

{#if !unlocked}
	<!-- Замок: админка открывается только по паролю -->
	<div class="flex min-h-dvh items-center justify-center px-6">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				tryUnlock();
			}}
			class="card w-full max-w-sm p-6 text-center"
		>
			<div class="text-5xl">🔐</div>
			<h1 class="mt-3 font-hand text-3xl font-semibold text-ink/85">админка под замком</h1>
			<p class="mt-1 text-sm text-ink/55">введи наш тайный пароль</p>
			<input
				type="password"
				bind:value={gateWord}
				autocomplete="current-password"
				placeholder="пароль"
				class="mt-4 w-full rounded-2xl bg-shell px-4 py-3 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40"
			/>
			<button
				type="submit"
				disabled={gateBusy || !gateWord.trim()}
				class="mt-3 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
			>
				{gateBusy ? 'Проверяю…' : 'Открыть 🔓'}
			</button>
			<p class="mt-3 text-xs text-ink/40">пароль знает только он 💛</p>
		</form>
	</div>
{:else if !loaded}
	<div class="flex min-h-dvh items-center justify-center">
		<span class="animate-heartbeat text-5xl">🤍</span>
	</div>
{:else}
	<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
		<header>
			<h1 class="text-2xl font-extrabold text-ink">Админка</h1>
			<p class="mt-0.5 text-sm text-ink/55">управление содержимым — прямо с телефона</p>
		</header>

		<!-- 1. Даты и статус -->
		<section class="card mt-5 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">даты и статус</h2>

			<label class="mt-3 block text-xs font-bold text-ink/55">
				возвращение домой (target_date)
				<input type="datetime-local" bind:value={targetDate} class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40" />
			</label>
			<label class="mt-2.5 block text-xs font-bold text-ink/55">
				прогресс считается с (target_from)
				<input type="datetime-local" bind:value={targetFrom} class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40" />
			</label>
			<label class="mt-2.5 block text-xs font-bold text-ink/55">
				начало отношений (start_date)
				<input type="date" bind:value={startDate} class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40" />
			</label>
			<button
				type="button"
				onclick={saveDates}
				disabled={busy}
				class="mt-3 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
			>
				{busy ? 'Сохраняю…' : 'Сохранить даты'}
			</button>

			<div class="mt-4 grid grid-cols-2 gap-2 text-center">
				<div class="rounded-2xl bg-shell py-3">
					<div class="text-xl font-extrabold text-rose-deep">{missToday}</div>
					<div class="text-[10px] font-bold text-ink/45">«скучаю» сегодня</div>
				</div>
				<div class="rounded-2xl bg-shell py-3">
					<div class="text-xl font-extrabold text-rose-deep">{missTotal}</div>
					<div class="text-[10px] font-bold text-ink/45">«скучаю» всего</div>
				</div>
				<div class="rounded-2xl bg-shell py-3">
					<div class="text-xl font-extrabold text-rose-deep">{allCoupons.filter((c) => c.status === 'used').length}</div>
					<div class="text-[10px] font-bold text-ink/45">купонов погашено</div>
				</div>
				<div class="rounded-2xl bg-shell py-3">
					<div class="text-xl font-extrabold text-rose-deep">{timeCapsules.length}</div>
					<div class="text-[10px] font-bold text-ink/45">капсул времени</div>
				</div>
			</div>

			{#if recentMoods.length > 0}
				<p class="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink/40">последние настроения</p>
				<div class="mt-1.5 space-y-1.5">
					{#each recentMoods as m (m.id)}
						<div class="rounded-2xl bg-shell px-3.5 py-2">
							<div class="flex justify-between text-sm font-bold text-ink/75">
								<span class="truncate">{m.mood}</span>
								<span class="shrink-0 pl-2 text-[11px] font-semibold text-ink/40">{shortTime(new Date(m.created_at))}</span>
							</div>
							{#if m.note}
								<p class="mt-0.5 text-xs text-ink/55">{m.note}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if usedCoupons.length > 0}
				<p class="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink/40">активированные купоны</p>
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					{#each usedCoupons as c (c.id)}
						<span class="rounded-full bg-shell px-3 py-1.5 text-xs font-bold text-ink/60">
							{c.icon} {c.title}
						</span>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 2. Диктофон -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">диктофон</h2>
			<p class="mt-0.5 text-xs text-ink/50">запиши голосовое для капсулы — телефон всё умеет сам</p>

			<div class="mt-4 flex items-center justify-center gap-4">
				<button
					type="button"
					aria-label={recorder.active ? 'Остановить запись' : 'Начать запись'}
					onclick={async () => {
						if (recorder.active) {
							stopRecording();
							buzz(20);
						} else {
							buzz(12);
							await startRecording();
						}
					}}
					class="flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lift transition active:scale-90 {recorder.active
						? 'bg-ink'
						: 'animate-heartbeat bg-linear-to-br from-rose to-peach'}"
				>
					{recorder.active ? '⏹' : '⏺'}
				</button>
				<div class="text-center">
					<p class="text-3xl font-extrabold tabular-nums text-ink">{mmss(recorder.seconds)}</p>
					<p class="text-xs font-bold text-ink/45">{recorder.active ? 'идёт запись…' : 'к записи'}</p>
				</div>
			</div>
			{#if recorder.error}
				<p class="mt-3 rounded-2xl bg-rose/10 px-4 py-2.5 text-center text-xs font-bold text-rose-deep">{recorder.error}</p>
			{/if}

			{#if recorder.url}
				<div in:fade class="mt-4">
					<p class="text-[11px] font-bold uppercase tracking-wide text-ink/40">прослушать перед отправкой</p>
					<audio controls src={recorder.url} class="mt-1.5 w-full"></audio>
					<button
						type="button"
						onclick={discardRecording}
						class="mt-2 w-full rounded-2xl bg-shell py-2.5 text-xs font-extrabold text-ink/60 transition active:scale-95"
					>
						↺ Записать заново
					</button>
				</div>
			{/if}

			<div class="mt-4 rounded-3xl bg-shell p-4">
				<div class="flex gap-1.5">
					<button
						type="button"
						onclick={() => (dest = 'capsule')}
						class="flex-1 rounded-2xl py-2.5 text-xs font-extrabold transition {dest === 'capsule'
							? 'bg-rose/15 text-rose-deep ring-2 ring-rose'
							: 'bg-ivory text-ink/55'}"
					>
						💌 «Открой, когда...»
					</button>
					<button
						type="button"
						onclick={() => (dest = 'time')}
						class="flex-1 rounded-2xl py-2.5 text-xs font-extrabold transition {dest === 'time'
							? 'bg-rose/15 text-rose-deep ring-2 ring-rose'
							: 'bg-ivory text-ink/55'}"
					>
						⏳ Капсула времени
					</button>
				</div>

				{#if dest === 'capsule'}
					<select bind:value={destSlug} class="mt-3 w-full rounded-2xl bg-ivory px-4 py-3 text-sm font-semibold outline-none">
						{#each CAPSULE_SLUGS as slug (slug)}
							<option value={slug}>{CAPSULE_META[slug].emoji} {CAPSULE_META[slug].hint}</option>
						{/each}
					</select>
				{:else}
					<input
						type="datetime-local"
						bind:value={unlockAt}
						class="mt-3 w-full rounded-2xl bg-ivory px-4 py-3 text-sm font-semibold outline-none"
					/>
					<input
						bind:value={letterTitle}
						placeholder="заголовок письма"
						maxlength="80"
						class="mt-2.5 w-full rounded-2xl bg-ivory px-4 py-3 text-sm font-semibold outline-none placeholder:text-ink/35"
					/>
				{/if}

				<textarea
					bind:value={letter}
					rows="3"
					maxlength="2000"
					placeholder="текст письма (можно без аудио — просто письмо)"
					class="mt-2.5 w-full resize-none rounded-2xl bg-ivory px-4 py-3 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-rose/40"
				></textarea>

				<button
					type="button"
					onclick={publish}
					disabled={publishing}
					class="mt-2.5 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
				>
					{publishing ? 'Публикую…' : 'Опубликовать 🚀'}
				</button>
			</div>
		</section>

		<!-- 2а. Капсулы времени: что уже запланировано -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">капсулы времени</h2>
			<p class="mt-0.5 text-xs text-ink/50">письма в будущее: видно, что и когда откроется</p>

			{#if timeCapsules.length === 0}
				<p class="mt-3 rounded-2xl bg-shell px-4 py-3 text-sm text-ink/50">
					Пока нет ни одной — запиши в диктофоне выше («Капсула времени»).
				</p>
			{:else}
				<div class="mt-3 space-y-2">
					{#each timeCapsules as tc (tc.id)}
						<div class="rounded-2xl bg-shell px-3.5 py-3" in:fly>
							<div class="flex items-center gap-2.5">
								<span class="text-xl">{new Date(tc.unlock_at).getTime() > Date.now() ? '⏳' : '📬'}</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-bold text-ink/80">{tc.title}</p>
									<p class="text-[11px] font-semibold text-ink/45">
										откроется {fullDate(new Date(tc.unlock_at))}
										{#if tc.opened_at} · уже открыта{/if}
									</p>
								</div>
								{#if tc.audio_path}<span title="есть голосовое">🎧</span>{/if}
								{#if tc.body}<span title="есть текст">📜</span>{/if}
								<button
									type="button"
									onclick={() => delTimeCapsule(tc)}
									aria-label="Удалить капсулу"
									class="shrink-0 rounded-xl bg-ivory px-2.5 py-1.5 text-xs font-extrabold transition active:scale-90 {confirmKind === 'tc' && confirmId === tc.id
										? 'text-rose-deep ring-2 ring-rose'
										: 'text-ink/40'}"
								>
									{confirmKind === 'tc' && confirmId === tc.id ? 'точно?' : '✕'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 3. Фото -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">фотографии</h2>
			<p class="mt-0.5 text-xs text-ink/50">сожму до 1400px и переведу в WebP — легче и быстрее</p>

			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				multiple
				onchange={onPickPhotos}
				class="mt-3 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold text-ink/60 file:mr-3 file:rounded-xl file:border-0 file:bg-rose file:px-3 file:py-1.5 file:text-xs file:font-extrabold file:text-white"
			/>

			{#if photoBusy}
				<p class="mt-2 text-xs font-bold text-ink/45">Сжимаю…</p>
			{/if}

			{#if drafts.length > 0}
				<div class="mt-3 grid grid-cols-3 gap-2">
					{#each drafts as d, i (d.preview)}
						<div class="relative" in:fly>
							<img src={d.preview} alt="превью" class="aspect-square w-full rounded-2xl object-cover" />
							<p class="mt-1 text-center text-[10px] font-bold text-sage-deep">{d.origKB} → {d.webpKB} КБ</p>
							<button
								type="button"
								aria-label="Убрать фото"
								onclick={() => removeDraft(i)}
								class="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs text-white"
							>
								✕
							</button>
						</div>
					{/each}
				</div>
				<input
					bind:value={photoDate}
					type="date"
					class="mt-3 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none"
				/>
				<input
					bind:value={photoCaption}
					placeholder="тёплая подпись к фото"
					maxlength="60"
					class="mt-2.5 w-full rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
				/>
				<button
					type="button"
					onclick={uploadPhotos}
					disabled={photoBusy}
					class="mt-2.5 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
				>
					{photoBusy ? 'Загружаю…' : `Загрузить (${drafts.length})`}
				</button>
			{/if}

			{#if photos.length > 0}
				<p class="mt-5 text-[11px] font-bold uppercase tracking-wide text-ink/40">
					уже загруженные ({photos.length}) — ✕ удаляет фото навсегда
				</p>
				<div class="mt-2 grid grid-cols-3 gap-2">
					{#each photos as p (p.id)}
						<div class="relative" in:fly>
							{#if photoUrls[p.id]}
								<img
									src={photoUrls[p.id]}
									alt={p.caption ?? 'наше фото'}
									loading="lazy"
									class="aspect-square w-full rounded-2xl object-cover"
								/>
							{:else}
								<div class="aspect-square w-full animate-pulse rounded-2xl bg-shell"></div>
							{/if}
							{#if p.caption}
								<p class="mt-0.5 truncate text-center text-[10px] font-semibold text-ink/50">{p.caption}</p>
							{/if}
							<button
								type="button"
								onclick={() => delPhoto(p)}
								aria-label="Удалить фото"
								class="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white transition active:scale-90 {confirmKind === 'photo' && confirmId === p.id
									? 'bg-rose-deep'
									: 'bg-ink/80'}"
							>
								{confirmKind === 'photo' && confirmId === p.id ? '?!' : '✕'}
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mt-5 text-xs text-ink/45">Загруженных фото пока нет.</p>
			{/if}
		</section>

		<!-- 3а. Купонник: полный список с управлением -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">купонник</h2>
			<p class="mt-0.5 text-xs text-ink/50">↺ вернуть погашенный в строй, ✕ — выбросить совсем</p>

			{#if allCoupons.length === 0}
				<p class="mt-3 rounded-2xl bg-shell px-4 py-3 text-sm text-ink/50">
					Купонов пока нет — напечатай ниже или прямо на странице купонника.
				</p>
			{:else}
				<div class="mt-3 space-y-2">
					{#each allCoupons as c (c.id)}
						<div class="flex items-center gap-2.5 rounded-2xl bg-shell px-3.5 py-2.5" in:fly>
							<span class="text-xl">{c.icon}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-bold text-ink/80 {c.status === 'used' ? 'line-through opacity-60' : ''}">
									{c.title}
								</p>
								{#if c.status === 'used' && c.used_at}
									<p class="text-[11px] font-semibold text-ink/45">погашен {fullDate(new Date(c.used_at))}</p>
								{/if}
							</div>
							{#if c.status === 'used'}
								<button
									type="button"
									onclick={() => resetCoupon(c)}
									aria-label="Вернуть купон в строй"
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-sm text-white transition active:scale-90"
								>
									↺
								</button>
							{/if}
							<button
								type="button"
								onclick={() => delCoupon(c)}
								aria-label="Удалить купон"
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition active:scale-90 {confirmKind === 'coupon' && confirmId === c.id
									? 'bg-rose-deep text-white'
									: 'bg-ivory text-ink/40'}"
							>
								{confirmKind === 'coupon' && confirmId === c.id ? '?!' : '✕'}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 4. Контент -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">контент</h2>

			<!-- баночка -->
			<label class="mt-3 block text-xs font-bold text-ink/55">
				🍪 фразы в баночку поддержки — по одной в строке
				<textarea
					bind:value={supportText}
					rows="3"
					placeholder={'Ты справишься.\nЯ рядом, всегда.'}
					class="mt-1 w-full resize-none rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
				></textarea>
			</label>
			<button
				type="button"
				onclick={addSupportPhrases}
				disabled={busy || !supportText.trim()}
				class="mt-2 w-full rounded-2xl bg-ivory py-3 text-xs font-extrabold text-ink/70 shadow-soft transition active:scale-95 disabled:opacity-50"
			>
				Добавить в баночку
			</button>

			{#if supportPhrases.length > 0}
				<details class="mt-2 rounded-2xl bg-shell px-4 py-3">
					<summary class="cursor-pointer text-xs font-extrabold text-ink/55">
						в баночке сейчас: {supportPhrases.length} 🍪 — ✕ убирает фразу
					</summary>
					<div class="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
						{#each supportPhrases as n (n.id)}
							<div class="flex items-center gap-2 rounded-xl bg-ivory px-3 py-2" in:fly>
								<p class="min-w-0 flex-1 truncate text-xs text-ink/70">{n.body}</p>
								<button
									type="button"
									onclick={() => delPhrase(n)}
									aria-label="Удалить фразу"
									class="shrink-0 text-xs font-extrabold transition active:scale-90 {confirmKind === 'note' && confirmId === n.id
										? 'text-rose-deep'
										: 'text-ink/30'}"
								>
									{confirmKind === 'note' && confirmId === n.id ? 'точно?' : '✕'}
								</button>
							</div>
						{/each}
					</div>
				</details>
			{/if}

			<!-- причины -->
			<label class="mt-5 block text-xs font-bold text-ink/55">
				🃏 новые причины в колоду — по одной в строке (встанут в конец колоды)
				<textarea
					bind:value={reasonsText}
					rows="3"
					placeholder={'Твоя поддержка в трудный день.\nТо, как ты смеёшься по утрам.'}
					class="mt-1 w-full resize-none rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
				></textarea>
			</label>
			<button
				type="button"
				onclick={addReasons}
				disabled={busy || !reasonsText.trim()}
				class="mt-2 w-full rounded-2xl bg-ivory py-3 text-xs font-extrabold text-ink/70 shadow-soft transition active:scale-95 disabled:opacity-50"
			>
				Добавить в колоду
			</button>

			{#if reasons.length > 0}
				<details class="mt-2 rounded-2xl bg-shell px-4 py-3">
					<summary class="cursor-pointer text-xs font-extrabold text-ink/55">
						в колоде сейчас: {reasons.length} 🃏 — ✕ убирает причину
					</summary>
					<div class="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
						{#each reasons as r (r.id)}
							<div class="flex items-center gap-2 rounded-xl bg-ivory px-3 py-2" in:fly>
								<span class="shrink-0 text-[10px] font-extrabold text-ink/35">{r.position}</span>
								<p class="min-w-0 flex-1 truncate text-xs text-ink/70">{r.text}</p>
								<button
									type="button"
									onclick={() => delReason(r)}
									aria-label="Удалить причину"
									class="shrink-0 text-xs font-extrabold transition active:scale-90 {confirmKind === 'reason' && confirmId === r.id
										? 'text-rose-deep'
										: 'text-ink/30'}"
								>
									{confirmKind === 'reason' && confirmId === r.id ? 'точно?' : '✕'}
								</button>
							</div>
						{/each}
					</div>
				</details>
			{/if}

			<!-- купон -->
			<p class="mt-5 text-xs font-bold text-ink/55">🎟️ новый купон</p>
			<div class="mt-1.5 flex gap-2">
				<input
					bind:value={couponIcon}
					maxlength="4"
					aria-label="Эмодзи купона"
					class="w-16 shrink-0 rounded-2xl bg-shell px-4 py-3 text-center text-lg outline-none"
				/>
				<input
					bind:value={couponTitle}
					placeholder="название купона"
					maxlength="40"
					class="min-w-0 flex-1 rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
				/>
			</div>
			<input
				bind:value={couponSubtitle}
				placeholder="условия исполнения"
				maxlength="80"
				class="mt-2.5 w-full rounded-2xl bg-shell px-4 py-3 text-sm outline-none placeholder:text-ink/35"
			/>
			<button
				type="button"
				onclick={addCoupon}
				disabled={busy || !couponTitle.trim()}
				class="mt-2.5 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3 text-xs font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-50"
			>
				Напечатать купон
			</button>
		</section>

		<!-- 5. Безопасность -->
		<section class="card mt-4 p-5">
			<h2 class="font-hand text-2xl font-semibold text-ink/85">безопасность</h2>
			<p class="mt-0.5 text-xs text-ink/50">пароль этой админки (кодовое слово входа меняется не здесь)</p>

			<label class="mt-3 block text-xs font-bold text-ink/55">
				старый пароль
				<input
					type="password"
					bind:value={pwOld}
					autocomplete="current-password"
					class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40"
				/>
			</label>
			<label class="mt-2.5 block text-xs font-bold text-ink/55">
				новый пароль (минимум 6 символов)
				<input
					type="password"
					bind:value={pwNew}
					autocomplete="new-password"
					class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40"
				/>
			</label>
			<label class="mt-2.5 block text-xs font-bold text-ink/55">
				повтори новый
				<input
					type="password"
					bind:value={pwRepeat}
					autocomplete="new-password"
					class="mt-1 w-full rounded-2xl bg-shell px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose/40"
				/>
			</label>
			<button
				type="button"
				onclick={changePassword}
				disabled={busy || !pwOld.trim() || !pwNew.trim()}
				class="mt-3 w-full rounded-2xl bg-linear-to-r from-rose to-peach py-3.5 text-sm font-extrabold text-white shadow-lift transition active:scale-95 disabled:opacity-60"
			>
				{busy ? 'Сохраняю…' : 'Сменить пароль 🔐'}
			</button>
		</section>

		<footer class="mt-8 text-center">
			<p class="font-hand text-lg text-ink/45">всё в наших руках 💛</p>
		</footer>
	</div>
{/if}
