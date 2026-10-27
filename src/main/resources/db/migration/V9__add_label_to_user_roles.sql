-- Nome de exibição da role: o name continua sendo o código usado nas permissões (ROLE_<name>)
ALTER TABLE user_roles ADD COLUMN label VARCHAR(255);

UPDATE user_roles SET label = 'Administrador' WHERE name = 'ADMIN';
UPDATE user_roles SET label = 'Colaborador do atendimento' WHERE name = 'EMPLOYEE_SERVICE';
UPDATE user_roles SET label = 'Colaborador do relacionamento' WHERE name = 'EMPLOYEE_RELATIONSHIP';

-- Roles cadastradas por fora das migrations ficam com o próprio código até alguém editar
UPDATE user_roles SET label = name WHERE label IS NULL;

ALTER TABLE user_roles ALTER COLUMN label SET NOT NULL;
ALTER TABLE user_roles ADD CONSTRAINT uq_user_roles_label UNIQUE (label);
