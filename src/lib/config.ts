export interface MoodOption {
	id: string;
	label: string;
	emoji: string;
	/** true — настроение требует тёплой поддержки */
	gentle: boolean;
	/** Текст поддерживающей карточки для gentle-настроений */
	support: string;
}

export const MOODS: MoodOption[] = [
	{ id: 'sunny', label: 'Солнечно', emoji: '🌤️', gentle: false, support: '' },
	{
		id: 'sad',
		label: 'Немного грустно',
		emoji: '🌧️',
		gentle: true,
		support: 'Иди сюда — обнимашки без лимита. Грусть можно отдать мне: я подержу, а ты пока просто дыши.'
	},
	{
		id: 'tired',
		label: 'Устала',
		emoji: '🔋',
		gentle: true,
		support: 'Ты столько всего держишь на себе. Сейчас — отдых: пледик, чай и ноль обязанностей. Я рядом.'
	},
	{ id: 'waiting', label: 'Очень жду тебя', emoji: '💫', gentle: false, support: '' }
];

/** Слаги тематических капсул «Открой, когда...» (совпадают с seed.sql) */
export const CAPSULE_SLUGS = ['sad', 'missing', 'sleep', 'motivation', 'smile'] as const;

/** Иконка и подпись слага капсулы */
export const CAPSULE_META: Record<string, { emoji: string; hint: string }> = {
	sad: { emoji: '🌧️', hint: 'когда грустно' },
	missing: { emoji: '💫', hint: 'когда скучаешь' },
	sleep: { emoji: '🌙', hint: 'перед сном' },
	motivation: { emoji: '🚀', hint: 'когда нужна мотивация' },
	smile: { emoji: '☀️', hint: 'просто улыбнуться' }
};

/** Эмодзи категорий вишлиста */
export const WISH_CATEGORIES: { id: 'place' | 'movie' | 'food' | 'activity' | 'idea'; label: string; emoji: string }[] = [
	{ id: 'place', label: 'место', emoji: '📍' },
	{ id: 'movie', label: 'фильм', emoji: '🎬' },
	{ id: 'food', label: 'еда', emoji: '🍰' },
	{ id: 'activity', label: 'дело', emoji: '🎨' },
	{ id: 'idea', label: 'идея', emoji: '💡' }
];
