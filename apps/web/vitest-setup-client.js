/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />

// Mock environment variables for tests
import { vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_mock_key_for_testing'
	}
}));

// Mock Clerk context for tests
vi.mock('svelte-clerk', () => ({
	ClerkProvider: vi.fn(),
	useClerkContext: () => ({
		user: null,
		auth: {
			userId: null
		}
	}),
	SignIn: vi.fn(),
	SignUp: vi.fn(),
	SignOutButton: vi.fn(),
	UserButton: vi.fn()
}));
