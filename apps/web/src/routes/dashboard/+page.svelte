<script>
	import { useClerkContext, SignOutButton, UserButton } from 'svelte-clerk';

	const ctx = useClerkContext();
	const user = $derived(ctx.user);
</script>

<div class="min-h-screen bg-gray-50">
	<nav class="border-b border-gray-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center">
					<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
				</div>
				<div class="flex items-center gap-4">
					<UserButton />
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-xl font-semibold text-gray-900">Welcome to your dashboard!</h2>

			{#if user}
				<div class="space-y-2">
					<p class="text-gray-700">
						<span class="font-medium">Logged in as:</span>
						{user.primaryEmailAddress?.emailAddress || user.username || 'User'}
					</p>
					<p class="text-gray-700">
						<span class="font-medium">User ID:</span>
						{user.id}
					</p>
					{#if user.fullName}
						<p class="text-gray-700">
							<span class="font-medium">Full Name:</span>
							{user.fullName}
						</p>
					{/if}
				</div>

				<div class="mt-6">
					<SignOutButton>
						<button
							class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						>
							Sign Out
						</button>
					</SignOutButton>
				</div>
			{:else}
				<p class="text-gray-500">Loading user information...</p>
			{/if}
		</div>
	</main>
</div>
