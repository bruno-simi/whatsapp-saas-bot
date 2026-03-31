# Templates Multi-tenant (MVP)

## DDL inicial

As tabelas foram adicionadas na migration `prisma/migrations/0002_templates/migration.sql`:

- `TemplateGroup`
- `Template`
- `TemplateVersion`
- `TemplateEvent`

## Endpoints (esqueleto funcional)

Base: `/templates`

- `GET /templates`
  - Lista templates acessiveis para a empresa logada (business -> segment -> global).
- `POST /templates`
  - Cria template da empresa com versao inicial.
  - Body:
    - `groupSlug` (obrigatorio)
    - `name` (obrigatorio)
    - `content` (obrigatorio)
    - `variables` (opcional)
- `POST /templates/:id/clone-to-business`
  - Clona um template global/segmento para a empresa.
  - Body:
    - `name` (opcional)
- `POST /templates/:id/versions`
  - Cria nova versao de um template da empresa.
  - Body:
    - `content` (obrigatorio)
    - `variables` (opcional)
    - `approvalStatus` (opcional; default `draft`)
- `POST /templates/:id/activate`
  - Ativa um template da empresa.
- `POST /templates/messages/send-template`
  - Resolve template por contexto e gera payload padrao WhatsApp.
  - Body:
    - `to` (obrigatorio)
    - `groupSlug` (obrigatorio)
    - `templateName` (opcional)
    - `languageCode` (opcional; default `pt_BR`)
    - `variables` (opcional)

## Payload padrao de envio (WhatsApp)

Exemplo retornado por `POST /templates/messages/send-template`:

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "lembrete_consulta",
    "language": {
      "code": "pt_BR"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Maria" },
          { "type": "text", "text": "31/03/2026 15:00" }
        ]
      }
    ]
  },
  "preview_text": "Ola Maria, sua consulta esta agendada para 31/03/2026 15:00."
}
```

## Ordem de fallback aplicada

Ao resolver template para envio:

1. `scope = business` (template da empresa)
2. `scope = segment` (template da modalidade `Business.type`)
3. `scope = global` (template global)
