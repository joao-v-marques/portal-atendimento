-- Renomeia a role de colaborador para colaborador do atendimento
UPDATE user_roles SET name = 'EMPLOYEE_SERVICE' WHERE name = 'EMPLOYEE';
