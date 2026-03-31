# Decision Engine

## Objetivo

Decidir a proxima acao do bot usando `rules + skills + contexto`.

## Diretrizes

- Priorizar intencao sobre menu
- Evitar fluxo engessado
- Respeitar estado atual da conversa
- Conduzir usuario com respostas naturais

## Pipeline de decisao

1. Montar contexto da mensagem
2. Avaliar regras conversacionais (cancelar/menu)
3. Avaliar regras de controle por estado
4. Avaliar intencao (keyword + texto livre)
5. Coletar dados faltantes de agendamento
6. Executar acoes de agenda (slots/confirmacao)
7. Aplicar fallback inteligente quando necessario

## Entradas do motor

- `phone`
- `message`
- `user` (estado atual, dados persistidos)

## Saida do motor

- `reply` (mensagem para o usuario)
- `statePatch` (alteracoes de estado, quando aplicavel)

## Beneficios

- Conversa mais natural
- Menor dependencia de menu numerico
- Melhor taxa de conclusao de agendamento
- Facil extensao para novos nichos e intents
