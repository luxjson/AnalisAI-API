# Contrato REST

Base da API: `/api/v1`. O navegador do site usa `/backend` através do proxy de mesma origem. O catálogo de **80 operações** está em `routes.json`; `openapi.json` é OpenAPI 3.1 e pode ser importado no Postman/Insomnia. É um catálogo das operações reais, com schemas das entradas principais; alguns DTOs específicos permanecem descritos pelos casos de uso, não por schemas exaustivos.

## Autenticação e CSRF

1. Faça `GET /auth/session` com cookies habilitados. Receba `identity` e `csrfToken`.
2. Faça `POST /auth/professor` com `{ "usuario": "email", "senha": "senha" }` ou `POST /auth/aluno` com `{ "email": "email", "senha": "senha" }`. O aluno também pode usar `matricula` no lugar de e-mail.
3. Em toda requisição mutável, inclusive login/logout, envie `X-CSRF-Token` e `Origin` igual a `APP_ORIGIN`. O token precisa corresponder à sessão atual.
4. O login regenera a sessão e devolve um novo `csrfToken`. Trocas de senha também renovam a sessão. Atualize o token a cada resposta que o contém.
5. Envie o cookie nas próximas chamadas; não use Bearer/JWT. No site, `credentials: same-origin` é suficiente porque o acesso ocorre por `/backend`.
6. `POST /auth/logout` destrói a sessão e remove o cookie.

Em produção: cookie `__Host-analisai.sid`; em desenvolvimento: `analisai.sid`. Duração configurada de 8 horas. A identidade é atualizada pelo banco nas requisições, impedindo continuidade de acesso de usuário desativado/removido.

`POST /auth/solicitacoes-senha` recebe `email` e retorna 202 com a mesma mensagem para conta existente/inexistente. A aprovação administrativa continua usando o fluxo original. Não há envio automático de e-mail.

## Convenções

- Corpos mutáveis: JSON, salvo os dois endpoints multipart abaixo.
- Parâmetros `id`: inteiro positivo. Atualização de usuário usa o ID do **caminho**, não um ID alternativo no corpo.
- Respostas de mutação de formulários podem conter `success`, `message`, `next` e `csrfToken`. `next` é orientação ao site, não redirecionamento HTTP nem template HTML.
- DTOs de páginas/coleções conservam os campos necessários à interface original; podem incluir classes/cores e resumos já calculados pelo backend.
- Erros controlados: 400 entrada inválida, 401 sessão necessária, 403 perfil/CSRF/origem recusados, 404 recurso não disponível, 409 conflito, 413 limite de tamanho, 429 excesso de tentativas, 500/503 indisponibilidade. Não devolvem stack ou credenciais.
- GET de dados autenticados: `Cache-Control: private, no-store`.

## Recursos principais

| Grupo | Operações e finalidade |
| --- | --- |
| Identidade | `GET /auth/session`, `GET /auth/csrf`, `POST /auth/professor`, `POST /auth/aluno`, `POST /auth/logout` |
| Professor | `GET /professores/painel`, `/estatisticas`, `/ia`; `PATCH /professores/senha` |
| Alunos | `GET/POST /alunos`, `GET/DELETE /alunos/:id`, `GET /alunos/:id/competencias`, `POST /alunos/:id/redefinicao-senha`, `PATCH /alunos/presenca` |
| Avaliações | `POST /avaliacoes`, `DELETE /avaliacoes/:id`; nota 0 é aceita |
| Importação/exportação | `POST /alunos/importacoes`, `/importacoes/completas`, `/importacoes/preview`; `GET /alunos/importacoes/modelo`, `/exportacoes` |
| Tarefas | `GET/POST /tarefas`, `GET/PATCH/DELETE /tarefas/:id`, `POST /tarefas/avaliacoes`, `/devolucoes`, `PATCH /tarefas/atribuicoes/status`, `GET /tarefas/estatisticas` |
| Calendário | `GET /calendario`, `GET /calendario/mes?mes=10&ano=2026`, `POST /calendario/eventos`, `/feriados`; exclusões em `/:id` |
| Estudante | `GET /estudante/painel`, `/competencias`, `/evolucao`, `/tarefas`, `/grafico`, `/ranking`, `/ia`; `PATCH /estudante/senha` |
| Entregas | `POST /estudante/atribuicoes/:id/entregas`, sendo `id` a linha de `tarefas_alunos` |
| Conta/notificações | `GET /conta`, `GET/PATCH /notificacoes`, `PATCH /notificacoes/:id`, `GET/PATCH /preferencias/notificacoes` |
| Administração | `GET/POST /admin/usuarios`, `PATCH/DELETE /admin/usuarios/:id`; solicitações em `/admin/solicitacoes-senha` |
| Manutenção | `POST /admin/reauth`, `/diagnosticos`, `/reparos`; `GET/POST /admin/backups`, `GET /admin/backups/:filename`, `DELETE /admin/dados-pedagogicos` |
| IA | `GET /ia/conversas`, `PATCH /ia/conversas/:id`, `POST /ia/estudante/mensagens`, `/ia/professor/mensagens`, `/ia/alunos/:id/analises`, `/ia/avaliacoes` |
| Anexos | `GET /arquivos/:filename`; acesso conferido por atribuição/proprietário |
| Público | `GET /equipe`, `GET /health`, `GET /`, `GET /openapi.json`; `/health` da raiz do servidor é o endpoint usado pelo Render |

Acesso escolar: Professor, Coordenador ou Admin. Acesso `/admin`: Admin. Rotas `/estudante`: Aluno. Isso mantém o negócio do banco original, que não possui associação exclusiva de professor a cada turma. O catálogo `routes.json` especifica o perfil de cada operação.

## Entradas importantes

Cadastro de aluno: `nome`, `ano_escolar`, `idade` (inteiro entre 10 e 20). A API gera login, matrícula e senha aleatória; preserve a mensagem/credencial retornada antes de fechar a interface. A presença inicial segue o padrão de cadastro; mudanças posteriores usam a operação de presença.

Tarefa: `titulo`, `descricao`, `turma`, `data_entrega` (opcional, `YYYY-MM-DD`), `prioridade` (BAIXA/MEDIA/ALTA), `competencia_id` (opcional), `alunos` (array opcional de até 500 IDs). Array vazio mantém a atribuição à turma inteira. Lista inválida é recusada, sem converter IDs inválidos em atribuição geral.

Importação: `{ "alunos": [...] }`, até 500 registros. A completa aceita `competencias: [{ "nome": "nome do catálogo", "nota": 0 }]` por aluno. Pré-valida catálogo/faixas antes da escrita transacional. Retorna importados, duplicados, erros e credenciais; não reutiliza a mesma senha previsível.

Troca de senha: `senha_atual`, `nova_senha`, `confirmar_senha`; nova senha entre 12 e 128 caracteres. Senhas legadas curtas continuam válidas para login, evitando bloqueio abrupto de contas existentes.

Alteração de nota por IA:

```json
{ "alunoId": 1, "competenciaId": 1, "nota": 0, "confirm": true }
```

`confirm` precisa ser booleano `true`; texto `"true"` ou `false` não autoriza a alteração. A escrita registra professor, aluno, competência e nota anterior/nova; nota anterior zero não é substituída por null.

Reautenticação: `{ "password": "senha administrativa" }` em `/admin/reauth`. Libera diagnóstico/reparo por até dez minutos; erro de senha revoga essa liberação. Não concede o perfil Admin a usuário comum.

## Arquivos

- `POST /alunos/importacoes/preview`: multipart, campo `arquivo`, XLSX/XLS/CSV. A planilha é interpretada no backend e a prévia limita-se a 100 registros.
- `POST /estudante/atribuicoes/:id/entregas`: multipart com `arquivo` opcional e `resposta_texto`, ou JSON somente com resposta textual. `id` não é o ID geral da tarefa.
- Até 10 MiB por arquivo, uma unidade por requisição. Extensão, MIME e assinatura são verificados; HTML/SVG executáveis não são aceitos como anexos.
- XLSX: diretório ZIP validado antes da interpretação, limite declarado de 32 MiB descompactados, 16 MiB por entrada, 2.000 entradas e razão 200. Parser executado em worker com tempo/heap limitados.
- Downloads são autenticados, em attachment e sem cache. Não existe pasta pública de uploads nem persistência dependente do disco efêmero do Render.

Lista completa de métodos/caminhos: `routes.json`. O adaptador de URLs do site é compatibilidade **interna de frontend**; clientes novos devem usar diretamente os recursos REST acima.
