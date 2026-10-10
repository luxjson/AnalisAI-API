-- Existing installations: preserve data while aligning task states and backup metadata.
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS tipo_backup TEXT NOT NULL DEFAULT 'json';
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS snapshot_id TEXT;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_status_check;
ALTER TABLE tarefas ADD CONSTRAINT tarefas_status_check CHECK (status IN ('ATIVA','INATIVA','CONCLUIDA')) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_tarefas_criador ON tarefas(criado_por,data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_alunos_status ON tarefas_alunos(aluno_id,status);
-- Synchronize derived pedagogical values after every relevant write.
CREATE OR REPLACE FUNCTION analisai_recompute_student(p_id INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE average_grade NUMERIC;
BEGIN
 SELECT COALESCE(AVG(nota),0) INTO average_grade FROM aluno_competencias WHERE aluno_id=p_id;
 UPDATE alunos SET nota=average_grade,
 nivel=CASE WHEN average_grade>=7 AND presenca>=75 THEN 'APTO'
 WHEN average_grade<5 OR presenca<50 THEN 'INAPTO' ELSE 'EM DESENVOLVIMENTO' END
 WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION analisai_after_assessment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM analisai_recompute_student(OLD.aluno_id);RETURN OLD;END IF;
 PERFORM analisai_recompute_student(NEW.aluno_id);
 IF TG_OP='UPDATE' AND OLD.aluno_id<>NEW.aluno_id THEN PERFORM analisai_recompute_student(OLD.aluno_id);END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS analisai_assessment_update ON aluno_competencias;
CREATE TRIGGER analisai_assessment_update AFTER INSERT OR UPDATE OR DELETE ON aluno_competencias FOR EACH ROW EXECUTE FUNCTION analisai_after_assessment();
CREATE OR REPLACE FUNCTION analisai_before_attendance() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE average_grade NUMERIC;
BEGIN
 SELECT COALESCE(AVG(nota),0) INTO average_grade FROM aluno_competencias WHERE aluno_id=NEW.id;
 NEW.nivel=CASE WHEN average_grade>=7 AND NEW.presenca>=75 THEN 'APTO'
 WHEN average_grade<5 OR NEW.presenca<50 THEN 'INAPTO' ELSE 'EM DESENVOLVIMENTO' END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS analisai_attendance_update ON alunos;
CREATE TRIGGER analisai_attendance_update BEFORE UPDATE OF presenca ON alunos FOR EACH ROW EXECUTE FUNCTION analisai_before_attendance();
