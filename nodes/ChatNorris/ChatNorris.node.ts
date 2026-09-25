import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type JsonObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { properties } from './shared/descriptions';
import {
	buildChatBody,
	buildFaqContent,
	buildKnowledgeBody,
	extractList,
	type KnowledgeType,
} from './shared/logic';
import { chatNorrisRequest, getAllItems } from './shared/transport';

export class ChatNorris implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ChatNorris',
		name: 'chatNorris',
		icon: {
			light: 'file:../../icons/chatnorris.svg',
			dark: 'file:../../icons/chatnorris.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Talk to your ChatNorris AI agents and read conversations, leads and knowledge',
		defaults: { name: 'ChatNorris' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'chatNorrisApi', required: true }],
		properties,
	};

	methods = {
		loadOptions: {
			async getChatbots(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const chatbots = await getAllItems.call(this, '/chatbots', 'chatbots', {}, true);
				return chatbots.map((bot) => ({
					name: String(bot.name ?? bot.id),
					value: String(bot.id),
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const results = await run.call(this, resource, operation, i);
				for (const json of results) {
					out.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [out];
	}
}

async function run(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject[]> {
	const list = async (path: string, key: string, filters: IDataObject = {}) => {
		const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', i, 50) as number);
		return getAllItems.call(this, path, key, toFilters(filters), returnAll, limit);
	};
	const dataOf = async (
		method: 'GET' | 'POST' | 'DELETE',
		path: string,
		body?: IDataObject,
	): Promise<IDataObject> => {
		const response = await chatNorrisRequest.call(this, method, path, {}, body);
		return (response.data ?? {}) as IDataObject;
	};

	switch (`${resource}:${operation}`) {
		case 'chatbot:getAll':
			return list('/chatbots', 'chatbots');
		case 'chatbot:get':
			return [await dataOf('GET', `/chatbots/${id(this, 'chatbotId', i)}`)];

		case 'message:send': {
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const body = buildChatBody(
				this.getNodeParameter('message', i) as string,
				(options.conversationId as string) || undefined,
				{
					url: options.attachmentUrl as string,
					name: options.attachmentName as string,
					type: options.attachmentType as string,
				},
			);
			return [
				await dataOf('POST', `/chatbots/${id(this, 'chatbotId', i)}/chat`, body as IDataObject),
			];
		}

		case 'conversation:getAll':
			return list(
				'/conversations',
				'conversations',
				this.getNodeParameter('filters', i, {}) as IDataObject,
			);
		case 'conversation:get':
			return [await dataOf('GET', `/conversations/${id(this, 'conversationId', i)}`)];
		case 'conversation:getMessages':
			return list(`/conversations/${id(this, 'conversationId', i)}/messages`, 'messages');

		case 'lead:getAll':
			return list('/leads', 'leads', this.getNodeParameter('filters', i, {}) as IDataObject);
		case 'lead:get':
			return [await dataOf('GET', `/leads/${id(this, 'leadId', i)}`)];

		case 'knowledge:getAll': {
			const response = await chatNorrisRequest.call(
				this,
				'GET',
				`/chatbots/${id(this, 'chatbotId', i)}/knowledge`,
			);
			return extractList<IDataObject>(response, 'sources');
		}
		case 'knowledge:add': {
			const type = this.getNodeParameter('sourceType', i) as KnowledgeType;
			const name = this.getNodeParameter('sourceName', i) as string;
			let content: string;
			if (type === 'url') content = this.getNodeParameter('sourceUrl', i) as string;
			else if (type === 'text') content = this.getNodeParameter('sourceText', i) as string;
			else {
				const faq = this.getNodeParameter('faqEntries', i, {}) as {
					entries?: Array<{ question: string; answer: string }>;
				};
				if (!faq.entries?.length) {
					throw new NodeOperationError(this.getNode(), 'Add at least one FAQ entry', {
						itemIndex: i,
					});
				}
				content = buildFaqContent(faq.entries);
			}
			return [
				await dataOf(
					'POST',
					`/chatbots/${id(this, 'chatbotId', i)}/knowledge`,
					buildKnowledgeBody(type, name, content) as IDataObject,
				),
			];
		}
		case 'knowledge:delete':
			return [
				await dataOf(
					'DELETE',
					`/chatbots/${id(this, 'chatbotId', i)}/knowledge/${id(this, 'sourceId', i)}`,
				),
			];
		case 'knowledge:resync':
			return [
				await dataOf(
					'POST',
					`/chatbots/${id(this, 'chatbotId', i)}/knowledge/${id(this, 'sourceId', i)}`,
				),
			];
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}/${operation}`, {
		itemIndex: i,
	});
}

/** Reads a required id parameter and URL-encodes it for use in a path. */
function id(ctx: IExecuteFunctions, name: string, i: number): string {
	const value = String(ctx.getNodeParameter(name, i, '')).trim();
	if (!value) {
		throw new NodeOperationError(ctx.getNode(), `Parameter "${name}" is required`, {
			itemIndex: i,
		});
	}
	return encodeURIComponent(value);
}

function toFilters(filters: IDataObject) {
	return {
		chatbotId: (filters.chatbotId as string) || undefined,
		status: (filters.status as string) || undefined,
		orderBy: (filters.orderBy as string) || undefined,
		createdAfter: filters.createdAfter
			? new Date(filters.createdAfter as string).toISOString()
			: undefined,
	};
}
