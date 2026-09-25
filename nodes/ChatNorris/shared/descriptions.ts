import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, operations: string[]) => ({
	show: { resource: [resource], operation: operations },
});

export const chatbotSelector = (
	resource: string,
	operations: string[],
	extra: Partial<INodeProperties> = {},
): INodeProperties => ({
	displayName: 'Chatbot Name or ID',
	name: 'chatbotId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getChatbots' },
	required: true,
	default: '',
	description:
		'The ChatNorris agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: show(resource, operations),
	...extra,
});

const returnAllAndLimit = (resource: string, operation: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: show(resource, [operation]),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation: [operation], returnAll: [false] } },
	},
];

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Chatbot', value: 'chatbot' },
			{ name: 'Conversation', value: 'conversation' },
			{ name: 'Knowledge Source', value: 'knowledge' },
			{ name: 'Lead', value: 'lead' },
			{ name: 'Message', value: 'message' },
		],
		default: 'message',
	},

	// ---------------------------------------------------------------- Chatbot
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chatbot'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a chatbot (requires scope chatbots:read)',
				action: 'Get a chatbot',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List chatbots (requires scope chatbots:read)',
				action: 'Get many chatbots',
			},
		],
		default: 'getAll',
	},
	chatbotSelector('chatbot', ['get']),
	...returnAllAndLimit('chatbot', 'getAll'),

	// ---------------------------------------------------------------- Message
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Send',
				value: 'send',
				description: 'Send a message to an agent and get its reply (requires scope chat:write)',
				action: 'Send a message',
			},
		],
		default: 'send',
	},
	chatbotSelector('message', ['send']),
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		description: 'Text sent to the agent (1 to 4000 characters)',
		displayOptions: show('message', ['send']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('message', ['send']),
		options: [
			{
				displayName: 'Attachment MIME Type',
				name: 'attachmentType',
				type: 'string',
				default: '',
				placeholder: 'image/png',
				description: 'Optional MIME type of the attachment (image or PDF)',
			},
			{
				displayName: 'Attachment Name',
				name: 'attachmentName',
				type: 'string',
				default: '',
				description: 'Optional file name of the attachment',
			},
			{
				displayName: 'Attachment URL',
				name: 'attachmentUrl',
				type: 'string',
				default: '',
				description:
					'URL returned by ChatNorris POST /api/v2/chatbots/:ID/attachments (image or PDF). Files are uploaded there first, never sent inline.',
			},
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				default: '',
				description:
					'Continue an existing API conversation. Leave empty to start a new one; the reply returns conversation_id for the next turn.',
			},
		],
	},

	// ----------------------------------------------------------- Conversation
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['conversation'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a conversation (requires scope conversations:read)',
				action: 'Get a conversation',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List conversations (requires scope conversations:read)',
				action: 'Get many conversations',
			},
			{
				name: 'Get Messages',
				value: 'getMessages',
				description: 'List the messages of a conversation (requires scope conversations:read)',
				action: 'Get messages of a conversation',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Conversation ID',
		name: 'conversationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('conversation', ['get', 'getMessages']),
	},
	...returnAllAndLimit('conversation', 'getAll'),
	...returnAllAndLimit('conversation', 'getMessages'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('conversation', ['getAll']),
		options: [
			{
				displayName: 'Chatbot Name or ID',
				name: 'chatbotId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChatbots' },
				default: '',
				description:
					'Only conversations of this agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only conversations created strictly after this date (needs the ChatNorris API release that supports created_after)',
			},
			{
				displayName: 'Order By',
				name: 'orderBy',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Updated At', value: 'updated_at' },
				],
				default: 'updated_at',
				description: 'Sort field (always newest first)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Bot', value: 'bot' },
					{ name: 'Closed', value: 'closed' },
					{ name: 'Handoff', value: 'handoff' },
					{ name: 'Open', value: 'open' },
				],
				default: 'open',
			},
		],
	},

	// ------------------------------------------------------------------- Lead
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['lead'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a lead (requires scope leads:read)',
				action: 'Get a lead',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List leads (requires scope leads:read)',
				action: 'Get many leads',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Lead ID',
		name: 'leadId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('lead', ['get']),
	},
	...returnAllAndLimit('lead', 'getAll'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('lead', ['getAll']),
		options: [
			{
				displayName: 'Chatbot Name or ID',
				name: 'chatbotId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChatbots' },
				default: '',
				description:
					'Only leads captured by this agent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only leads created strictly after this date (needs the ChatNorris API release that supports created_after)',
			},
		],
	},

	// -------------------------------------------------------------- Knowledge
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['knowledge'] } },
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a URL, text or FAQ source (requires scope chatbots:write)',
				action: 'Add a knowledge source',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a source and its chunks (requires scope chatbots:write)',
				action: 'Delete a knowledge source',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the sources of an agent (requires scope chatbots:read)',
				action: 'Get many knowledge sources',
			},
			{
				name: 'Resync',
				value: 'resync',
				description: 'Re-ingest a source (requires scope chatbots:write)',
				action: 'Resync a knowledge source',
			},
		],
		default: 'getAll',
	},
	chatbotSelector('knowledge', ['getAll', 'add', 'delete', 'resync']),
	{
		displayName: 'Source ID',
		name: 'sourceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('knowledge', ['delete', 'resync']),
	},
	{
		displayName: 'Source Type',
		name: 'sourceType',
		type: 'options',
		options: [
			{ name: 'FAQ', value: 'faq' },
			{ name: 'Text', value: 'text' },
			{ name: 'URL', value: 'url' },
		],
		default: 'url',
		displayOptions: show('knowledge', ['add']),
	},
	{
		displayName: 'Name',
		name: 'sourceName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('knowledge', ['add']),
	},
	{
		displayName: 'URL',
		name: 'sourceUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/help',
		displayOptions: { show: { resource: ['knowledge'], operation: ['add'], sourceType: ['url'] } },
	},
	{
		displayName: 'Text',
		name: 'sourceText',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['knowledge'], operation: ['add'], sourceType: ['text'] } },
	},
	{
		displayName: 'FAQ Entries',
		name: 'faqEntries',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add FAQ Entry',
		default: {},
		displayOptions: { show: { resource: ['knowledge'], operation: ['add'], sourceType: ['faq'] } },
		options: [
			{
				displayName: 'Entries',
				name: 'entries',
				values: [
					{ displayName: 'Question', name: 'question', type: 'string', default: '' },
					{
						displayName: 'Answer',
						name: 'answer',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
					},
				],
			},
		],
	},
];
