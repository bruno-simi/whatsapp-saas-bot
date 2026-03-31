# WhatsApp SaaS Bot (Node.js + Baileys)

Mini SaaS de automacao de atendimento para:
- Barbearias
- Oficinas mecanicas
- Consultorios

Com foco em qualificacao de cliente e agendamento com Google Calendar.

## Funcionalidades

- Conexao WhatsApp via QR Code com reconexao automatica
- Fluxo inteligente por estado e intencao por palavras-chave
- Agendamento com confirmacao
- Integracao Google Calendar (real) com fallback mock
- Persistencia SQLite (`users`, `appointments`, `messages`)
- Comandos globais `menu` e `cancelar`
- Timeout de sessao por usuario
- Personalizacao por nicho via `BUSINESS_TYPE`

## Estrutura

`src/controllers`, `src/services`, `src/flows`, `src/integrations`, `src/database`, `src/utils`

## Configuracao

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Ou use um template por nicho:

```bash
cp .env.barbearia.example .env
# ou
cp .env.oficina.example .env
# ou
cp .env.consultorio.example .env
```

2. Ajuste variaveis:
- `PORT`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_CREDENTIALS` (JSON string do service account)
- `BUSINESS_TYPE` (`barbearia|oficina|consultorio`)

Para forcar mock:
- `USE_CALENDAR_MOCK=true`

## Execucao local

```bash
npm install
npm run dev
```

Ao iniciar, escaneie o QR no terminal.

## Execucao com Docker

```bash
docker compose up --build
```

## Exemplo de fluxo no console

### Barbearia
1. Cliente: `Quero cortar cabelo amanha`
2. Bot detecta intencao de agendamento e pede servico
3. Cliente: `corte`
4. Bot pede data
5. Cliente: `amanha`
6. Bot lista horarios livres
7. Cliente escolhe `1`
8. Bot confirma agendamento

### Oficina
1. Cliente: `Preciso agendar revisao`
2. Bot inicia fluxo de agendamento
3. Cliente: `revisao`
4. Bot pede data
5. Cliente: `10/04`
6. Bot retorna slots e confirma apos escolha

### Consultorio
1. Cliente: `Gostaria de marcar consulta`
2. Bot identifica intencao e coleta servico
3. Cliente: `consulta estetica`
4. Bot coleta data e oferece horarios
5. Cliente confirma opcao e recebe protocolo

## Observacoes Google Calendar

- Modo real e o padrao quando `GOOGLE_CALENDAR_ID` e `GOOGLE_CREDENTIALS` estao validos.
- Em erro de API, o sistema cai automaticamente para mock para nao bloquear atendimento.
