# Revisão e formatação — 10/10/2026

O código da API e do site foi padronizado com indentação de dois espaços e largura preferencial de 80 caracteres. Blocos, JSX, configurações, consultas SQL e textos extensos ficaram distribuídos em linhas legíveis. Foram removidos comentários do código próprio, imports sem uso e variáveis que sobraram da migração. Dependências vendorizadas e avisos legais permanecem preservados.

O inventário da revisão percorre os arquivos de ambas as pastas, separando código, configuração, documentação e recursos binários. Os 155 arquivos JavaScript/JSX/MJS foram analisados sintaticamente e suas referências locais foram verificadas. A revisão cruza os formulários e clientes HTTP com rotas, permissões, casos de uso, consultas e DTOs. Imagens, fontes, PDFs e favicon são conferidos por integridade; não são arquivos que possam ser revisados linha a linha.

## Correções desta versão

| Situação | Resultado |
| --- | --- |
| HTTP 200 com HTML, JSON nulo ou escalar | O cliente identifica uma resposta inválida e mostra um erro, em vez de tratar o carregamento como sucesso |
| Resposta atrasada de uma busca cancelada | Seu token CSRF não substitui o token atual |
| Turma inválida ao criar evento | A API rejeita a entrada, sem convertê-la em evento geral |
| Tabela de sessões ausente | A inicialização verifica a tabela; o armazenamento comunica a falha sem uma rejeição de Promise não tratada |
| Dez cadeias assíncronas sem tratamento de rejeição | As falhas chegam à mensagem de erro da rota; erros de páginas encerradas são ignorados |
| IA retorna 429/503 sem `Retry-After` | O retry usa uma espera limitada de dois segundos, mantendo uma única repetição |
| Validação de upload presa ao primeiro formulário da página | A validação pertence ao formulário de entrega e não bloqueia o logout |
| Destinos com barras invertidas ou caracteres de controle | Links internos e redirecionamentos recusam esses valores, que o navegador poderia normalizar como destinos externos |

Os nomes de variáveis que representavam o adaptador de senhas foram alinhados a `passwords`. Novos hashes continuam usando Argon2id; bcrypt permanece somente para verificar hashes legados e migrá-los após um login válido. Foram removidos 188 imports, nove bindings de `require` e 27 bindings de interação sem uso. Isso não altera as permissões ou os critérios pedagógicos.

## Verificações

- 42 testes da API e 50 testes do frontend aprovados; build Vite aprovado.
- 250 consultas dos repositórios equivalentes em sua sequência de tokens SQL.
- Quatro migrações equivalentes em tokens, sem nova migração ou execução no banco de produção.
- 26 CSS originais com seletores, declarações, valores e ordem equivalentes por AST; media queries e animações preservadas.
- 25 páginas com estrutura, classes, IDs e estilos inline equivalentes ao original com os mesmos dados de teste.
- 26 estados dinâmicos e nove configurações de gráficos equivalentes.
- 25 skeletons com os containers nativos das páginas; regressões de navegação, chat, ícones e senha de aluno preservadas.
- Verificação de formatação aprovada em 198 arquivos, excluindo dependências, artefatos de build, lockfiles e evidências geradas.
- Frontend sem credenciais do backend e com apenas `VITE_API_URL` como variável configurável.

As evidências estão em `evidencias/revisao-formatacao.json`, `inventario-revisao-atual.json`, nos logs das suítes e em `../../site/docs/evidencias/`. O inventário registra o arquivo, a quantidade de linhas, suas dependências e as verificações aplicadas.

Os testes usam React/JSDOM e Express/Supertest/PGlite, com dados isolados e respostas de IA simuladas. Não houve escrita no banco de produção. A revisão não demonstra ausência absoluta de bugs. A comparação estrutural e de CSS não substitui a medição por pixels em navegador; Chromium não funcionou neste ambiente. Provedores reais de IA, infraestrutura publicada e renderização real de Canvas não foram exercitados nesta rodada.

Republique a API no Render e o site no Vercel. Os comandos de build e deploy e as variáveis existentes continuam válidos; não foi adicionada uma nova dependência de runtime.

## Documentação consultada

| Fonte oficial | Conferência aplicada |
| --- | --- |
| [Express 5: tratamento de erros](https://expressjs.com/en/guide/error-handling/) | Propagação de falhas assíncronas e respostas da API |
| [express-session](https://expressjs.com/en/resources/middleware/session/) | Armazenamento, regeneração e persistência de sessão |
| [React: useEffect](https://react.dev/reference/react/useEffect) | Limpeza, cancelamento e descarte de respostas antigas |
| [React: useContext](https://react.dev/reference/react/useContext) | Layout nativo compartilhado pelos skeletons |
| [MDN: Response.json](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) | Respostas não JSON e erros de leitura |
| [node-postgres: consultas](https://node-postgres.com/features/queries) | Parâmetros e construção controlada das consultas |
| [node-postgres: transações](https://node-postgres.com/features/transactions) | Mesmo client, commit, rollback e release |
| [OWASP: armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Argon2id e compatibilidade com hashes legados |
| [OWASP: sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Renovação e invalidação de sessões |
| [OWASP: CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Origem e token nas operações autenticadas |
| [DOMPurify](https://github.com/cure53/DOMPurify) | HTML permitido nas respostas do assistente |
| [Prettier: opções](https://prettier.io/docs/options) | Indentação, largura preferencial e strings embutidas |
| [Prettier: CLI](https://prettier.io/docs/cli) | Formatação e conferência reproduzível |
| [Vite: build de produção](https://vite.dev/guide/build) | Compilação e saída estática |
| [Vercel: rewrites](https://vercel.com/docs/routing/rewrites) | Proxy de mesma origem para a API |
| [Render: Node/Express](https://render.com/docs/deploy-node-express-app) | Entrada, porta e health check |
| [Render: versão do Node](https://render.com/docs/node-version) | Versão de runtime configurada |

