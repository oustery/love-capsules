export interface Toast {
	id: number;
	text: string;
}

const nextId = { value: 1 };

/** Реактивный список всплывающих подсказок (Svelte 5 runes) */
export const toasts = $state<Toast[]>([]);

export function toast(text: string, ttlMs = 2800): void {
	const id = nextId.value++;
	toasts.push({ id, text });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i !== -1) toasts.splice(i, 1);
	}, ttlMs);
}
