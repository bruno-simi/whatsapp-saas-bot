# Skills Module

## Objetivo

Centralizar funcoes desacopladas e reutilizaveis para entendimento de mensagem, regras de negocio e agendamento.

## Core Skills

- `detectIntent(message, context)`
  - Detecta intencao principal da mensagem.
  - Considera keyword e suporte por texto livre.

- `generateResponse(context)`
  - Gera resposta natural conforme intencao e contexto.
  - Mantem variacao de linguagem para conversa menos robotica.

- `updateConversationState()`
  - Atualiza estado da conversa com seguranca.
  - Preserva continuidade do atendimento.

## Skills de Agendamento

- `getAvailableSlots(date)`
  - Busca horarios disponiveis para a data informada.

- `createAppointment(data)`
  - Cria e confirma agendamento com os dados consolidados.

- `validateDateTime()`
  - Valida data/hora em formatos aceitos pelo bot.

## Skills de Negocio

- `listServices(businessType)`
  - Retorna servicos do nicho (`barbearia`, `oficina`, `consultorio`).

- `getPricing(businessType)`
  - Retorna texto-base de precificacao por nicho.

## Skills de IA

- `interpretFreeText(message)`
  - Interpreta frase livre do usuario.
  - Exemplo: "quero cortar amanha".

- `extractEntities(message)`
  - Extrai entidades principais:
    - data
    - servico
    - intencao
    - nome

- `suggestSmartReply(context)`
  - Sugere resposta contextual quando nao ha caminho direto.
  - Evita travamento por menu e conduz a conversa.

## Principios

- Reuso por dominio
- Baixo acoplamento
- Facil de testar por funcao
- Evolucao incremental sem quebrar fluxo existente
