import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ChatNorrisApi implements ICredentialType {
	name = 'chatNorrisApi';

	displayName = 'ChatNorris API';

	icon: Icon = { light: 'file:../icons/chatnorris.svg', dark: 'file:../icons/chatnorris.dark.svg' };

	documentationUrl = 'https://github.com/ChatNorris/n8n-nodes-chatnorris#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key created in ChatNorris under Settings → API Keys',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.chatnorris.ai',
			description: 'Only change this if you use a staging or self-hosted ChatNorris instance',
		},
	];

	// The server only accepts the key as a Bearer token (never X-API-Key, never the query string).
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v2/project',
			method: 'GET',
		},
	};
}
