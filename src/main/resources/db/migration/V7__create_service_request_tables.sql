-- Nova função de usuário para colaborador do relacionamento
INSERT INTO user_roles (name)
VALUES ('EMPLOYEE_RELATIONSHIP');

CREATE TABLE service_request_categories (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO service_request_categories (name)
VALUES
    ('CANCELAMENTO ODONTO PJ/PJ'),
    ('CANCELAMENTO PF/PJ'),
    ('CONSULTA'),
    ('CONSULTAS RN 259'),
    ('CÓPIA DE CONTRATO'),
    ('DEMANDA ASSISTENCIAL'),
    ('DEMANDAS DE COOPERADO'),
    ('DUVIDA'),
    ('ELOGIO'),
    ('EXAMES RN 259'),
    ('NEGATIVA'),
    ('NOTIFICAÇÃO E INADIMPLÊNCIA'),
    ('OUTROS'),
    ('REANÁLISE'),
    ('RECLAMAÇÃO'),
    ('RETENÇÃO DE BENEFICIÁRIO'),
    ('SOLICITAÇÃO DE INDICES DE PARTOS NORMAIS E CESARIANA'),
    ('VAGA DE TERAPIAS');

CREATE TABLE service_request_channels (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO service_request_channels (name)
VALUES
    ('Atendimento Presencial'),
    ('BLIP'),
    ('SAW'),
    ('Digisac'),
    ('OUTROS');

CREATE TABLE service_request_types (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO service_request_types (name)
VALUES
    ('Solicitação'),
    ('Informação'),
    ('Dúvida'),
    ('Reclamação'),
    ('Cancelamento'),
    ('Fechamento'),
    ('Elogio'),
    ('Ouvidoria'),
    ('Viabilização'),
    ('Denúncia'),
    ('Sugestão');

CREATE TABLE service_request_severities (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    level SMALLINT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_service_request_severity_level CHECK ( level > 0 )
);

INSERT INTO service_request_severities (name, level)
VALUES
    ('Sem Severidade', 1),
    ('Baixa', 2),
    ('Moderada', 3),
    ('Alta', 4),
    ('Crítica', 5);

CREATE TABLE service_request_status (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO service_request_status (name)
VALUES
    ('Em andamento'),
    ('Finalizado');

CREATE TABLE service_requests (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Informações do chamado
    protocol_number VARCHAR(20) NOT NULL UNIQUE,
    category_id INT NOT NULL, -- FK service_request_categories
    channel_id INT NOT NULL, -- FK service_request_channels
    type_id INT NOT NULL, -- FK service_request_types
    severity_id INT, -- FK service_request_severities
    status_id INT NOT NULL, -- FK service_request_status

    -- Informações do solicitante
    requester_card_number VARCHAR(17) NOT NULL,
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
    CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES service_request_categories(id),
    CONSTRAINT fk_service_channel FOREIGN KEY (channel_id) REFERENCES service_request_channels(id),
    CONSTRAINT fk_service_type FOREIGN KEY (type_id) REFERENCES service_request_types(id),
    CONSTRAINT fk_service_severity FOREIGN KEY (severity_id) REFERENCES service_request_severities(id),
    CONSTRAINT fk_service_status FOREIGN KEY (status_id) REFERENCES service_request_status(id),
    CONSTRAINT fk_service_assigned FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT fk_service_inserted_by FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_service_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Indexes das foreign keys
CREATE INDEX idx_service_requests_category_id ON service_requests(category_id);
CREATE INDEX idx_service_requests_channel_id ON service_requests(channel_id);
CREATE INDEX idx_service_requests_type_id ON service_requests(type_id);
CREATE INDEX idx_service_requests_severity_id ON service_requests(severity_id);
CREATE INDEX idx_service_requests_status_id ON service_requests(status_id);
CREATE INDEX idx_service_requests_assigned_to ON service_requests(assigned_to);
CREATE INDEX idx_service_requests_inserted_by ON service_requests(inserted_by);

-- Índices de busca
CREATE INDEX idx_service_requests_requester_cpf ON service_requests(requester_cpf);
CREATE INDEX idx_service_requests_opened_at ON service_requests(opened_at);
