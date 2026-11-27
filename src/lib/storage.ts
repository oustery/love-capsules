import { supabase } from './supabase';

/**
 * Приватный бакет media отдаёт файлы только по короткоживущим подписанным ссылкам.
 * Кэшируем их на 50 минут (сами ссылки живёт час), чтобы не ходить в API лишний раз.
 */
const cache = new Map<string, { url: string; exp: number }>();

export async function getSignedUrl(path: string): Promise<string | null> {
	const hit = cache.get(path);
	if (hit && hit.exp > Date.now()) return hit.url;

	const { data, error } = await supabase.storage.from('media').createSignedUrl(path, 3600);
	if (error || !data) return null;

	cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
	return data.signedUrl;
}

/** Загружает файл в бакет media (перезаписывает существующий объект с тем же путём). */
export async function uploadToMedia(path: string, blob: Blob, contentType?: string): Promise<boolean> {
	const { error } = await supabase.storage
		.from('media')
		.upload(path, blob, { contentType, upsert: true });
	return !error;
}
