<script>
	import '../../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<style>
		html,
		body {
			background: transparent !important;
			overflow: hidden !important;
			margin: 0 !important;
			padding: 0 !important;
		}
	</style>
</svelte:head>

{@render children?.()}
