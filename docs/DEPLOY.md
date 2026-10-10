# Desenvolvimento, migração e publicação

## Antes de aplicar alterações no banco existente

A inspeção real foi somente de leitura. O banco tem senhas bcrypt e variações legadas em `system_backups`; a refatoração considera essa compatibilidade. Nenhuma migração foi aplicada nele durante esta revisão.

1. Faça um backup externo/branch recuperável do banco existente.
2. Crie um branch de desenvolvimento no Neon para validar a migração, com acesso e dados adequados ao ambiente.
3. Configure `DB_URL` e `DB_URL_UNPOOLED` para **o mesmo banco e branch**, respectivamente pooled e direto.
4. Execute `npm ci`, `npm run migrate` e `npm test` em `api`.
5. Verifique login dos perfis, notas/presença, calendário, importação, tarefas e anexos nesse ambiente.
6. Só então aplique as migrações no banco de produção durante uma janela controlada e publique a API/site.

O migrador usa transação, advisory lock e `schema_migrations`. Ele recusa hostname `-pooler` para migrações. Não insere alunos/usuários de demonstração. Migrações já registradas são ignoradas; não edite arquivos já aplicados, adicione uma nova migração.

| Migração | Efeito |
| --- | --- |
| `001_schema.sql` | Baseline e compatibilidade; tabelas, catálogo de competências, sessões/arquivos/limites; mantém a configuração de notificações de maior ID quando há duplicatas do mesmo dono |
| `002_compatibility.sql` | Estado CONCLUIDA, metadados de backup, índices e sincronização da média/nível após avaliações e presença |
| `003_security.sql` | Auditoria de metadados, limpeza de anexo removido e proteção do último administrador ativo |
| `004_coordinator_role.sql` | Alinha o cargo Coordenador que a interface já oferecia à restrição do banco |

Restrições `NOT VALID` protegem novas escritas sem impedir automaticamente a migração por registros antigos fora de faixa. O diagnóstico sinaliza dados legados; um reparo é uma ação administrativa explícita. Não há script automático de rollback que apague dados: para reversão, restaure o branch/backup preparado e a versão anterior da aplicação. Sessões antigas de outras implementações não são migradas; usuários podem precisar entrar novamente.

## Render — API

Crie um Web Service Node com Root Directory `api`.

| Campo | Valor |
| --- | --- |
| Node | 24 LTS; `.node-version` fornecido |
| Build | `npm ci --omit=dev` |
| Pre-deploy | `npm run migrate` |
| Start | `npm start` |
| Health check | `/health` |
| Instance | Plano pago sempre ativo, por exemplo Starter |

O serviço gratuito do Render pode suspender por inatividade; para a exigência de 24 horas, use instância paga. Não foi implementado ping artificial para tentar impedir suspensão. A API escuta `0.0.0.0` e a porta `PORT` do Render, com encerramento SIGTERM/SIGINT.

Configure os valores do `.env` em Environment do Render, sem publicar o arquivo:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://seu-site.vercel.app
DB_POOL_MAX=3
BACKUP_ENABLED=false
```

Além desses, configure `DB_URL`, `DB_URL_UNPOOLED`, `SESSION_SECRET`, `AI_PROVIDER`, `AI_KEY`, `AI_MODEL` e `PASS_DELETE_HASH`. Use a origem exata do site, sem `/` final. Não desative TLS nem validação de certificado. A chave de sessão deve ser estável e compartilhada por réplicas.

O exemplo `api/render.yaml` descreve o serviço. Para usar Blueprint em um repositório com as duas pastas, copie esse arquivo para a raiz do repositório ou selecione seu caminho no painel; ele pressupõe Root Directory `api`. Para repositório contendo somente a API, ajuste `rootDir`. O ZIP conserva exatamente as duas pastas solicitadas.

`DB_POOL_MAX=3` é por processo: considere o total de réplicas e os limites do Neon antes de escalar. Backups JSON armazenam dados no próprio banco; são úteis para exportação, mas não substituem uma cópia externa de recuperação. O agendamento opcional foi pensado para uma instância; múltiplas réplicas podem disparar backups simultâneos. Snapshots Neon exigem projeto **e branch pai** explícitos, podem ter custo e não são excluídos automaticamente quando os 15 metadados locais mais antigos são removidos.

## Vercel — site

1. Crie o projeto com Root Directory `site` e preset Vite.
2. Use build `npm run build`, output `dist` e Node 24 LTS.
3. Configure a única variável do site: `VITE_API_URL=https://sua-api.onrender.com`.
4. Publique e configure a URL resultante em `APP_ORIGIN` da API; reinicie a API se esse valor mudou.
5. Mudanças no endereço da API exigem redeploy do site.

`vercel.mjs` exporta a configuração programática documentada pela Vercel. O rewrite externo envia `/backend/:path*` para `${VITE_API_URL}/api/v1/:path*`; o fallback serve `index.html` para as páginas React. A URL é validada e precisa ser HTTPS, sem credenciais, query ou caminho adicional. Não mantenha um `vercel.json` em paralelo.

O browser recebe o cookie através da origem do site: HttpOnly, Secure, SameSite=Lax e sem Domain. Em produção seu nome é `__Host-analisai.sid`. O CSRF usa `X-CSRF-Token`, sessão e origem exata. Nenhum cookie é lido pelo JavaScript e nenhum token de autenticação é guardado em localStorage.

Previews do Vercel com outra origem devem apontar para uma API de staging com o `APP_ORIGIN` correspondente. A API de produção não libera automaticamente qualquer domínio `*.vercel.app`.

## Validação após publicar

- `/health` no Render retorna UP; uma falha de banco deve retornar 503.
- Acesse diretamente páginas internas do site e atualize a página, confirmando o fallback React.
- Entre como professor e aluno e confira que o cookie fica na origem do site, Secure/HttpOnly, e que o logout o remove.
- Verifique POST/PATCH/DELETE com CSRF, bloqueio de perfil e arquivos de outro aluno.
- Confira se o IP usado no limite de tentativas representa corretamente os clientes através dos proxies reais; teste o cenário com mais de um usuário antes de ampliar tráfego.
- Faça importação/exportação e uma entrega com anexo abaixo de 10 MiB.
- Teste a chave/modelo real de IA e as quotas do provedor. Os testes entregues simulam as respostas do provedor.

Não houve deploy em Vercel/Render, teste real de cobrança/quotas de IA ou pentest do ambiente público nesta revisão. As configurações e testes locais são evidências preparatórias; a validação acima depende das URLs e serviços publicados.
