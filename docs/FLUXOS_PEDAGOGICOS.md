# Fluxos pedagógicos do AnalisAI

## Objetivo

O AnalisAI consolida avaliações por competência, níveis de desempenho, frequência, observações e tarefas para apoiar decisões pedagógicas. O fluxo deve reduzir o trabalho de reunir planilhas, tornar as lacunas visíveis e manter histórico rastreável.

## Perfis e responsabilidades

### Professor
1. No primeiro acesso, completa a configuração da conta: nome, foto opcional e turmas sob sua responsabilidade.
2. No painel, acompanha os indicadores das turmas atribuídas.
3. No Editor, mantém os cadastros necessários e registra avaliações vinculadas às competências e habilidades.
4. A partir do Editor, abre **Frequência** e registra a situação de cada aluno por data e período de aula.
5. Consulta tarefas, acompanha devolutivas e responde às solicitações de relatório da coordenação.
6. Pode baixar um relatório individual dos alunos das próprias turmas.

A API confere as turmas atribuídas no servidor; ocultar um link na interface não substitui autorização.

### Coordenador pedagógico
1. Acompanha indicadores gerais e acessa Relatórios pedagógicos.
2. Solicita a um professor um relatório de uma turma ou de um aluno, descrevendo quais evidências precisa.
3. Acompanha as solicitações e consulta os PDFs individuais disponíveis.
4. Não utiliza os fluxos operacionais de lançamento de nota, frequência, criação de tarefas ou gestão diária do professor.

### Administrador
Pode gerenciar usuários e acessar os fluxos gerais da instituição. As operações administrativas e de exclusão continuam protegidas por autorização específica.

### Aluno
Consulta o próprio painel, competências, evolução, tarefas e dados de frequência disponibilizados. O endpoint do relatório em PDF valida que a conta de aluno só baixe seu próprio documento.

## Frequência: conceito e cálculo

A frequência é registrada por **aluno + data + horário de início + horário de fim**. Cada aula/período recebe uma única situação:

- **Presente**: o período conta como presença.
- **Falta**: o período conta como ausência.
- **Falta justificada**: continua registrada separadamente como ausência justificada; é exigido o motivo.

A porcentagem anual usa somente os períodos de aula que foram registrados:

`frequência (%) = períodos presentes / períodos registrados × 100`

Uma aula não lançada não é inferida como falta. Sábados, domingos e feriados também não geram ausências automaticamente. Sem períodos registrados, a interface mostra **Sem registros de aula**, e não 100%.

O calendário indica se o ano tem 365 ou 366 dias (regra gregoriana). Essa contagem é informativa: **não é o denominador da frequência**, pois os dias do calendário não equivalem a dias ou períodos letivos. Os lançamentos ficam associados ao ano da data da aula e podem ser corrigidos substituindo a mesma combinação de aluno/data/horário, mantendo um registro coerente do estado atual.

Antes de lançar frequência, selecione a turma, data e horário; confira os alunos, escolha a situação de cada um, preencha as justificativas necessárias e salve. As ações de marcar a turma inteira servem como atalho, e devem ser verificadas antes de salvar.

## Relatório pedagógico individual

O PDF reúne os dados identificadores do aluno, turma, nível, histórico de notas por competência, observações e frequência do ano selecionado. A frequência é recalculada diretamente dos períodos registrados para o ano do relatório. O relatório identifica quando ainda não existem registros de aula, em vez de inventar uma porcentagem.

Os PDFs são gerados sob demanda com os registros atuais. Para evidências em reuniões, confira se as avaliações, observações e aulas esperadas já foram lançadas.

## Fluxo de solicitação da coordenação

Em **Relatórios pedagógicos**, selecione turma ou aluno, professor responsável e descreva a análise solicitada. O sistema cria uma solicitação com estado **Pendente**. O professor responsável pode marcá-la como **Em andamento** ou **Concluída**, acrescentando uma resposta. A coordenação consulta as solicitações que enviou; cada professor consulta as solicitações que recebeu.

O professor precisa estar vinculado à turma solicitada. Para um pedido de aluno, a turma é conferida em relação ao cadastro do aluno.

## Importação e atualização dos dados

- Preserve a planilha original como fonte; não altere manualmente os registros de origem para obter métricas.
- Use o modelo de importação do AnalisAI e a pré-visualização antes de confirmar importações.
- As transformações de dados e os cálculos devem ser feitos pela aplicação e repetidos com o mesmo conjunto de registros.
- Após importar dados ou lançar uma avaliação, confira se aluno, turma, competência/habilidade e nota foram associados corretamente.
- A frequência da implementação é construída pelos novos registros de aula. Valores percentuais digitados manualmente no antigo campo de presença deixam de ser uma fonte editável; esse campo é apresentado como resultado calculado.
- Não presuma que importação de uma planilha cria, por si só, o histórico de cada período de aula. É necessário lançar as aulas no portal ou definir posteriormente um importador explícito para esse formato.

## Indicadores para análise por competência

Use as visões gerais para identificar competências com médias mais baixas, a distribuição de níveis e diferenças entre turmas. Em seguida:
1. valide os registros que alimentaram o indicador;
2. confira os alunos/competências envolvidos;
3. registre observações e tarefas de recuperação;
4. solicite ou gere um relatório para documentar a intervenção;
5. reavalie a competência após a atividade e compare a evolução.

Indicadores automatizados ajudam a priorizar a análise, mas não substituem a avaliação pedagógica do professor ou da coordenação.

## Implantação

A migration `006_pedagogical_workflows.sql` cria as tabelas de atribuição de turma, frequência e solicitações, além dos campos de perfil. Ela deve ser aplicada pelo fluxo de migração configurado para a API, em ambiente de teste primeiro. Depois da migração, valide login por perfil, atribuição de turmas, lançamento e correção de frequência, cálculo dos percentuais, permissões por cargo, geração do PDF, importação e exportação antes da liberação geral.

A migration **não foi executada manualmente em produção** durante o desenvolvimento. Não publique esta branch sem executar os checks, validar a migration contra uma cópia de dados representativa e testar restauração/backup conforme os procedimentos do ambiente.
