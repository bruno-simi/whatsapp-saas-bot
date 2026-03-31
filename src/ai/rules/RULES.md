# Rules Module

## Objetivo

Organizar regras reutilizaveis para controlar o comportamento conversacional com flexibilidade.

## Grupos de regras

### 1) conversationalRules

Responsavel por comandos globais e controle imediato da conversa.

- `global_cancel`: cancela o fluxo ativo e volta para estado neutro.
- `global_menu`: retorna ao menu/fallback principal.

### 2) intentDetectionRules

Responsavel por identificar intencao com prioridade em linguagem natural.

- `detect_from_keywords`: usa palavras-chave do dominio.
- `detect_from_free_text`: usa interpretacao livre quando keyword nao resolve.

### 3) businessContextRules

Responsavel por adaptar tom e repertorio por nicho.

- `barbearia_profile`
- `oficina_profile`
- `consultorio_profile`

### 4) flowControlRules

Responsavel por respeitar o estado da conversa no momento.

- `awaiting_service`
- `awaiting_date`
- `awaiting_confirmation`

### 5) dataCollectionRules

Responsavel por identificar o dado minimo necessario para seguir no agendamento.

- `collect_service`
- `collect_date`

### 6) schedulingRules

Responsavel por etapas de agenda.

- `fetch_slots`
- `confirm_appointment`

### 7) fallbackRules

Responsavel por resposta segura quando nenhuma regra principal se aplica.

- `fallback_menu`

## Criterios de qualidade das rules

- Descricao clara e curta
- Condicao objetiva (`when(context)`)
- Reuso em fluxos distintos
- Sem dependencia direta de canal (WhatsApp, API, etc.)
