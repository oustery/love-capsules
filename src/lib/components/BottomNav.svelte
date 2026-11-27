<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	interface NavItem {
		route: string;
		label: string;
		icon: string;
	}

	const items: NavItem[] = [
		{ route: '/', label: 'Главная', icon: '🏠' },
		{ route: '/capsules', label: 'Капсулы', icon: '💌' },
		{ route: '/reasons', label: 'Причины', icon: '🃏' },
		{ route: '/coupons', label: 'Купоны', icon: '🎟️' },
		{ route: '/moments', label: 'Моменты', icon: '📷' }
	];

	function isActive(item: NavItem): boolean {
		return path() === item.route;
	}

	/** путь без base-префикса и хвостового слэша — чтобы сравнения работали и на Cloudflare, и на GitHub Pages */
	function path(): string {
		return page.url.pathname.slice(base.length).replace(/\/+$/, '') || '/';
	}

	const onLogin = $derived(path() === '/login');
</script>

{#if !onLogin}
	<nav
		class="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3"
		style="padding-bottom: max(env(safe-area-inset-bottom), 12px)"
	>
		<div
			class="glass flex w-full max-w-md items-center justify-between gap-1 rounded-3xl p-2 shadow-soft"
		>
			{#each items as item (item.route)}
				<button
					type="button"
					aria-label={item.label}
					aria-current={isActive(item) ? 'page' : undefined}
					onclick={() => goto(`${base}${item.route}`)}
					class="flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition active:scale-95 {isActive(
						item
					)
						? 'bg-rose/15 text-rose-deep'
						: 'text-ink/45'}"
				>
					<span class="text-xl leading-none">{item.icon}</span>
					<span class="text-[10px] font-bold tracking-wide">{item.label}</span>
				</button>
			{/each}
		</div>
	</nav>
{/if}
