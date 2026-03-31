# AI Architecture - WhatsApp Atendimento Inteligente

## Objetivo

Transformar o bot em um assistente conversacional natural, com foco em agendamento e atendimento para:

- Barbearias
- Oficinas mecanicas
- Consultorios

Este modulo prioriza intencao e contexto no lugar de fluxo rigido por menu.

## Estrutura

```text
src/
  ai/
    rules/
    skills/
    decisionEngine/
    context/
  flows/
  services/
```

## Como o fluxo funciona

1. A mensagem entra no `chatFlow`.
2. O `decisionEngine` monta contexto da conversa.
3. As `rules` definem prioridade de acao (comandos, estado, intencao, coleta, fallback).
4. As `skills` executam tarefas reutilizaveis (NLP, negocio, agendamento, resposta).
5. O fluxo retorna resposta natural e atualiza estado.

## Documentacao por modulo

- `src/ai/rules/RULES.md`
- `src/ai/skills/SKILLS.md`
- `src/ai/decisionEngine/DECISION_ENGINE.md`
- `src/ai/context/CONTEXT.md`

## Boas praticas adotadas

- Codigo desacoplado por responsabilidade
- Reuso de funcoes por dominio
- Facilidade de testes por modulo
- Logs claros no motor de decisao
- Evolucao incremental sem acoplamento em menu
