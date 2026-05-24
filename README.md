# Bolão Copa do Mundo 2026

Aplicação web completa para gerenciar um bolão da Copa do Mundo de 2026, construída com React, TypeScript, Vite, Tailwind CSS, shadcn/ui e Supabase.

## 🚀 Tecnologias

- **Frontend**: React 18, TypeScript, Vite
- **Estilização**: Tailwind CSS, shadcn/ui
- **Backend/Database**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Ícones**: lucide-react
- **Roteamento**: React Router

## 📋 Funcionalidades

- ✅ Autenticação de usuários (login/cadastro)
- ✅ Dashboard com próximas partidas e últimos resultados
- ✅ Visualização de classificação dos 12 grupos da Copa 2026
- ✅ Interface para fazer palpites das partidas
- ✅ Ranking de participantes em tempo real
- ✅ Painel administrativo para gerenciar partidas
- ✅ Cálculo automático de pontos via stored procedure
- ✅ Row Level Security (RLS) para proteção de dados
- ✅ Bloqueio de palpites após o início da partida

## 🎯 Regras de Pontuação

- **5 pontos**: Placar exato
- **3 pontos**: Acertar vencedor e saldo de gols
- **1 ponto**: Acertar apenas o vencedor ou empate

## 🛠️ Configuração do Projeto

### Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (gratuita em [supabase.com](https://supabase.com))

### Passo 1: Clonar o projeto

```bash
git clone <seu-repositorio>
cd Bolao
```

### Passo 2: Instalar dependências

```bash
npm install
```

### Passo 3: Configurar o Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Vá em Settings > API e copie:
   - Project URL
   - anon public key
3. Crie um arquivo `.env.local` na raiz do projeto:

```bash
cp .env.example .env.local
```

4. Edite o `.env.local` com suas credenciais:

```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

### Passo 4: Configurar o banco de dados

1. No painel do Supabase, vá em SQL Editor
2. Abra o arquivo `schema.sql` do projeto
3. Copie todo o conteúdo e execute no SQL Editor
4. Isso criará todas as tabelas, funções e políticas de segurança

### Passo 5: Executar o seed (opcional)

Para popular o banco com dados de exemplo:

```bash
npm run dev
```

Depois, no console do navegador ou via script, execute:

```typescript
import { runSeed } from './src/seed'
runSeed()
```

Ou crie um script temporário para executar o seed.

### Passo 6: Iniciar o projeto

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 📁 Estrutura do Projeto

```
Bolao/
├── src/
│   ├── components/
│   │   ├── ui/          # Componentes shadcn/ui
│   │   └── Layout.tsx   # Layout principal com navegação
│   ├── pages/          # Páginas da aplicação
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Groups.tsx
│   │   ├── Predictions.tsx
│   │   ├── Ranking.tsx
│   │   └── Admin.tsx
│   ├── hooks/          # Hooks customizados
│   │   └── useAuth.ts
│   ├── lib/            # Utilitários e configurações
│   │   ├── supabaseClient.ts
│   │   └── utils.ts
│   ├── types/          # Tipos TypeScript
│   │   └── database.ts
│   ├── App.tsx         # Configuração de rotas
│   ├── index.css       # Estilos globais (Tailwind)
│   └── seed.ts         # Script de seed com dados mock
├── schema.sql          # Schema do banco de dados
├── tailwind.config.js  # Configuração do Tailwind
├── tsconfig.json       # Configuração do TypeScript
└── vite.config.ts      # Configuração do Vite
```

## 🔐 Segurança

O projeto implementa Row Level Security (RLS) no Supabase para garantir que:

- Usuários só possam ver e editar seus próprios palpites
- Apenas administradores possam gerenciar partidas
- Palpites não possam ser inseridos/após o início da partida
- Dados sensíveis estejam protegidos

## 👤 Usuário Administrador

Para criar um usuário administrador:

1. Crie um usuário normalmente via interface
2. No painel do Supabase, vá em Table Editor > profiles
3. Edite o usuário e marque `is_admin` como `true`

## 🚀 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório ao Vercel
2. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automático

### Outras plataformas

O projeto pode ser deployado em qualquer plataforma que suporte aplicações Vite/React (Netlify, Railway, etc.).

## ⚡ Edge Functions - Sincronização Automática de Partidas

O projeto inclui uma Edge Function para sincronizar automaticamente os resultados das partidas usando a API do football-data.org.

### Configuração da Edge Function

#### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

#### 2. Linkar ao projeto Supabase

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

#### 3. Configurar variáveis de ambiente da Edge Function

No painel do Supabase:
1. Vá em Edge Functions > Settings
2. Adicione as seguintes variáveis de ambiente:
   - `SUPABASE_URL`: URL do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (Project Settings > API)
   - `FOOTBALL_DATA_TOKEN`: Token da API football-data.org (obtenha em https://www.football-data.org/)

#### 4. Deploy da Edge Function

```bash
# Deploy da função sync-matches
supabase functions deploy sync-matches
```

#### 5. Configurar pg_cron para execução automática

No painel do Supabase, vá em SQL Editor e execute o arquivo `supabase/migrations/20240523_add_pg_cron.sql`.

**Importante**: Antes de executar, substitua:
- `YOUR_PROJECT_REF` pelo seu project reference do Supabase
- `YOUR_SERVICE_ROLE_KEY` pela sua service role key

Exemplo do comando SQL atualizado:

```sql
SELECT cron.schedule(
  'sync-matches-every-10-minutes',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://abc123xyz.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'Content-Type', 'application/json'
    )::jsonb
  );
  $$
);
```

#### 6. Verificar o agendamento

```sql
SELECT * FROM cron.job;
```

#### 7. Testar a Edge Function manualmente

```bash
# Testar localmente
supabase functions serve sync-matches

# Ou fazer uma requisição HTTP direta
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-matches \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Como funciona a sincronização

1. A Edge Function roda a cada 10 minutos via pg_cron
2. Busca as partidas do dia atual na API football-data.org
3. Para cada partida finalizada (status == 'FINISHED'):
   - Encontra a partida correspondente no banco pelo nome das seleções
   - Atualiza o placar (home_score, away_score)
   - Muda o status para 'finished'
4. O trigger no banco calcula automaticamente os pontos dos palpites

### Troubleshooting

#### Verificar logs da Edge Function

No painel do Supabase: Edge Functions > sync-matches > Logs

#### Remover o agendamento pg_cron

```sql
SELECT cron.unschedule('sync-matches-every-10-minutes');
```

#### Re-deploy após alterações

```bash
supabase functions deploy sync-matches
```

## 📝 Scripts Disponíveis

```bash
npm run dev      # Inicia o servidor de desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build de produção
npm run lint     # Executa o linter
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🎨 Personalização

### Adicionar mais seleções

Edite o arquivo `src/seed.ts` e adicione as seleções desejadas no array `teamsData`.

### Modificar regras de pontuação

Edite a função `calculate_prediction_points` no arquivo `schema.sql`.

### Alterar cores e tema

Edite o arquivo `src/index.css` para modificar as variáveis CSS do tema.

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
