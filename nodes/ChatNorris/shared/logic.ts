/**
 * Pure helpers (no n8n imports) for request building, pagination and the polling cursor.
 * Kept dependency-free so they can be unit tested without an n8n runtime.
 */

export const MAX_PER_PAGE = 100;
export const MAX_SEEN_IDS = 200;
export const MAX_POLL_PAGES = 50;

export interface ApiEnvelope<T = unknown> {
	status?: string;
	data?: T;
	meta?: {
		pages?: { current_page?: number; last_page?: number; per_page?: number; total?: number };
	};
}

export interface ChatNorrisAttachment {
	url: string;
	name?: string;
	type?: string;
}

export interface ListQueryInput {
	page?: number;
	perPage?: number;
	chatbotId?: string;
	status?: string;
	createdAfter?: string;
	orderBy?: string;
}

/** Removes trailing slashes so `${baseUrl}${path}` never produces `//`. */
export function normalizeBaseUrl(baseUrl: string | undefined): string {
	const value = (baseUrl ?? '').trim() || 'https://app.chatnorris.ai';
	return value.replace(/\/+$/, '');
}

export function clampPerPage(value: number | undefined): number {
	if (!value || Number.isNaN(value)) return 25;
	return Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(value)));
}

/** Builds the query string of the v2 list endpoints, omitting empty filters. */
export function buildListQuery(input: ListQueryInput): Record<string, string | number> {
	const qs: Record<string, string | number> = {
		page: Math.max(1, input.page ?? 1),
		per_page: clampPerPage(input.perPage),
	};
	if (input.chatbotId) qs.chatbot_id = input.chatbotId;
	if (input.status) qs.status = input.status;
	if (input.createdAfter) qs.created_after = input.createdAfter;
	if (input.orderBy) qs.order_by = input.orderBy;
	return qs;
}

/** Body of POST /api/v2/chatbots/:id/chat */
export function buildChatBody(
	message: string,
	conversationId?: string,
	attachment?: Partial<ChatNorrisAttachment>,
): Record<string, unknown> {
	const body: Record<string, unknown> = { message };
	if (conversationId) body.conversation_id = conversationId;
	if (attachment?.url) {
		const clean: ChatNorrisAttachment = { url: attachment.url };
		if (attachment.name) clean.name = attachment.name;
		if (attachment.type) clean.type = attachment.type;
		body.attachment = clean;
	}
	return body;
}

export type KnowledgeType = 'url' | 'text' | 'faq';

/** Body of POST /api/v2/chatbots/:id/knowledge (discriminated by `type`). */
export function buildKnowledgeBody(
	type: KnowledgeType,
	name: string,
	content: string,
): Record<string, unknown> {
	return type === 'url'
		? { type, name, source_url: content }
		: { type, name, raw_content: content };
}

/** FAQ sources expect `raw_content` as a JSON array of { question, answer }. */
export function buildFaqContent(pairs: Array<{ question: string; answer: string }>): string {
	return JSON.stringify(pairs.map(({ question, answer }) => ({ question, answer })));
}

/** Reads the array under `data[key]` from the standard envelope. */
export function extractList<T = Record<string, unknown>>(
	response: ApiEnvelope<Record<string, unknown>> | undefined,
	key: string,
): T[] {
	const list = response?.data?.[key];
	return Array.isArray(list) ? (list as T[]) : [];
}

export function hasMorePages(response: ApiEnvelope | undefined, requestedPage: number): boolean {
	const last = response?.meta?.pages?.last_page;
	return typeof last === 'number' && requestedPage < last;
}

// ---------------------------------------------------------------------------
// Polling cursor
// ---------------------------------------------------------------------------

export interface PollItem {
	id: string;
	created_at?: string | null;
	[key: string]: unknown;
}

export interface PollState {
	/** created_at of the newest item already emitted (or observed on first activation). */
	cursor: string;
	/** Ids already emitted, newest last. Needed because the server truncates the cursor to ms. */
	seenIds: string[];
}

function timeOf(item: PollItem): number {
	const t = item.created_at ? Date.parse(item.created_at) : NaN;
	return Number.isNaN(t) ? 0 : t;
}

/** Ascending by created_at (oldest first); stable for equal timestamps. */
export function sortOldestFirst<T extends PollItem>(items: T[]): T[] {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => timeOf(a.item) - timeOf(b.item) || a.index - b.index)
		.map(({ item }) => item);
}

/** Drops already-seen ids and duplicates within the batch, returning oldest → newest. */
export function selectNewItems<T extends PollItem>(items: T[], seenIds: string[]): T[] {
	const seen = new Set(seenIds);
	const unique: T[] = [];
	for (const item of items) {
		if (!item?.id || seen.has(item.id)) continue;
		seen.add(item.id);
		unique.push(item);
	}
	return sortOldestFirst(unique);
}

/** Advances the state after emitting `emitted` (already oldest → newest). */
export function advanceState<T extends PollItem>(state: PollState, emitted: T[]): PollState {
	if (emitted.length === 0) return state;
	let cursor = state.cursor;
	let cursorTime = Date.parse(cursor);
	for (const item of emitted) {
		const t = timeOf(item);
		if (t > 0 && (Number.isNaN(cursorTime) || t > cursorTime)) {
			cursor = item.created_at as string;
			cursorTime = t;
		}
	}
	const seenIds = [...state.seenIds, ...emitted.map((item) => item.id)].slice(-MAX_SEEN_IDS);
	return { cursor, seenIds };
}

/**
 * State for the very first activation: start from the newest existing item so nothing already
 * in the account is emitted; fall back to "now" for empty accounts.
 */
export function initialState(newestItem: PollItem | undefined, now: Date = new Date()): PollState {
	if (newestItem?.created_at) return { cursor: newestItem.created_at, seenIds: [newestItem.id] };
	return { cursor: now.toISOString(), seenIds: [] };
}

export function isPollState(value: unknown): value is PollState {
	const v = value as PollState | undefined;
	return (
		!!v &&
		typeof v.cursor === 'string' &&
		Array.isArray(v.seenIds) &&
		v.seenIds.every((id) => typeof id === 'string')
	);
}
