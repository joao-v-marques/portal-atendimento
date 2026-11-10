ALTER TABLE authorization_type
    ADD COLUMN code VARCHAR(8) NOT NULL UNIQUE DEFAULT '00000000',
    ADD COLUMN max_days INT NOT NULL DEFAULT 10,
    ADD CONSTRAINT ck_authorization_type_code CHECK (code ~ '^[0-9]{8}$'),
    ADD CONSTRAINT ck_authorization_type_max_days CHECK (max_days > 0);

ALTER TABLE authorization_type ALTER COLUMN code DROP DEFAULT;