# Arquitetura e preservação do negócio

A aplicação anterior unia templates EJS, HTTP, SQL, validação e scripts do navegador. A entrega separa uma API REST em n camadas de um site React + Vite. É uma arquitetura em camadas; não se apresenta como uma implementação estrita de Clean Architecture com inversão de todas as dependências.

## Caminho de uma requisição

1. `presentation/app.js` configura cabeçalhos, JSON, CORS, sessão, CSRF, limites e identificação atual do usuário.
2. `presentation/routes.js` escolhe o recurso HTTP, aplica o perfil necessário e chama `execute(useCase)`.
3. `execute.js` converte entrada, filtros, parâmetros, sessão e arquivo em um comando. Converte o resultado do caso de uso em JSON ou download.
4. `application/useCases` valida a operação e coordena consultas, transações e serviços. Não recebe `req`/`res` do Express e não renderiza templates.
5. `domain` define formatos, faixas, identificadores, cálculos pedagógicos e políticas de arquivos.
6. `infrastructure/repositories` concentra SQL parametrizado; `database`, `passwords`, `sessionStore` e `fileStore` realizam as operações concretas.

Os repositórios mantêm instruções SQL separadas, com nomes por caso de uso. A aplicação coordena transações usando uma única conexão durante cada operação. Algumas consultas de infraestrutura HTTP, como leitura da identidade atual e verificação de acesso a anexos, permanecem no limite HTTP. Nenhum DDL é executado por requisição ou por inicialização normal da API.

## Regras mantidas

- Catálogo original de competências, séries/turmas, prioridades e níveis pedagógicos.
- APTO: média de competências pelo menos 7 e presença pelo menos 75. INAPTO: média abaixo de 5 ou presença abaixo de 50. Demais casos: EM DESENVOLVIMENTO.
- A média deriva das avaliações registradas; nota e presença zero são valores válidos.
- Professores/Coordenadores mantêm o alcance escolar que existia no sistema; não foi inventado um vínculo professor–turma que o banco não possui.
- A alteração/exclusão de tarefas e eventos exige o criador ou administrador. O estudante entrega a própria atribuição, identificada por `tarefas_alunos.id`.
- Cadastro/importação de alunos mantém geração de login e matrícula. Senhas temporárias agora são aleatórias, apresentadas somente ao usuário autorizado na conclusão da operação.
- Redefinição de senha de professor continua dependendo da análise do administrador. Não foi criado envio de e-mail sem infraestrutura existente.
- O assistente pedagógico mantém os contextos e instruções da aplicação. A alteração de nota exige professor autenticado e confirmação explícita `confirm: true`; o modelo não executa SQL nem escreve notas automaticamente.
- Calendário conserva eventos por turma e feriados, incluindo recorrência anual, intervalos de datas e cores existentes.
- Diagnóstico, reparo, exportação, preferências e notificações continuam disponíveis com o visual anterior.

## Fronteira do frontend

JSX recebe DTOs prontos, classes/cores de desempenho e dados de calendário do backend. Eventos e animações do navegador são módulos React; modais e listas são nós JSX. A interface conserva IDs/classes necessários às interações e o comportamento visual existente. Algumas interações ainda usam seletores DOM e subárvores React locais para preservar os fluxos originais durante a migração.

O frontend não consulta PostgreSQL, não gera planilhas, não calcula aprovação/reprovação e não possui chaves de IA. O adaptador `services/api.js` transforma as antigas ações visuais em recursos REST. As URLs das páginas continuam familiares; as antigas URLs Express não são endpoints da API nova.

Sessões PostgreSQL e limites de acesso persistem entre reinícios. Autenticação usa cookie de sessão; REST não implica obrigatoriamente JWT. Dados de tela e respostas de mutação são JSON, sem HTML EJS ou redirecionamento HTTP para templates.
