CREATE TABLE user_roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    username VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),

    role_id INT NOT NULL, -- FK user_roles
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Foreign keys
    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES user_roles(id)
);

CREATE TABLE authorization_type (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE authorization_status (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE authorization_requests (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Dados do pedido para autorização
    transaction_number VARCHAR(12) NOT NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    authorization_type_id INT NOT NULL, -- FK authorization_type
    authorization_status_id INT NOT NULL, -- FK authorization_status

    -- Dados do beneficiário
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_phone VARCHAR(12) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inserted_by INT NOT NULL, -- FK users

    -- Foreign keys
    CONSTRAINT fk_authorization_inserted_by FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_authorization_type FOREIGN KEY (authorization_type_id) REFERENCES authorization_type(id),
    CONSTRAINT fk_authorization_status FOREIGN KEY (authorization_status_id) REFERENCES authorization_status(id)
);

-- Indexes for foreign keys (Postgres does not create these automatically)
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_authorization_requests_type_id ON authorization_requests(authorization_type_id);
CREATE INDEX idx_authorization_requests_status_id ON authorization_requests(authorization_status_id);
CREATE INDEX idx_authorization_requests_inserted_by ON authorization_requests(inserted_by);
