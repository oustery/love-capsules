import { supabase } from './supabase';
import { toast } from './toast.svelte';

/**
 * Общее состояние «Баночки поддержки».
 * Живёт в отдельном модуле, чтобы фразы можно было
 * вытягивать из дневника настроения, а показывать — в баночке.
 */
export const jar = $state({
	phrases: [] as string[],
	nights: [] as string[],
	current: null as string | null,
	pulls: 0,
	loaded: false
});

export async function ensureJarLoaded(): Promise<void> {
	if (jar.loaded) return;
	jar.loaded = true;

	// поддержка и «спокойной ночи» живут в одной таблице notes, разными kind
	const [sRes, nRes] = await Promise.all([
		supabase.from('notes').select('body').eq('kind', 'support'),
		supabase.from('notes').select('body').eq('kind', 'goodnight')
	]);
	if (sRes.error || nRes.error) {
		toast('Баночка не открылась: фразы не загрузились 🥺');
		return;
	}
	if (sRes.data) jar.phrases = sRes.data.map((row) => row.body as string);
	if (nRes.data) jar.nights = nRes.data.map((row) => row.body as string);
}

/** Вытянуть случайную фразу. Возвращает её же (или null, если баночка пуста). */
export function pullPhrase(): string | null {
	if (jar.phrases.length === 0) return null;
	jar.pulls += 1;
	const next = jar.phrases[Math.floor(Math.random() * jar.phrases.length)];
	jar.current = next;
	return next;
}

/** Вытянуть случайное ночное сообщение («спокойной ночи»). */
export function pullNight(): string | null {
	if (jar.nights.length === 0) return null;
	jar.pulls += 1;
	const next = jar.nights[Math.floor(Math.random() * jar.nights.length)];
	jar.current = next;
	return next;
}
