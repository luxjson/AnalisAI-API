# AnalisAI — API REST em camadas

Backend Node.js/Express 5, PostgreSQL/Neon e autenticação por sessão. Frontend separado em `../site`, React + Vite. A API responde JSON e arquivos; não renderiza EJS.

Comece por [DEPLOY.md](docs/DEPLOY.md), [ARQUITETURA.md](docs/ARQUITETURA.md), [API.md](docs/API.md) e [SEGURANCA-E-TESTES.md](docs/SEGURANCA-E-TESTES.md). O catálogo OpenAPI fica em `docs/openapi.json` e em `GET /api/v1/openapi.json`.

## Execução

Node.js 24 LTS recomendado; mínimo 22.12. Os lockfiles fazem parte da entrega.

```bash
cd api
npm ci
npm test
```

Os testes usam PostgreSQL isolado via PGlite, dados fictícios e credenciais fictícias. Não alteram o banco do `.env`.

Para iniciar a aplicação, configure o banco e execute as migrações **primeiro em um branch de desenvolvimento**:

```bash
npm run migrate
npm run dev
```

`npm run migrate` escreve no banco escolhido em `DB_URL_UNPOOLED`. O `.env` privado incluído mantém as credenciais fornecidas, apenas no backend; não envie esse arquivo ao Git nem o publique. As migrações desta entrega não foram executadas no banco real.

O banco existente mantém os usuários e senhas. bcrypt continua sendo aceito e é atualizado para Argon2id quando o login tem sucesso. Em banco novo, após migrar, use `npm run admin:create` em terminal interativo para criar o primeiro administrador sem colocar a senha na linha de comando. Se já existe administrador ativo, o comando recusa a criação.

## Configuração

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development` local; `production` no Render |
| `PORT` | Porta HTTP; o Render fornece a sua |
| `APP_ORIGIN` | Origem exata do site, sem barra final; HTTPS em produção |
| `SESSION_SECRET` | Segredo de assinatura de pelo menos 32 caracteres, estável entre reinícios/réplicas |
| `DB_URL` | Conexão PostgreSQL da aplicação; pooled no Neon |
| `DB_URL_UNPOOLED` | Conexão direta do mesmo banco/branch para migrações |
| `DB_POOL_MAX` | Máximo de conexões por processo; padrão 3 |
| `AI_PROVIDER`, `AI_KEY`, `AI_MODEL` | Provedor, chave e modelo da IA, exclusivamente no backend |
| `PASS_DELETE_HASH` | Hash Argon2id da senha administrativa de diagnóstico/reparo |
| `BACKUP_ENABLED` | `true` habilita o agendamento de backup; padrão de entrega `false` |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | Opcionais; snapshot do branch explicitamente configurado |

`DB_SSL_MODE=disable` serve somente para PostgreSQL local em desenvolvimento; é recusado em produção. A configuração normal verifica o certificado TLS. `PASS_DELETE` permanece como compatibilidade de instalações antigas; a entrega utiliza seu equivalente em hash. O modelo/provedor presentes no arquivo enviado foram mantidos.

## Estrutura

- `src/presentation`: HTTP, rotas, autenticação/autorização, CSRF, validação de limites e adaptação dos resultados.
- `src/application`: casos de uso e coordenação dos fluxos, transações e serviços.
- `src/domain`: validação, faixas pedagógicas e políticas de arquivos.
- `src/infrastructure`: repositórios SQL, PostgreSQL, sessões, senhas e armazenamento.
- `migrations`: alterações explícitas e versionadas do esquema.
- `tests`: regressões e testes de segurança reproduzíveis.
- `docs`: auditoria, implantação, rotas, documentação oficial e evidências.

A consulta ao banco real foi somente de leitura, para verificar esquema, restrições e compatibilidade. Não foram executados reparos, mudanças de senha, migrações ou exclusões em produção.
