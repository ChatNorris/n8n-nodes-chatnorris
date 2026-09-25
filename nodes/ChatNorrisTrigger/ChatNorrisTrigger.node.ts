import {
	NodeConnectionTypes,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';
import {
	advanceState,
	initialState,
	isPollState,
	MAX_POLL_PAGES,
	MAX_PER_PAGE,
	selectNewItems,
	type PollItem,
} from '../ChatNorris/shared/logic';
import { fetchPage, getAllItems } from '../ChatNorris/shared/transport';

const EVENTS = {
	newLead: { path: '/leads', key: 'leads', orderBy: undefined },
	newConversation: { path: '/conversations', key: 'conversations', orderBy: 'created_at' },
} as const;

export class ChatNorrisTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ChatNorris Trigger',
		name: 'chatNorrisTrigger',
		icon: {
			light: 'file:../../icons/chatnorris.svg',
			dark: 'file:../../icons/chatnorris.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts a workflow when ChatNorris gets a new lead or a new conversation',
		defaults: { name: 'ChatNorris Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'chatNorrisApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'New Conversation',
						value: 'newConversation',
						description:
							'Requires scope conversations:read. Includes conversations created through the API.',
					},
					{ name: 'New Lead', value: 'newLead', description: 'Requires scope leads:read' },
				],
				default: 'newLead',
			},
			{
				displayName: 'Chatbot Name or ID',
				name: 'chatbotId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChatbots' },
				default: '',
				description:
					'Only trigger for this agent. Leave empty for all agents of the organization. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getChatbots(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const chatbots = await getAllItems.call(this, '/chatbots', 'chatbots', {}, true);
				return [
					{ name: 'All Chatbots', value: '' },
					...chatbots.map((bot) => ({ name: String(bot.name ?? bot.id), value: String(bot.id) })),
				];
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as keyof typeof EVENTS;
		const chatbotId = (this.getNodeParameter('chatbotId', '') as string) || undefined;
		const { path, key, orderBy } = EVENTS[event];
		const base = { chatbotId, orderBy };

		// Manual "Execute step": return the latest item so the user can map fields. Never touches the cursor.
		if (this.getMode() === 'manual') {
			const { items } = await fetchPage.call(this, path, key, { ...base, page: 1, perPage: 1 });
			return items.length ? [items.map((json) => ({ json }))] : null;
		}

		const staticData = this.getWorkflowStaticData('node');
		const state = isPollState(staticData.state) ? staticData.state : undefined;

		// First activation: remember where we are, emit nothing (no flood of historic items).
		if (!state) {
			const { items } = await fetchPage.call(this, path, key, { ...base, page: 1, perPage: 1 });
			staticData.state = initialState(items[0] as PollItem | undefined);
			return null;
		}

		const createdAfter = new Date(state.cursor).toISOString();
		const collected: PollItem[] = [];
		let page = 1;
		for (; page <= MAX_POLL_PAGES; page++) {
			const { items, hasMore } = await fetchPage.call(this, path, key, {
				...base,
				createdAfter,
				page,
				perPage: MAX_PER_PAGE,
			});
			collected.push(...(items as PollItem[]));
			if (!hasMore || items.length === 0) break;
		}
		if (page > MAX_POLL_PAGES) {
			this.logger.warn('ChatNorris Trigger reached the page limit; older items may be skipped');
		}

		const fresh = selectNewItems(collected, state.seenIds);
		if (fresh.length === 0) return null;

		staticData.state = advanceState(state, fresh) as unknown as IDataObject;
		return [fresh.map((json) => ({ json: json as IDataObject }))];
	}
}
