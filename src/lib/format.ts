/** Русские формы слова: plural(3, ['день', 'дня', 'дней']) → «дня» */
export function plural(n: number, forms: [string, string, string]): string {
	const n10 = n % 10;
	const n100 = n % 100;
	if (n10 === 1 && n100 !== 11) return forms[0];
	if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
	return forms[2];
}

export function pad(n: number): string {
	return String(n).padStart(2, '0');
}

const prettyFmt = new Intl.DateTimeFormat('ru-RU', {
	weekday: 'long',
	day: 'numeric',
	month: 'long'
});

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Календарные даты проекта (даты в settings хранятся в +03:00) не должны «уезжать» на день
 *  на устройствах в другой тайзоне — поэтому форматируем в фиксированной тайзоне. */
const dayFmtFixed = new Intl.DateTimeFormat('ru-RU', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'Europe/Moscow'
});

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function prettyDate(d: Date): string {
	return prettyFmt.format(d);
}

export function fullDate(d: Date): string {
	return dayFmt.format(d);
}

export function fullDateFixed(d: Date): string {
	return dayFmtFixed.format(d);
}

export function shortTime(d: Date): string {
	return timeFmt.format(d);
}

/** ISO-строка локальной полуночи — граница «сегодня» для Supabase-запросов */
export function startOfTodayISO(): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

/** Безопасный разбор даты из settings */
export function parseDate(value: string | undefined): Date | null {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}
