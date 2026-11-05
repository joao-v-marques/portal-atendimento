-- Se o problema do atendimento foi resolvido, informado ao finalizar.
-- NULL: finalizado antes desta coluna existir (ou ainda em andamento), sem informação
ALTER TABLE service_requests ADD COLUMN resolved BOOLEAN;
