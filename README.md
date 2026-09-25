# n8n-nodes-chatnorris

Nodos de comunidad de [n8n](https://n8n.io) para [ChatNorris](https://chatnorris.ai): conversa con tus agentes de IA, lee conversaciones y leads, administra la base de conocimiento y dispara workflows cuando entra un lead o una conversación nueva.

[English version below](#english)

## Instalación

En n8n: **Settings → Community Nodes → Install** e ingresa `n8n-nodes-chatnorris`.
Más información: [instalar nodos de comunidad](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credenciales

1. En ChatNorris ve a **Settings → API Keys** y crea una API key (requiere plan Standard o Premium).
2. En n8n crea la credencial **ChatNorris API** y pega la key. `Base URL` queda en `https://app.chatnorris.ai` (cámbiala solo para un entorno de staging).

La key se envía siempre como `Authorization: Bearer <key>`. La prueba de la credencial llama a `GET /api/v2/project`.

### Scopes necesarios

| Operación | Scope |
|---|---|
| Chatbot: Get, Get Many · Knowledge Source: Get Many · listas de agentes (selector) | `chatbots:read` |
| Message: Send | `chat:write` |
| Conversation: Get, Get Many, Get Messages · Trigger New Conversation | `conversations:read` |
| Lead: Get, Get Many · Trigger New Lead | `leads:read` |
| Knowledge Source: Add, Delete, Resync | `chatbots:write` |

El selector de agentes y el trigger usan `chatbots:read`, así que inclúyelo siempre.

## Nodos

### ChatNorris

| Recurso | Operaciones |
|---|---|
| Chatbot | Get, Get Many |
| Message | Send (`message`, `conversation_id` opcional, adjunto opcional). Devuelve `reply` y `conversation_id` |
| Conversation | Get, Get Many (filtros: agente, estado, *Created After*, *Order By*), Get Messages |
| Lead | Get, Get Many (filtros: agente, *Created After*). Incluye `channel`, `contact_properties` y `custom_fields` |
| Knowledge Source | Get Many, Add (URL, texto o FAQ), Delete, Resync |

No existe una operación para actualizar leads: la API v2 no la ofrece.
Los listados usan **Return All** / **Limit** (paginación automática, 100 por página).
El adjunto de *Send Message* debe ser una URL devuelta por `POST /api/v2/chatbots/:id/attachments`.

### ChatNorris Trigger (polling)

Eventos **New Lead** y **New Conversation**, con filtro opcional por agente.

- Usa `created_after` y un cursor guardado en los datos estáticos del workflow; recorre todas las páginas para no perder elementos entre consultas y deduplica por `id`.
- Emite del más antiguo al más nuevo.
- Al activar el workflow por primera vez solo registra el punto de partida (no emite el historial).
- En una ejecución manual devuelve el elemento más reciente para que puedas mapear campos.
- *New Conversation* también incluye las conversaciones creadas por la API (canal `api`), por ejemplo las que crea el nodo *Send Message*.

> **Nota:** `created_after` (y el enriquecimiento de leads con `channel`, `contact_properties` y `custom_fields`) requieren la versión de la API de ChatNorris que los incluye. Contra una versión anterior el filtro es ignorado y el trigger no funcionará correctamente. Consulta con ChatNorris si tu cuenta ya la tiene.

## Ejemplos de workflows

- **Nuevo lead → CRM/Slack:** `ChatNorris Trigger (New Lead)` → `HubSpot`/`Slack`. Usa `{{$json.email}}`, `{{$json.contact_properties.company}}`.
- **Responder desde otro canal:** `Webhook` → `ChatNorris (Message → Send)` → responder con `{{$json.reply}}`. Guarda `conversation_id` para continuar la charla.
- **Actualizar el conocimiento:** `Schedule` → `ChatNorris (Knowledge Source → Add, URL)` para indexar una página cada semana.

## Compatibilidad y desarrollo

```bash
npm install
npm run build
npm run lint
npm test
npm run dev   # n8n local con recarga
```

Sin dependencias en runtime. Licencia MIT.

---

## English

Community nodes for [n8n](https://n8n.io) that connect to [ChatNorris](https://chatnorris.ai): talk to your AI agents, read conversations and leads, manage the knowledge base, and start workflows on new leads and conversations.

### Install

n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-chatnorris`.

### Credentials

Create an API key in ChatNorris under **Settings → API Keys** (Standard or Premium plans) and paste it in the **ChatNorris API** credential. The key is sent as `Authorization: Bearer <key>`; the credential test calls `GET /api/v2/project`.

Required scopes: `chatbots:read` (agents, knowledge list, agent picker), `chat:write` (Send Message), `conversations:read`, `leads:read`, `chatbots:write` (add/delete/resync knowledge sources).

### Nodes

- **ChatNorris**: Chatbot (Get, Get Many), Message (Send), Conversation (Get, Get Many, Get Messages), Lead (Get, Get Many), Knowledge Source (Get Many, Add, Delete, Resync). There is no lead update because the API does not offer one.
- **ChatNorris Trigger** (polling): New Lead / New Conversation, optional agent filter. Cursor-based (`created_after`), paginated, deduplicated, oldest first; the first activation only records the starting point; manual runs return the latest item.

> **Note:** `created_after` and the lead enrichment fields require the ChatNorris API release that includes them.

### License

MIT
