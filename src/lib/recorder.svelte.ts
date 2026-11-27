/**
 * Диктофон на MediaRecorder API: таймер записи, превью перед отправкой.
 * Формат выбирается по поддержке браузера: webm/opus → ogg → mp4.
 */
export const recorder = $state({
	active: false,
	seconds: 0,
	blob: null as Blob | null,
	url: null as string | null,
	ext: 'webm',
	error: ''
});

let media: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function pickMime(): string {
	for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']) {
		if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
	}
	return '';
}

export async function startRecording(): Promise<boolean> {
	recorder.error = '';
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mimeType = pickMime();
		media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		chunks = [];
		media.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};
		media.onstop = () => {
			const type = media?.mimeType || mimeType || 'audio/webm';
			recorder.blob = new Blob(chunks, { type });
			recorder.ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
			recorder.url = URL.createObjectURL(recorder.blob);
			stream.getTracks().forEach((t) => t.stop());
		};
		media.start(250);
		recorder.active = true;
		recorder.seconds = 0;
		recorder.blob = null;
		recorder.url = null;
		timer = setInterval(() => (recorder.seconds += 1), 1000);
		return true;
	} catch {
		recorder.error = 'Нет доступа к микрофону — разреши запись в настройках браузера';
		return false;
	}
}

export function stopRecording(): void {
	media?.stop();
	recorder.active = false;
	if (timer) clearInterval(timer);
	timer = null;
}

export function discardRecording(): void {
	recorder.blob = null;
	recorder.url = null;
	recorder.seconds = 0;
	recorder.error = '';
}

export function mmss(total: number): string {
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
