CREATE TABLE service_requests (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Informações do chamado
    protocol_number VARCHAR(20) NOT NULL UNIQUE,
    category_id INT NOT NULL, -- FK service_request_categories
    channel_id INT NOT NULL, -- FK service_request_channel
    type_id INT NOT NUL, -- FK service_requests_type
    severity_id INT NOT NULL, -- FK service_request_severity
    status_id INT NOT NULL, -- FK service_request_status

    -- Informações do solicitante
    requester_name VARCHAR(150) NOT NULL,
    requester_cpf CHAR(11),
    requester_birth_date DATE,
    requester_phone VARCHAR(20),
    requester_email VARCHAR(150),


    -- Conteúdo
    description TEXT NOT NULL, -- Breve descrição do ocorrido
    resolution TEXT, -- Caso tenha, uma descrição do que foi feito para resolução

    -- Responsável pelo chamado e prazos
    assigned_to INT NOT NULL, -- FK users (o usuário referenciado deve ter a role de colaborador relacionamento)
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    -- Auditoria
    inserted_by INT NOT NULL, -- FK users
    updated_by INT, -- FK users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    -- FOREIGN KEYS
);