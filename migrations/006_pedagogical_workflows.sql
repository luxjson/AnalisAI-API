ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_perfil TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE usuarios SET onboarding_concluido = TRUE WHERE onboarding_concluido = FALSE;

CREATE TABLE IF NOT EXISTS professor_turmas (
  id BIGSERIAL PRIMARY KEY,
  professor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  turma VARCHAR(50) NOT NULL CHECK (
    turma IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')
  ),
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (professor_id, turma)
);
CREATE INDEX IF NOT EXISTS idx_professor_turmas_professor
  ON professor_turmas(professor_id, turma);

UPDATE usuarios u
SET onboarding_concluido = FALSE
WHERE u.cargo = 'Professor'
  AND NOT EXISTS (
    SELECT 1 FROM professor_turmas pt WHERE pt.professor_id = u.id
  );

CREATE TABLE IF NOT EXISTS frequencia_registros (
  id BIGSERIAL PRIMARY KEY,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  turma VARCHAR(50) NOT NULL CHECK (
    turma IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')
  ),
  data_aula DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENTE', 'FALTA', 'JUSTIFICADA')),
  justificativa VARCHAR(1000),
  registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (horario_fim > horario_inicio),
  UNIQUE (aluno_id, data_aula, horario_inicio, horario_fim)
);
CREATE INDEX IF NOT EXISTS idx_frequencia_aluno_data
  ON frequencia_registros(aluno_id, data_aula DESC);
CREATE INDEX IF NOT EXISTS idx_frequencia_turma_data
  ON frequencia_registros(turma, data_aula DESC);

CREATE TABLE IF NOT EXISTS solicitacoes_relatorio (
  id BIGSERIAL PRIMARY KEY,
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  professor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  aluno_id INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
  turma VARCHAR(50) CHECK (
    turma IS NULL OR turma IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')
  ),
  mensagem VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
  resposta VARCHAR(2000),
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (aluno_id IS NOT NULL OR turma IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_relatorio_professor
  ON solicitacoes_relatorio(professor_id, status, data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_relatorio_solicitante
  ON solicitacoes_relatorio(solicitante_id, data_solicitacao DESC);
