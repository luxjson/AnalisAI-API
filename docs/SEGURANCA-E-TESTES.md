# Auditoria e teste de segurança — 10/10/2026

## Escopo e evidências

Revisão estática dos 190 arquivos extraídos do projeto, migração dos componentes/casos de uso e testes automatizados em ambiente isolado. O banco Neon foi inspecionado somente por consultas de leitura a metadados/restrições e contagens; não foram modificados registros reais. O inventário por arquivo, hashes e destino está em `auditoria-arquivos.csv`/`.json`.

A suíte usa Express real, Supertest, PostgreSQL em PGlite e dados fictícios; inclui testes com o armazenamento PostgreSQL de sessões, além de testes de fronteira HTTP. O frontend é compilado pelo Vite e testado com React e JSDOM. As respostas dos provedores de IA são simuladas. Resultado final: **42/42 testes da API e 50/50 testes do site aprovados**, build Vite concluído e zero vulnerabilidades reportadas por `npm audit` nos dois pacotes nesta consulta. Consulte os logs em `evidencias` e `evidencias/RESULTADO.json` para os resultados reproduzíveis. A auditoria de dependências não prova ausência de vulnerabilidades desconhecidas.

Este trabalho inclui testes de ataque automatizados e revisão de código. Não equivale a um pentest manual completo de um serviço publicado, à análise de infraestrutura do Render/Vercel/Neon ou a garantia de ausência de bugs/vulnerabilidades. Não houve alteração do banco de produção nem chamadas pagas à IA.

## Correções e controles

| Área | Problema/risco identificado | Implementação e verificação |
| --- | --- | --- |
| Senhas | bcrypt legado, geração previsível/recuperação insegura | Argon2id; compatibilidade bcrypt e rehash no login válido; senha aleatória por credencial; teste de upgrade e comparação |
| Sessão | Fixação/continuidade de sessões antigas após mudança de identidade | Regeneração no login/senha, revogação em PostgreSQL e identidade atualizada por consulta; testes de fixação, desativação e troca de senha |
| Cookies | Cookies entre domínios e armazenamento de autenticação no navegador | Rewrite de mesma origem; HttpOnly, Secure, SameSite=Lax, prefixo __Host em produção; nenhum JWT/localStorage de autenticação |
| CSRF/CORS | Operações mutáveis sem validação completa de origem/sessão | Token sincronizado e comparação de tempo constante; origem exata; testes sem token, token inválido e origem hostil |
| XSS | HTML construído por concatenação em mensagens, listas e modais | JSX para conteúdo dinâmico, sanitize-html para texto de entrada, DOMPurify para único sink de texto rico; JSON de scripts com caracteres perigosos escapados |
| Autorização/IDOR | IDs da tarefa/atribuição confundidos, acesso a recursos alheios | Proprietário da atribuição/anexo/notificação/conversa verificado; alteração de tarefa/evento por criador/Admin; testes de acesso cruzado |
| SQL injection | SQL e fluxo HTTP misturados | SQL nos repositórios, valores parametrizados e identificadores internos em listas permitidas; testes com payload SQL e IDs inválidos |
| Mass assignment | Entradas arbitrárias, tipos ambíguos e campos de protótipo | Campos explicitamente selecionados, IDs/faixas/tipos verificados; teste de objeto inválido e __proto__ |
| Upload | Arquivo disfarçado, nome público e armazenamento efêmero | Limite de tamanho, extensão/MIME/assinatura, UUID, bytea PostgreSQL, download autenticado attachment; teste de PDF falso e propriedade |
| Planilhas | Parser no browser/dependência npm antiga e compressão abusiva | SheetJS 0.20.3 do tarball oficial; pré-validação de ZIP e worker limitado; testes de CSV com zeros e metadados abusivos |
| Limites | Tentativas/estado somente em memória | Rate limit atômico em PostgreSQL, limites menores para login/reset/IA/reauth e cabeçalhos Retry-After; teste de excesso de login |
| Administração | Cargo Coordenador incompatível, último Admin removível, reparo exposto | Migração de cargo, proteção no caso de uso/trigger do último Admin, reautenticação temporária para manutenção; testes de caminho REST e bloqueios |
| Integridade | Zero perdido, estados inválidos, avaliação duplicada/fora de fluxo | Validação/transação/locks, estado CONCLUIDA, proteção de avaliação e sincronização pedagógica por triggers; regressões de notas/presença/importação |
| Transporte | Certificado PostgreSQL não verificado | TLS verificado; flags de URL não substituem a configuração; recusa TLS desativado em produção |
| Informação | Erros/URLs/credenciais expostos ao frontend | Erros HTTP sanitizados, no-store, segredos somente no backend e auditoria de metadados sem corpos/senhas |
| Dependências | Vulnerabilidades em dependência transitiva e XLSX antigo | Lockfiles, override compatível de uuid da cadeia ExcelJS, tarball oficial SheetJS; `npm audit` final dos dois pacotes |

Argon2id usa memoryCost 19.456 KiB, timeCost 2 e parallelism 1, alinhado ao mínimo publicado pela OWASP. A intensidade deve ser aferida com a instância real antes de aumentar concorrência. O módulo de senhas ainda aceita hashes bcrypt existentes; novas senhas são Argon2id.

O CSP do site exige scripts da própria origem e bloqueia object/frame externo. `style-src 'unsafe-inline'` permanece para preservar o CSS inline original; não foi liberado JavaScript inline/eval. As fontes externas existentes são restritas aos domínios de fontes do Google; ícones Phosphor foram fixados na mesma versão 2.1.1 e servidos localmente.

## O que os testes cobrem

- Perfis, sessão/CSRF/cabeçalhos, limite de JSON e login, sanitizer e Argon2id.
- Fluxos de aluno/professor/admin; nota e presença zero; avaliação duplicada/ordem de entrega; calendário mensal e feriado recorrente.
- Persistência/revogação de sessão, upgrade bcrypt, preferências, atribuição distinta da tarefa e acesso ao anexo.
- Importação com catálogo inválido/rollback/duplicidade, CSV/XLSX, backup com colunas JSONB legadas e datas ISO.
- SQL injection, origem hostil, protótipo, último administrador, reautenticação e compressão abusiva.
- Adaptadores Gemini/Groq com respostas simuladas, erro/quota/resposta vazia, chave somente em cabeçalho do backend.
- Renderização das 25 páginas JSX, escape de XSS armazenado, sanitizer de texto rico, JSON de script e clique real nas abas de login em JSDOM.
- Configuração dinâmica do destino Vercel, recusa de origem insegura e no-store.

## Limites e validações ainda dependentes de implantação

Não foi possível executar uma comparação visual por pixels em navegador Chromium neste ambiente. A evidência visual disponível é identidade dos arquivos estáticos e comparação da estrutura DOM/classes/IDs/estilos inline das 25 páginas, com dados de teste equivalentes. Canvas de gráficos foi substituído por stub nos testes de inicialização; aparência/touch/responsividade devem ser conferidos no navegador publicado.

Não foi executada migração, carga concorrente ou login na produção; a compatibilidade foi avaliada por metadados reais e testes de esquema isolado. Teste as migrações em branch antes da publicação. O serviço público ainda precisa da verificação de cookies/origem/IP de proxy, quotas reais da IA, latência e disponibilidade descrita em DEPLOY.md.

Validação de MIME/assinatura não é antivírus nem inspeção completa de PDF/Office/ZIP. Arquivos permitidos ainda podem conter conteúdo malicioso ao serem abertos por terceiros. Para distribuição ampla ou dados sensíveis, integre varredura/CDR e isolamento adequados ao fluxo de anexos.

Limites de metadados ZIP e heap do worker reduzem risco, mas não representam prova contra todo arquivo malformado nem limite absoluto para memória externa de Buffer. Monitore CPU/RAM e falhas do parser em produção. Não houve fuzzing extensivo, teste de volumetria ou varredura DAST do deploy.

Backups JSON no mesmo banco não substituem cópia externa; snapshots opcionais exigem branch correto e gestão de retenção/custos. A auditoria de eventos grava somente metadados, porém a retenção dessa tabela deve ser definida pelo operador conforme volume e finalidade.

A conta administrativa originalmente fornecida está preservada. A entrega não inventa política de MFA, recuperação por e-mail ou relações professor–turma que não existiam no negócio; esses recursos exigem definição e infraestrutura própria.

A atualização da navegação e dos skeletons está documentada em `../../site/docs/NAVEGACAO-E-SKELETONS.md`, com evidências em `../../site/docs/evidencias/navegacao-skeletons.json`.

A revisão atual de código, formatação e conexões está descrita em `REVISAO-E-FORMATACAO.md`; os números e arquivos estão em `evidencias/revisao-formatacao.json` e `inventario-revisao-atual.json`.
