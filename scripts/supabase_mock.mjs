#!/usr/bin/env node
/**
 * Локальный мок Supabase (REST + Auth + Storage) для визуальной проверки приложения.
 * Порт 8788. Данные — демо-набор, эквивалентный seed.sql.
 *
 *   node /home/z/my-project/scripts/supabase_mock.mjs
 */
import http from 'node:http';

const PORT = 8788;

// —— демо-данные (как в seed.sql) ——
const db = {
	settings: [
		{ key: 'target_date', value: '2026-12-19T18:00:00+03:00' },
		{ key: 'target_from', value: '2026-11-01T00:00:00+03:00' },
		{ key: 'start_date', value: '2024-02-14T00:00:00+03:00' }
	],
	mood_logs: [
		{ id: 'm1', mood: 'Немного грустно', note: 'долгий день', created_at: new Date().toISOString() },
		{ id: 'm2', mood: 'Солнечно', note: null, created_at: '2026-11-26T09:10:00.000Z' }
	],
	miss_clicks: [],
	notes: [{ body: 'Ты справишься. А если устанешь — справимся вдвоём.' }],
	capsules: [
		{ id: 'a1', slug: 'sad', title: 'Когда грустно', subtitle: 'письмо + голос', body: 'Эй. Я здесь, даже если кажется, что нет. Грусть — как дождь: мокрая, но всегда заканчивается. Треть твоей грусти я забираю себе.', audio_path: 'audio/sad.wav', sort_order: 1 },
		{ id: 'a2', slug: 'missing', title: 'Когда скучаешь', subtitle: 'прослушай — и станет ближе', body: 'Скучаешь? Я тоже — ровно в этот же момент, я почти уверен.', audio_path: null, sort_order: 2 },
		{ id: 'a3', slug: 'sleep', title: 'Перед сном', subtitle: 'самое спокойное письмо', body: 'Спокойной ночи, моё хорошее. Сегодня ты снова сделала достаточно.', audio_path: null, sort_order: 3 }
	],
	time_capsules: [
		{ id: 't1', title: 'Письмо, которое откроется в Новый год', body: 'Привет из прошлого!', audio_path: null, unlock_at: '2027-01-01T00:00:00+03:00', opened_at: null },
		{ id: 't2', title: 'Письмо после первого месяца разлуки', body: 'Мы справились. Я горжусь нами.', audio_path: null, unlock_at: '2026-01-10T00:00:00+03:00', opened_at: null }
	],
	reasons: [
		{ id: 'r1', position: 1, text: 'Твой смех слышен даже через дверь — и всё сразу становится теплее.', favorite: false },
		{ id: 'r2', position: 2, text: 'Ты искренне радуешься мелочам: дождю, котикам, свежей выпечке.', favorite: true },
		{ id: 'r3', position: 3, text: 'С тобой тишина уютная, а не пустая.', favorite: false },
		{ id: 'r4', position: 4, text: 'Ты засыпаешь, свернувшись калачиком, — и это самое милое зрелище на свете.', favorite: false },
		{ id: 'r5', position: 5, text: 'Ты умеешь слушать по-настоящему, а не «пока-пока».', favorite: false }
	],
	coupons: [
		{ id: 'c1', title: 'Массаж спины', subtitle: '20 минут по первому требованию', icon: '💆‍♀️', status: 'active', used_at: null, created_at: '2026-11-01T10:00:00Z' },
		{ id: 'c2', title: 'Кино на твой выбор', subtitle: 'без споров, досматриваем всё', icon: '🎬', status: 'active', used_at: null, created_at: '2026-11-01T10:00:00Z' },
		{ id: 'c3', title: 'Утро без будильника', subtitle: 'просыпайся, когда само захочется', icon: '⏰', status: 'used', used_at: '2026-11-20T19:00:00Z', created_at: '2026-11-02T10:00:00Z' }
	],
	wishlist: [
		{ id: 'w1', title: 'Съездить на море вместе', category: 'place', done: false, created_at: '2026-11-01T10:00:00Z', done_at: null },
		{ id: 'w2', title: 'Посмотреть всю нашу сагу подряд', category: 'movie', done: true, created_at: '2026-11-01T10:00:00Z', done_at: '2026-11-15T20:00:00Z' },
		{ id: 'w3', title: 'Испечь пиццу дома с нуля', category: 'food', done: false, created_at: '2026-11-02T10:00:00Z', done_at: null }
	],
	photos: [
		{ id: 'p1', storage_path: 'photos/a.webp', caption: 'наш закат', taken_at: '2026-09-01', created_at: '2026-09-01T19:00:00Z' },
		{ id: 'p2', storage_path: 'photos/b.webp', caption: 'прогулка у моря', taken_at: '2026-08-15', created_at: '2026-08-15T12:00:00Z' },
		{ id: 'p3', storage_path: 'photos/c.webp', caption: 'утро с кофе', taken_at: '2026-07-20', created_at: '2026-07-20T08:00:00Z' }
	]
};

// —— маленький WAV (полсекунды тишины) и розовый PNG ——
function wavSilence() {
	const rate = 8000;
	const n = rate / 2;
	const buf = Buffer.alloc(44 + n * 2);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 2, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(rate, 24);
	buf.writeUInt32LE(rate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 2, 40);
	return buf;
}

// 1x1 пиксель, тёплый розовый (#E5989B)
const ROSE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8ePQ/DwAFhgJx3e4n1wAAAABJRU5ErkJggg==',
	'base64'
);

function sessionJson() {
	return {
		access_token: 'mock-token',
		refresh_token: 'mock-refresh',
		token_type: 'bearer',
		expires_in: 3600,
		expires_at: Math.floor(Date.now() / 1000) + 3600,
		user: {
			id: '00000000-0000-0000-0000-000000000000',
			email: 'love@capsule.app',
			aud: 'authenticated',
			app_metadata: { provider: 'email' },
			user_metadata: {},
			created_at: '2024-01-01T00:00:00Z'
		}
	};
}

function cors(res, origin, req) {
	res.setHeader('Access-Control-Allow-Origin', origin || '*');
	// эхо запрошенных заголовков — supabase-js присылает много своих
	res.setHeader(
		'Access-Control-Allow-Headers',
		req?.headers?.['access-control-request-headers'] ?? 'apikey, authorization, content-type, prefer'
	);
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
	res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
}

function send(res, status, body, type = 'application/json') {
	res.writeHead(status, { 'Content-Type': type });
	res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
	const origin = req.headers.origin;
	cors(res, origin, req);
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
	const path = url.pathname;
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | prefer=${req.headers.prefer ?? '-'}`);

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		return res.end();
	}

	// —— Auth ——
	if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
		return send(res, 200, sessionJson());
	}
	if (path === '/auth/v1/logout') {
		return send(res, 204, '');
	}
	if (path === '/auth/v1/user') {
		return send(res, 200, sessionJson().user);
	}

	// —— Storage: подписанные ссылки и файлы ——
	if (path.startsWith('/storage/v1/object/sign/media/')) {
		const file = path.replace('/storage/v1/object/sign/media/', '');
		return send(res, 200, { signedURL: `/storage/v1/object/sign-file/${file}?token=mock` });
	}
	if (path.startsWith('/storage/v1/object/sign-file/')) {
		const file = path.replace('/storage/v1/object/sign-file/', '');
		if (file.startsWith('photos/')) return send(res, 200, ROSE_PNG, 'image/png');
		return send(res, 200, wavSilence(), 'audio/wav');
	}
	if (path === '/storage/v1/object/media/' + 'audio/sad.wav') {
		return send(res, 200, wavSilence(), 'audio/wav');
	}
	if (path.startsWith('/storage/v1/object/public/')) {
		return send(res, 200, ROSE_PNG, 'image/png');
	}

	// —— REST: таблицы ——
	const m = path.match(/^\/rest\/v1\/(\w+)$/);
	if (m) {
		const table = m[1];

		if (req.method === 'GET') {
			if (table in db) {
				const prefer = String(req.headers.prefer || '');
				let rows = db[table];
				// эмуляция order=col.asc/.desc
				const order = url.searchParams.get('order');
				if (order) {
					const [col, dir] = order.replace('.nullslast', '').split('.');
					rows = [...rows].sort((a, b) => {
						const va = a[col], vb = b[col];
						const cmp = va === vb ? 0 : va > vb ? 1 : -1;
						return dir === 'desc' ? -cmp : cmp;
					});
				}
				if (prefer.includes('count=exact')) {
					const total = rows.length;
					res.setHeader('Content-Range', total === 0 ? '*/0' : `0-${total - 1}/${total}`);
					return send(res, 200, []);
				}
				return send(res, 200, rows);
			}
			return send(res, 200, []);
		}

		let bodyStr = '';
		req.on('data', (c) => (bodyStr += c));
		req.on('end', () => {
			let body = {};
			try { body = JSON.parse(bodyStr || '{}'); } catch {}

			if (req.method === 'POST') {
				if (table === 'miss_clicks') {
					db.miss_clicks.push({ id: `x${Date.now()}`, clicked_at: new Date().toISOString() });
					return send(res, 201, {});
				}
				const arr = Array.isArray(body) ? body : [body];
				arr.forEach((row) => {
					if (!row.id) row.id = `${table[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
					if (table === 'mood_logs' && !row.created_at) row.created_at = new Date().toISOString();
					db[table].push(row);
				});
				return send(res, 201, Array.isArray(body) ? arr : body);
			}

			if (req.method === 'PATCH') {
				if (table === 'coupons') {
					const c = db.coupons.find((x) => x.id === body.id ?? x.id === 'c1');
					const target = db.coupons.find((x) => x.status === 'active');
					if (target && body.status === 'used') {
						target.status = 'used';
						target.used_at = new Date().toISOString();
					}
					return send(res, 200, target ?? {});
				}
				if (table === 'reasons') {
					const r = db.reasons[0];
					if (typeof body.favorite === 'boolean') r.favorite = body.favorite;
					return send(res, 200, r);
				}
				if (table === 'capsules') {
					const c = db.capsules[0];
					Object.assign(c, body);
					return send(res, 200, c);
				}
				if (table === 'wishlist') {
					const w = db.wishlist[0];
					Object.assign(w, body);
					return send(res, 200, w);
				}
				if (table === 'time_capsules') {
					const t = db.time_capsules[0];
					Object.assign(t, body);
					return send(res, 200, t);
				}
				return send(res, 200, {});
			}
			return send(res, 200, {});
		});
		return;
	}

	send(res, 404, { message: `mock: нет маршрута ${req.method} ${path}` });
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`Supabase mock on http://127.0.0.1:${PORT}`);
});
