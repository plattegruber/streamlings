<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ClerkProvider } from 'svelte-clerk';
	import { env } from '$env/dynamic/public';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider publishableKey={env.PUBLIC_CLERK_PUBLISHABLE_KEY || ''} {...data}>
	{@render children?.()}
</ClerkProvider>
