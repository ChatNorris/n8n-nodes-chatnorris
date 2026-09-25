# n8n-nodes-chatnorris

Community nodes for [n8n](https://n8n.io) that connect to [ChatNorris](https://chatnorris.ai): talk to your AI agents, read conversations and leads, manage the knowledge base, and start workflows when a new lead or conversation arrives.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-chatnorris`.
More information: [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. In ChatNorris, go to **Settings → API Keys** and create an API key (API access is available on the Standard and Premium plans).
2. In n8n, create a **ChatNorris API** credential and paste the key. `Base URL` defaults to `https://app.chatnorris.ai` (change it only for a staging environment).

The key is always sent as `Authorization: Bearer <key>`. The credential test calls `GET /api/v2/project`.

### Required scopes

| Operation | Scope |
|---|---|
| Chatbot: Get, Get Many · Knowledge Source: Get Many · agent picker | `chatbots:read` |
| Message: Send | `chat:write` |
| Conversation: Get, Get Many, Get Messages · Trigger: New Conversation | `conversations:read` |
| Lead: Get, Get Many · Trigger: New Lead | `leads:read` |
| Knowledge Source: Add, Delete, Resync | `chatbots:write` |

The agent picker and both triggers use `chatbots:read`, so always include it.

## Nodes

### ChatNorris

| Resource | Operations |
|---|---|
| Chatbot | Get, Get Many |
| Message | Send (`message`, optional `conversation_id`, optional attachment). Returns `reply` and `conversation_id` |
| Conversation | Get, Get Many (filters: agent, status, *Created After*, *Order By*), Get Messages |
| Lead | Get, Get Many (filters: agent, *Created After*). Includes `channel`, `contact_properties` and `custom_fields` |
| Knowledge Source | Get Many, Add (URL, text or FAQ), Delete, Resync |

Notes:

- There is no operation to update leads because the ChatNorris API does not offer one.
- List operations support **Return All** / **Limit** (automatic pagination, 100 items per page).
- The attachment of *Send Message* must be a URL returned by `POST /api/v2/chatbots/:id/attachments`.
- Lead custom fields are returned as an object keyed by the field name; company, job title, city and other contact properties are returned under `contact_properties`.

### ChatNorris Trigger (polling)

Events: **New Lead** and **New Conversation**, with an optional agent filter.

- Uses `created_after` and a cursor kept in the workflow static data. It pages through all results so nothing is lost between polls, and de-duplicates by `id`.
- Emits items from oldest to newest.
- The first time the workflow is activated it only records the starting point (it does not emit the history).
- A manual test run returns the most recent item so you can map fields.
- *New Conversation* also includes conversations created through the API (channel `api`), for example those created by the *Send Message* operation.

## Example workflows

- **New lead → CRM or chat notification:** `ChatNorris Trigger (New Lead)` → `HubSpot` or `Slack`. Use `{{$json.email}}` and `{{$json.contact_properties.company}}`.
- **Answer from another channel:** `Webhook` → `ChatNorris (Message → Send)` → reply with `{{$json.reply}}`. Keep the `conversation_id` to continue the conversation.
- **Keep knowledge up to date:** `Schedule` → `ChatNorris (Knowledge Source → Add, URL)` to index a page every week.

## Development

```bash
npm install
npm run build
npm run lint
npm test
npm run dev   # local n8n with hot reload
```

No runtime dependencies. MIT license.

## Resources

- [ChatNorris](https://chatnorris.ai)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
