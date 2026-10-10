ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_check
  CHECK (cargo IN ('Professor', 'Coordenador', 'Admin')) NOT VALID;
