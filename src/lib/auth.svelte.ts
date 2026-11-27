import { PUBLIC_AUTH_EMAIL } from '$env/static/public';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { derivePassword } from './keyword';

/**
 * Состояние входа для всего приложения (Svelte 5 runes).
 * У пары один общий аккаунт Supabase Auth — вход по кодовому слову.
 */
class AuthState {
	ready = $state(false);
	session = $state<Session | null>(null);
	busy = $state(false);

	constructor() {
		supabase.auth
			.getSession()
			.then(({ data }) => {
				this.session = data.session;
			})
			.finally(() => {
				this.ready = true;
			});

		supabase.auth.onAuthStateChange((_event, session) => {
			this.session = session;
		});
	}

	/** Пытается открыть «замок» кодовым словом. true — успех. */
	async unlock(rawWord: string): Promise<boolean> {
		this.busy = true;
		try {
			const password = await derivePassword(rawWord);
			const { data, error } = await supabase.auth.signInWithPassword({
				email: PUBLIC_AUTH_EMAIL,
				password
			});
			if (error) return false;
			this.session = data.session;
			return true;
		} finally {
			this.busy = false;
		}
	}

	/** Закрыть замок (выйти из общего аккаунта). */
	async lock(): Promise<void> {
		await supabase.auth.signOut();
		this.session = null;
	}
}

export const auth = new AuthState();
