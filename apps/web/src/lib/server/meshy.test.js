import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, createPreviewTask, createRefineTask, getTask, downloadGlb } from './meshy.js';

describe('buildPrompt', () => {
	it('wraps user input in style template', () => {
		const result = buildPrompt('dinosaur');
		expect(result).toContain('dinosaur');
		expect(result).toContain('kawaii');
		expect(result).toContain('T-pose');
	});

	it('trims whitespace from user input', () => {
		const result = buildPrompt('  cat  ');
		expect(result).toContain('cat,');
		expect(result).not.toContain('  cat  ');
	});
});

describe('createPreviewTask', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('sends correct request and returns taskId', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ result: 'task-123' })
		});
		vi.stubGlobal('fetch', mockFetch);

		const result = await createPreviewTask('test-key', 'a cute dinosaur');
		expect(result).toEqual({ taskId: 'task-123' });

		const [url, opts] = mockFetch.mock.calls[0];
		expect(url).toContain('text-to-3d');
		expect(opts.method).toBe('POST');
		expect(opts.headers.Authorization).toBe('Bearer test-key');

		const body = JSON.parse(opts.body);
		expect(body.mode).toBe('preview');
		expect(body.prompt).toBe('a cute dinosaur');
		expect(body.enable_pbr).toBe(false);
	});

	it('throws on non-OK response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 429,
				text: () => Promise.resolve('rate limited')
			})
		);

		await expect(createPreviewTask('key', 'prompt')).rejects.toThrow('Meshy preview failed (429)');
	});
});

describe('createRefineTask', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('sends preview task ID in request body', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ result: 'refine-456' })
		});
		vi.stubGlobal('fetch', mockFetch);

		const result = await createRefineTask('test-key', 'preview-123');
		expect(result).toEqual({ taskId: 'refine-456' });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.mode).toBe('refine');
		expect(body.preview_task_id).toBe('preview-123');
	});
});

describe('getTask', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches task status', async () => {
		const taskData = { id: 'task-123', status: 'SUCCEEDED', progress: 100 };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(taskData)
			})
		);

		const result = await getTask('test-key', 'task-123');
		expect(result.status).toBe('SUCCEEDED');
		expect(result.progress).toBe(100);
	});

	it('throws on failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				text: () => Promise.resolve('not found')
			})
		);

		await expect(getTask('key', 'bad-id')).rejects.toThrow('Meshy getTask failed (404)');
	});
});

describe('downloadGlb', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns ArrayBuffer on success', async () => {
		const buffer = new ArrayBuffer(8);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () => Promise.resolve(buffer)
			})
		);

		const result = await downloadGlb('https://example.com/model.glb');
		expect(result).toBe(buffer);
	});

	it('throws on download failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403
			})
		);

		await expect(downloadGlb('https://example.com/model.glb')).rejects.toThrow(
			'GLB download failed (403)'
		);
	});
});
