export interface CompressedImage {
	blob: Blob;
	width: number;
	height: number;
}

/**
 * Клиентское сжатие фото через <canvas>: ужимаем до ширины 1400px
 * и конвертируем в WebP (качество 0.82) — экономим место в бесплатном бакете.
 */
export async function compressImage(
	file: File,
	maxWidth = 1400,
	quality = 0.82
): Promise<CompressedImage> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxWidth / bitmap.width);
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas недоступен');
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();

	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('не удалось сжать'))),
			'image/webp',
			quality
		)
	);
	return { blob, width: w, height: h };
}

export function kb(bytes: number): string {
	return bytes > 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
		: `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}
