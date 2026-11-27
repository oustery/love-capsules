/** Тактильный отклик: короткая вибрация, если телефон её поддерживает */
export function buzz(pattern: number | number[] = 30): void {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		// вибрации нет — не страшно
	}
}
