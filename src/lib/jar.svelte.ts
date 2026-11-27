import { supabase } from './supabase';
import { toast } from './toast.svelte';

/**
 * Общее состояние «Баночки поддержки».
 * Живёт в отдельном модуле, чтобы фразы можно было
 * вытягивать из дневника настроения, а показывать — в баночке.
 */
export const jar = $state({
	phrases: [] as string[],
	current: null as string | null,
	pulls: 0,
	loaded: false
});

export async function ensureJarLoaded(): Promise<void> {
	if (jar.loaded) return;
	jar.loaded = true;

	const { data, error } = await supabase.from('notes').select('body').eq('kind', 'support');
	if (error) {
		toast('Баночка не открылась: фразы не загрузились 🥺');
		return;
	}
	if (data && data.length > 0) {
		jar.phrases = data.map((row) => row.body as string);
	}
}

/** Вытянуть случайную фразу. Возвращает её же (или null, если баночка пуста). */
export function pullPhrase(): string | null {
	if (jar.phrases.length === 0) return null;
	jar.pulls += 1;
	const next = jar.phrases[Math.floor(Math.random() * jar.phrases.length)];
	jar.current = next;
	return next;
}
