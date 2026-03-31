# Conversation Context

## Objetivo

Padronizar os dados que representam o estado da conversa em tempo de decisao.

## Estrutura base

- `currentState`
  - Estado atual da conversa (ex.: aguardando servico, data, confirmacao).

- `detectedIntent`
  - Intencao detectada para a mensagem corrente.

- `entities`
  - Entidades extraidas da mensagem:
    - `date`
    - `service`
    - `name`
    - `choice` (opcional para selecao de slot)

- `historySummary`
  - Historico resumido para manter continuidade sem carregar toda a conversa.

## Campos de apoio

- `normalizedMessage`
- `businessType`
- `aiInterpretation`
- `effectiveIntent`

## Regras de uso

- Contexto deve ser reconstruido a cada mensagem
- Estado persistido deve ser sincronizado com `stateService`
- Dados extraidos devem ser reutilizados antes de pedir novamente
- Historico deve ser curto e objetivo para manter performance
