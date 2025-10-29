<script>
	import { SignIn } from 'svelte-clerk';
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-gray-900">Sign in to your account</h1>
		<SignIn
			redirectUrl="/dashboard"
			signUpUrl="/register"
			appearance={{
				elements: {
					rootBox: 'w-full',
					card: 'shadow-xl'
				}
			}}
		/>
	</div>
</div>
