<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ClerkProvider } from 'svelte-clerk';

	let { children, data } = $props();
	const publishableKey = data.publishableKey ?? '';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider {...data} publishableKey={publishableKey}>
	{@render children?.()}
</ClerkProvider>
