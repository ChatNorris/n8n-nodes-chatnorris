import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import {
	type ApiEnvelope,
	buildListQuery,
	extractList,
	hasMorePages,
	type ListQueryInput,
	MAX_PER_PAGE,
	normalizeBaseUrl,
} from './logic';

type Context = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

/** Calls the ChatNorris API v2 and returns the full envelope `{ status, data, meta }`. */
export async function chatNorrisRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<ApiEnvelope<Record<string, unknown>>> {
	const credentials = await this.getCredentials('chatNorrisApi');
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'chatNorrisApi', {
			method,
			url: `${normalizeBaseUrl(credentials.baseUrl as string)}/api/v2${path}`,
			qs,
			body,
			json: true,
		})) as ApiEnvelope<Record<string, unknown>>;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/** Fetches one page of a list endpoint. */
export async function fetchPage(
	this: Context,
	path: string,
	resourceKey: string,
	input: ListQueryInput,
) {
	const response = await chatNorrisRequest.call(this, 'GET', path, buildListQuery(input));
	return {
		items: extractList<IDataObject>(response, resourceKey),
		hasMore: hasMorePages(response, input.page ?? 1),
	};
}

/** "Return All" / "Limit" pagination the n8n way. */
export async function getAllItems(
	this: Context,
	path: string,
	resourceKey: string,
	filters: Omit<ListQueryInput, 'page' | 'perPage'>,
	returnAll: boolean,
	limit = 50,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let page = 1;
	for (;;) {
		const perPage = returnAll ? MAX_PER_PAGE : Math.min(MAX_PER_PAGE, limit - results.length);
		const { items, hasMore } = await fetchPage.call(this, path, resourceKey, {
			...filters,
			page,
			perPage,
		});
		results.push(...items);
		if (!hasMore || items.length === 0) break;
		if (!returnAll && results.length >= limit) break;
		page++;
	}
	return returnAll ? results : results.slice(0, limit);
}
