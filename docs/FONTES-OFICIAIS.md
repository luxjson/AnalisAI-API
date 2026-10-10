# Documentação utilizada

Consulta em 09–10/10/2026. A auditoria do projeto precedeu a pesquisa; a implementação foi orientada por documentação oficial e pelos guias OWASP. As escolhas não significam certificação de segurança.

| Fonte primária | Aplicação na refatoração |
| --- | --- |
| https://expressjs.com/en/advanced/best-practice-security.html | Cabeçalhos, erros, cookies, entrada e produção |
| https://expressjs.com/en/guide/migrating-5.html | Compatibilidade Express 5 |
| https://expressjs.com/en/guide/behind-proxies.html | Limite de confiança de proxy |
| https://github.com/expressjs/session | Sessão, armazenamento, regeneração e cookies |
| https://react.dev/reference/react-dom/components/common | JSX, eventos, escaping e riscos de HTML bruto |
| https://vite.dev/guide/env-and-mode | Variáveis expostas pelo prefixo VITE |
| https://vite.dev/guide/build | Build e chunks de produção |
| https://vercel.com/docs/frameworks/frontend/vite | Deploy Vite, diretório e fallback |
| https://vercel.com/docs/project-configuration/vercel-ts | Configuração programática vercel.mjs e variável de destino |
| https://vercel.com/docs/rewrites | Encaminhamento de mesma origem para backend externo |
| https://render.com/docs/deploy-node-express-app | Serviço Node/Express, porta e publicação |
| https://render.com/docs/health-checks | Health check e disponibilidade |
| https://render.com/docs/free | Limitação de suspensão em plano gratuito |
| https://node-postgres.com/features/transactions | Conexão única por transação |
| https://node-postgres.com/features/ssl | TLS verificado e parâmetros de conexão |
| https://neon.com/docs/connect/connection-pooling | Pooler e conexão direta para migração |
| https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html | Argon2id e migração de hash |
| https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | Fixação, renovação, duração e atributos de cookie |
| https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | Token sincronizado e origem |
| https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html | Encoding contextual e sanitizer |
| https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html | Autorização, limites e respostas HTTP |
| https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | Limites, assinatura, nome e acesso de arquivo |
| https://github.com/ranisalt/node-argon2 | Implementação Argon2 em Node |
| https://github.com/apostrophecms/sanitize-html | Texto permitido e remoção de HTML |
| https://github.com/cure53/DOMPurify | Sanitização do texto rico do assistente |
| https://docs.sheetjs.com/docs/getting-started/installation/nodejs | Tarball oficial XLSX 0.20.3 |
| https://ai.google.dev/gemini-api/docs/text-generation | Contrato Gemini generateContent |
| https://console.groq.com/docs/text-chat | Contrato Groq chat completions |
| https://github.com/uuidjs/uuid | Compatibilidade CommonJS da cadeia ExcelJS |

Os links são para consulta das fontes; não foram copiados documentos completos para a entrega. Respostas e disponibilidade de APIs/planos podem mudar: valide as configurações reais no deploy.
