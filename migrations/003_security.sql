CREATE TABLE IF NOT EXISTS security_audit_events(
 id BIGSERIAL PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actor_kind TEXT,
 actor_id INTEGER,
 method VARCHAR(8) NOT NULL,
 resource VARCHAR(255) NOT NULL,
 outcome_status INTEGER NOT NULL CHECK(outcome_status BETWEEN 100 AND 599)
);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_time ON security_audit_events(occurred_at DESC);
-- Binary content belongs to an assignment. Cascaded removals must not orphan stored uploads.
CREATE OR REPLACE FUNCTION analisai_remove_assignment_file() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.resposta_arquivo IS NOT NULL THEN
  DELETE FROM uploaded_files WHERE storage_key=OLD.resposta_arquivo
  AND NOT EXISTS(SELECT 1 FROM tarefas_alunos WHERE resposta_arquivo=OLD.resposta_arquivo AND id<>OLD.id);
 END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS analisai_assignment_file_delete ON tarefas_alunos;
CREATE TRIGGER analisai_assignment_file_delete AFTER DELETE ON tarefas_alunos FOR EACH ROW EXECUTE FUNCTION analisai_remove_assignment_file();
-- Serialize removal/demotion of the final active administrator across replicas.
CREATE OR REPLACE FUNCTION analisai_preserve_admin() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.cargo='Admin' AND OLD.status='ATIVO' THEN
  PERFORM pg_advisory_xact_lock(hashtext('analisai-admin-membership'));
  IF TG_OP='DELETE' OR (NEW.cargo IS DISTINCT FROM 'Admin' OR NEW.status IS DISTINCT FROM 'ATIVO') THEN
   IF (SELECT COUNT(*) FROM usuarios WHERE cargo='Admin' AND status='ATIVO')<=1 THEN
    RAISE EXCEPTION 'O último administrador ativo não pode ser removido' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS analisai_admin_guard ON usuarios;
CREATE TRIGGER analisai_admin_guard BEFORE UPDATE OR DELETE ON usuarios FOR EACH ROW EXECUTE FUNCTION analisai_preserve_admin();
