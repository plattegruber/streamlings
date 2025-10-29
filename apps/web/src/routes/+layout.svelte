<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ClerkProvider } from 'svelte-clerk';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY } from '$env/static/public';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY} {data}>
	{@render children?.()}
</ClerkProvider>
