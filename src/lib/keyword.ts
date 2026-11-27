/** Кодовое слово приводится к единому виду: без регистровых и пробельных фокусов */
export function normalizeKeyword(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/\s+/g, ' ');
}

/** Пароль общего аккаунта детерминированно выводится из кодового слова (как в create-auth-user.mjs) */
export async function derivePassword(raw: string): Promise<string> {
	const normalized = normalizeKeyword(raw);
	const data = new TextEncoder().encode(`love-capsule::v1::${normalized}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
