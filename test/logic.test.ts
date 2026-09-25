import { describe, expect, it } from 'vitest';
import {
	advanceState,
	buildChatBody,
	buildFaqContent,
	buildKnowledgeBody,
	buildListQuery,
	clampPerPage,
	extractList,
	hasMorePages,
	initialState,
	isPollState,
	MAX_SEEN_IDS,
	normalizeBaseUrl,
	selectNewItems,
	sortOldestFirst,
} from '../nodes/ChatNorris/shared/logic';

describe('request building', () => {
	it('normalizes the base URL', () => {
		expect(normalizeBaseUrl('https://app.chatnorris.ai///')).toBe('https://app.chatnorris.ai');
		expect(normalizeBaseUrl('')).toBe('https://app.chatnorris.ai');
		expect(normalizeBaseUrl(undefined)).toBe('https://app.chatnorris.ai');
	});

	it('clamps per_page to 1..100', () => {
		expect(clampPerPage(500)).toBe(100);
		expect(clampPerPage(0)).toBe(25);
		expect(clampPerPage(-3)).toBe(1);
		expect(clampPerPage(7.9)).toBe(7);
	});

	it('builds list queries omitting empty filters', () => {
		expect(buildListQuery({ page: 2, perPage: 100 })).toEqual({ page: 2, per_page: 100 });
		expect(
			buildListQuery({
				chatbotId: 'c1',
				status: 'open',
				createdAfter: '2026-01-01T00:00:00.000Z',
				orderBy: 'created_at',
			}),
		).toEqual({
			page: 1,
			per_page: 25,
			chatbot_id: 'c1',
			status: 'open',
			created_after: '2026-01-01T00:00:00.000Z',
			order_by: 'created_at',
		});
	});

	it('builds chat bodies', () => {
		expect(buildChatBody('hi')).toEqual({ message: 'hi' });
		expect(buildChatBody('hi', 'conv', { url: 'https://x/y.png', name: 'y.png' })).toEqual({
			message: 'hi',
			conversation_id: 'conv',
			attachment: { url: 'https://x/y.png', name: 'y.png' },
		});
		expect(buildChatBody('hi', undefined, { name: 'orphan' })).toEqual({ message: 'hi' });
	});

	it('builds knowledge bodies per type', () => {
		expect(buildKnowledgeBody('url', 'Docs', 'https://a.b')).toEqual({
			type: 'url',
			name: 'Docs',
			source_url: 'https://a.b',
		});
		expect(buildKnowledgeBody('text', 'T', 'body')).toEqual({
			type: 'text',
			name: 'T',
			raw_content: 'body',
		});
		expect(JSON.parse(buildFaqContent([{ question: 'q', answer: 'a' }]))).toEqual([
			{ question: 'q', answer: 'a' },
		]);
	});

	it('extracts lists and detects more pages', () => {
		const res = {
			data: { leads: [{ id: '1' }] },
			meta: { pages: { current_page: 1, last_page: 3 } },
		};
		expect(extractList(res, 'leads')).toEqual([{ id: '1' }]);
		expect(extractList(res, 'nope')).toEqual([]);
		expect(extractList(undefined, 'leads')).toEqual([]);
		expect(hasMorePages(res, 1)).toBe(true);
		expect(hasMorePages(res, 3)).toBe(false);
		expect(hasMorePages({}, 1)).toBe(false);
	});
});

describe('polling cursor and dedupe', () => {
	const item = (id: string, created_at: string) => ({ id, created_at });

	it('sorts oldest first, stable on ties', () => {
		const sorted = sortOldestFirst([
			item('c', '2026-01-03T00:00:00Z'),
			item('a', '2026-01-01T00:00:00Z'),
			item('b1', '2026-01-02T00:00:00Z'),
			item('b2', '2026-01-02T00:00:00Z'),
		]);
		expect(sorted.map((i) => i.id)).toEqual(['a', 'b1', 'b2', 'c']);
	});

	it('drops seen ids and in-batch duplicates, emits oldest to newest', () => {
		const fresh = selectNewItems(
			[
				item('3', '2026-01-03T00:00:00Z'),
				item('2', '2026-01-02T00:00:00Z'),
				item('2', '2026-01-02T00:00:00Z'),
				item('1', '2026-01-01T00:00:00Z'),
			],
			['1'],
		);
		expect(fresh.map((i) => i.id)).toEqual(['2', '3']);
	});

	it('first activation starts from the newest existing item (no flood)', () => {
		const state = initialState(item('9', '2026-02-01T10:00:00.123456+00:00'));
		expect(state).toEqual({ cursor: '2026-02-01T10:00:00.123456+00:00', seenIds: ['9'] });
		// The boundary item comes back (server truncates the cursor to ms) but is deduped.
		expect(selectNewItems([item('9', '2026-02-01T10:00:00.123456+00:00')], state.seenIds)).toEqual(
			[],
		);
	});

	it('first activation on an empty account falls back to now', () => {
		const now = new Date('2026-03-01T00:00:00Z');
		expect(initialState(undefined, now)).toEqual({ cursor: now.toISOString(), seenIds: [] });
	});

	it('advances the cursor to the newest emitted item and accumulates ids', () => {
		const start = { cursor: '2026-01-01T00:00:00Z', seenIds: ['old'] };
		const next = advanceState(start, [
			item('a', '2026-01-02T00:00:00Z'),
			item('b', '2026-01-03T00:00:00Z'),
		]);
		expect(next.cursor).toBe('2026-01-03T00:00:00Z');
		expect(next.seenIds).toEqual(['old', 'a', 'b']);
	});

	it('never moves the cursor backwards and is a no-op without new items', () => {
		const start = { cursor: '2026-05-01T00:00:00Z', seenIds: [] };
		expect(advanceState(start, [])).toBe(start);
		expect(advanceState(start, [item('x', '2026-01-01T00:00:00Z')]).cursor).toBe(
			'2026-05-01T00:00:00Z',
		);
	});

	it('caps the remembered ids', () => {
		const many = Array.from({ length: MAX_SEEN_IDS + 50 }, (_, n) =>
			item(`id${n}`, `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`),
		);
		const next = advanceState({ cursor: '2025-12-31T00:00:00Z', seenIds: [] }, many);
		expect(next.seenIds).toHaveLength(MAX_SEEN_IDS);
		expect(next.seenIds.at(-1)).toBe(`id${MAX_SEEN_IDS + 49}`);
	});

	it('simulates two consecutive polls without loss or duplicates', () => {
		let state = initialState(item('l1', '2026-01-01T00:00:00Z'));
		const poll = (all: Array<{ id: string; created_at: string }>) => {
			const after = Date.parse(state.cursor);
			// server is `created_at > cursor` (ms precision), we deliberately include the boundary row
			const batch = all.filter((i) => Date.parse(i.created_at) >= after);
			const fresh = selectNewItems(batch, state.seenIds);
			state = advanceState(state, fresh);
			return fresh.map((i) => i.id);
		};
		const l2 = item('l2', '2026-01-02T00:00:00Z');
		const l3 = item('l3', '2026-01-03T00:00:00Z');
		expect(poll([l3, l2, item('l1', '2026-01-01T00:00:00Z')])).toEqual(['l2', 'l3']);
		expect(poll([l3, l2, item('l1', '2026-01-01T00:00:00Z')])).toEqual([]);
		const l4 = item('l4', '2026-01-04T00:00:00Z');
		expect(poll([l4, l3, l2])).toEqual(['l4']);
	});

	it('validates persisted state', () => {
		expect(isPollState({ cursor: 'x', seenIds: ['a'] })).toBe(true);
		expect(isPollState({ cursor: 1, seenIds: [] })).toBe(false);
		expect(isPollState({ cursor: 'x', seenIds: [1] })).toBe(false);
		expect(isPollState(undefined)).toBe(false);
	});
});
