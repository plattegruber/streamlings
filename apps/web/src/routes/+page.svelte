<script>
	import { useClerkContext } from 'svelte-clerk';

	const ctx = useClerkContext();
	const userId = $derived(ctx.auth.userId);
	const user = $derived(ctx.user);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-md text-center">
		<h1 class="mb-4 text-4xl font-bold text-gray-900">Welcome to Streamlings</h1>
		<p class="mb-8 text-gray-600">
			Your interactive streaming companion powered by your audience.
		</p>

		{#if userId === undefined}
			<p class="text-gray-500">Loading...</p>
		{:else if userId === null}
			<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
				<a
					href="/login"
					class="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Sign In
				</a>
				<a
					href="/register"
					class="rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Create Account
				</a>
			</div>
		{:else}
			<div class="space-y-4">
				<p class="text-gray-700">
					Hello, {user?.primaryEmailAddress?.emailAddress || user?.username || 'User'}!
				</p>
				<a
					href="/dashboard"
					class="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Go to Dashboard
				</a>
			</div>
		{/if}
	</div>
</div>
