CREATE TABLE IF NOT EXISTS frequencia_registros (
  id BIGSERIAL PRIMARY KEY,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data_aula DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENTE', 'FALTA', 'JUSTIFICADA')),
  registrado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (horario_fim > horario_inicio),
  UNIQUE (aluno_id, data_aula, horario_inicio, horario_fim)
);
CREATE INDEX IF NOT EXISTS idx_frequencia_data_horario
  ON frequencia_registros(data_aula, horario_inicio, horario_fim);
CREATE INDEX IF NOT EXISTS idx_frequencia_aluno_data
  ON frequencia_registros(aluno_id, data_aula DESC);