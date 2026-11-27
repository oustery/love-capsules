<script lang="ts">
	let { open = false, size = 120 }: { open?: boolean; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
	<!-- дужка замка: при открытии поворачивается и приподнимается -->
	<g class="shackle" class:shackle-open={open}>
		<path
			d="M40 56 V42 a20 20 0 0 1 40 0 v8"
			stroke="#c77f83"
			stroke-width="9"
			stroke-linecap="round"
		/>
	</g>

	<!-- корпус замка -->
	<rect x="24" y="52" width="72" height="54" rx="20" fill="#e5989b" />
	<rect x="30" y="58" width="60" height="42" rx="15" fill="#fff" opacity="0.14" />

	<!-- сердечко-ключик -->
	<path
		class="keyhole"
		class:keyhole-beat={open}
		d="M60 92c-9.5-6.8-16-12.6-16-18.6a8.6 8.6 0 0 1 16-4.9 8.6 8.6 0 0 1 16 4.9c0 6-6.5 11.8-16 18.6z"
		fill="#fff7f2"
	/>
</svg>

<style>
	.shackle {
		transform-box: fill-box;
		transform-origin: 8% 92%;
		transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.shackle-open {
		transform: translateY(-7px) rotate(-33deg);
	}

	.keyhole {
		transform-box: fill-box;
		transform-origin: center;
		transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.keyhole-beat {
		transform: scale(1.22);
	}
</style>
