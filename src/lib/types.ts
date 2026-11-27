export interface MoodLog {
	id: string;
	mood: string;
	note: string | null;
	created_at: string;
}

export interface SettingsMap {
	[key: string]: string;
}

export interface Note {
	id: string;
	kind: 'note' | 'support';
	body: string;
	created_at: string;
}

export interface Reason {
	id: string;
	position: number;
	text: string;
	favorite: boolean;
}

export interface Capsule {
	id: string;
	slug: string;
	title: string;
	subtitle: string | null;
	body: string | null;
	audio_path: string | null;
	sort_order: number;
}

export interface TimeCapsule {
	id: string;
	title: string;
	body: string | null;
	audio_path: string | null;
	unlock_at: string;
	opened_at: string | null;
}

export interface Coupon {
	id: string;
	title: string;
	subtitle: string | null;
	icon: string;
	status: 'active' | 'used';
	used_at: string | null;
	created_at: string;
}

export interface WishItem {
	id: string;
	title: string;
	category: 'place' | 'movie' | 'food' | 'activity' | 'idea';
	done: boolean;
	created_at: string;
	done_at: string | null;
}

export interface Photo {
	id: string;
	storage_path: string;
	caption: string | null;
	taken_at: string | null;
	created_at: string;
}
