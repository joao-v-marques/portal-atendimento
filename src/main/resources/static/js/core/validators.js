import { onlyDigits } from './format.js';

// Limites espelhados do backend (application.yaml / AllowedFileType): ajuda de UX, a validação real é no servidor
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;
export const MAX_REQUEST_BYTES = 50 * 1024 * 1024;

export const TRANSACTION_NUMBER_LENGTH = 12;
export const BENEFICIARY_NAME_MAX = 255;
const PHONE_MIN_DIGITS = 10; // DDD + número fixo
const PHONE_MAX_DIGITS = 12; // limite da coluna no backend

/**
 * Data de hoje no fuso do navegador, em "AAAA-MM-DD" (formato do input date e do LocalDate).
 */
export function todayIso() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

// Um validador por campo: o mesmo código serve para o blur e para o submit.
// Mensagens iguais às do AuthorizationRequestRequest.
const AUTHORIZATION_FIELD_RULES = {
  transactionNumber(value) {
    if (!value) return 'Preencha o número da transação';
    if (!/^\d+$/.test(value)) return 'O número da transação deve conter apenas números';
    if (value.length !== TRANSACTION_NUMBER_LENGTH) return 'O número da transação deve conter exatamente 12 números';
    return null;
  },
  requestDate(value) {
    if (!value) return 'Preencha a data da requisição/autorização';
    return null;
  },
  authorizationTypeId(value) {
    return value ? null : 'Preencha o tipo da autorização';
  },
  authorizationStatusId(value) {
    return value ? null : 'Preencha o status da autorização';
  },
  beneficiaryName(value) {
    if (!value) return 'Preencha o nome do beneficiário';
    if (value.length > BENEFICIARY_NAME_MAX) return 'A quantidade máxima de caracteres para o nome do beneficiário é 255';
    return null;
  },
  beneficiaryPhone(value) {
    const digits = onlyDigits(value);
    if (!digits) return 'Preencha o número de telefone do beneficiário';
    if (digits.length < PHONE_MIN_DIGITS) return 'Informe o telefone com DDD';
    if (digits.length > PHONE_MAX_DIGITS) return 'Telefone com dígitos demais';
    return null;
  },
};

/**
 * Valida um campo da autorização.
 * @param {string} name nome do campo (= propriedade do DTO)
 * @param {unknown} value
 * @returns {string | null} mensagem de erro ou null
 */
export function validateAuthorizationField(name, value) {
  const rule = AUTHORIZATION_FIELD_RULES[name];
  return rule ? rule(value) : null;
}

/**
 * Valida a autorização inteira.
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>} erros por campo (vazio = válido)
 */
export function validateAuthorizationRequest(values) {
  const errors = {};
  for (const name of Object.keys(AUTHORIZATION_FIELD_RULES)) {
    const message = validateAuthorizationField(name, values[name]);
    if (message) errors[name] = message;
  }
  return errors;
}

// ── Usuários ─────────────────────────────────────────────────

// Limites e mensagens espelhados de UserRequest/UserUpdateRequest/UserPasswordRequest
export const USERNAME_MAX = 255;
export const USER_NAME_MAX = 255;
export const USER_EMAIL_MAX = 255;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 72;

// Tão frouxo quanto o @Email do backend: um regex mais rígido recusaria e-mail que a API aceita
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const USER_FIELD_RULES = {
  username(value) {
    const username = String(value ?? '').trim();
    if (!username) return 'Preencha o campo de usuário';
    if (username.length > USERNAME_MAX) return `O campo de usuário deve ter no máximo ${USERNAME_MAX} caracteres`;
    return null;
  },
  name(value) {
    const name = String(value ?? '').trim();
    if (name.length > USER_NAME_MAX) return `O campo de nome deve ter no máximo ${USER_NAME_MAX} caracteres`;
    return null;
  },
  email(value) {
    const email = String(value ?? '').trim();
    if (!email) return null; // opcional no backend
    if (email.length > USER_EMAIL_MAX) return `O campo de email deve ter no máximo ${USER_EMAIL_MAX} caracteres`;
    if (!EMAIL_PATTERN.test(email)) return 'Informe um email válido';
    return null;
  },
  roleId(value) {
    const roleId = Number(value);
    if (!value) return 'Informe o perfil de acesso do usuário';
    if (!Number.isInteger(roleId) || roleId <= 0) return 'Perfil de acesso inválido';
    return null;
  },
  password(value) {
    const password = String(value ?? '');
    if (!password) return 'Informe a senha';
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return `A senha deve ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres`;
    }
    return null;
  },
  passwordConfirm(value, values) {
    const confirm = String(value ?? '');
    if (!confirm) return 'Repita a senha';
    if (confirm !== String(values?.password ?? '')) return 'As senhas não são iguais';
    return null;
  },
};

/**
 * Valida um campo de usuário.
 * @param {string} name nome do campo (= propriedade do DTO)
 * @param {unknown} value
 * @param {Record<string, unknown>} [values] demais valores, para regras que comparam campos
 * @returns {string | null} mensagem de erro ou null
 */
export function validateUserField(name, value, values) {
  const rule = USER_FIELD_RULES[name];
  return rule ? rule(value, values) : null;
}

/**
 * Valida só as chaves presentes em `values` — o payload muda entre criar e editar
 * (o PUT não aceita senha), então validar campos ausentes daria erro falso.
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>} erros por campo (vazio = válido)
 */
export function validateUser(values) {
  const errors = {};
  for (const name of Object.keys(values)) {
    const message = validateUserField(name, values[name], values);
    if (message) errors[name] = message;
  }
  return errors;
}

// ── Funções (roles) ──────────────────────────────────────────

// Limites e mensagens espelhados de UserRoleRequest/UserRoleUpdateRequest
export const ROLE_CODE_MAX = 50;
export const ROLE_LABEL_MAX = 100;
export const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const ROLE_FIELD_RULES = {
  label(value) {
    const label = String(value ?? '').trim();
    if (!label) return 'Preencha o nome da função';
    if (label.length > ROLE_LABEL_MAX) return `O nome deve ter no máximo ${ROLE_LABEL_MAX} caracteres`;
    return null;
  },
  name(value) {
    const code = String(value ?? '').trim();
    if (!code) return 'Preencha o código da função';
    if (code.length > ROLE_CODE_MAX) return `O código deve ter no máximo ${ROLE_CODE_MAX} caracteres`;
    if (!ROLE_CODE_PATTERN.test(code)) return 'Use só letras maiúsculas, números e _, começando por letra';
    return null;
  },
};

/**
 * @param {string} name nome do campo (= propriedade do DTO)
 * @param {unknown} value
 * @returns {string | null} mensagem de erro ou null
 */
export function validateRoleField(name, value) {
  const rule = ROLE_FIELD_RULES[name];
  return rule ? rule(value) : null;
}

/**
 * Como validateUser: só as chaves presentes (o PUT não leva o código).
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>}
 */
export function validateRole(values) {
  const errors = {};
  for (const name of Object.keys(values)) {
    const message = validateRoleField(name, values[name]);
    if (message) errors[name] = message;
  }
  return errors;
}

// ── Atendimentos ─────────────────────────────────────────────

// Limites e mensagens espelhados de ServiceRequestRequest/ServiceRequestFinishRequest
export const PROTOCOL_NUMBER_MAX = 20;
export const CARD_NUMBER_MAX = 17;
export const REQUESTER_NAME_MAX = 150;
export const REQUESTER_PHONE_MAX = 20;
export const REQUESTER_EMAIL_MAX = 150;

function requiredId(message, invalidMessage) {
  return (value) => {
    if (!value) return message;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return invalidMessage;
    return null;
  };
}

const SERVICE_REQUEST_FIELD_RULES = {
  protocolNumber(value) {
    const protocol = String(value ?? '').trim();
    if (!protocol) return 'Preencha o número do protocolo';
    if (protocol.length > PROTOCOL_NUMBER_MAX) return `O número do protocolo deve ter no máximo ${PROTOCOL_NUMBER_MAX} caracteres`;
    return null;
  },
  categoryId: requiredId('Preencha a categoria do atendimento', 'Categoria do atendimento inválida'),
  channelId: requiredId('Preencha o canal do atendimento', 'Canal do atendimento inválido'),
  typeId: requiredId('Preencha o tipo do atendimento', 'Tipo do atendimento inválido'),
  statusId: requiredId('Preencha o status do atendimento', 'Status do atendimento inválido'),
  assignedToId: requiredId('Preencha o responsável pelo atendimento', 'Responsável pelo atendimento inválido'),
  severityId(value) {
    if (!value) return null; // opcional
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? null : 'Severidade inválida';
  },
  requesterCardNumber(value) {
    const card = String(value ?? '').trim();
    if (!card) return 'Preencha o número da carteirinha do solicitante';
    if (!/^\d+$/.test(card)) return 'O número da carteirinha deve conter apenas números';
    if (card.length > CARD_NUMBER_MAX) return `O número da carteirinha deve ter no máximo ${CARD_NUMBER_MAX} dígitos`;
    return null;
  },
  requesterName(value) {
    const name = String(value ?? '').trim();
    if (!name) return 'Preencha o nome do solicitante';
    if (name.length > REQUESTER_NAME_MAX) return `O nome do solicitante deve ter no máximo ${REQUESTER_NAME_MAX} caracteres`;
    return null;
  },
  requesterCpf(value) {
    const cpf = String(value ?? '').trim();
    if (!cpf) return null; // opcional
    return /^\d{11}$/.test(cpf) ? null : 'O CPF deve conter exatamente 11 números';
  },
  requesterBirthDate(value) {
    if (!value) return null; // opcional
    return value < todayIso() ? null : 'A data de nascimento deve ser uma data passada';
  },
  requesterPhone(value) {
    const phone = String(value ?? '').trim();
    if (phone.length > REQUESTER_PHONE_MAX) return `O telefone do solicitante deve ter no máximo ${REQUESTER_PHONE_MAX} caracteres`;
    return null;
  },
  requesterEmail(value) {
    const email = String(value ?? '').trim();
    if (!email) return null; // opcional
    if (email.length > REQUESTER_EMAIL_MAX) return `O e-mail do solicitante deve ter no máximo ${REQUESTER_EMAIL_MAX} caracteres`;
    if (!EMAIL_PATTERN.test(email)) return 'Informe um e-mail válido';
    return null;
  },
  description(value) {
    return String(value ?? '').trim() ? null : 'Preencha a descrição do atendimento';
  },
  // Valor do input datetime-local ("AAAA-MM-DDTHH:mm"), no fuso do navegador
  openedAt(value) {
    if (!value) return null; // vazio mantém a data atual no backend
    return new Date(value) <= new Date() ? null : 'A data de abertura não pode ser futura';
  },
  resolution(value) {
    return String(value ?? '').trim() ? null : 'Preencha a resolução do atendimento';
  },
};

/**
 * Valida um campo do atendimento.
 * @param {string} name nome do campo (= propriedade do DTO)
 * @param {unknown} value
 * @returns {string | null} mensagem de erro ou null
 */
export function validateServiceRequestField(name, value) {
  const rule = SERVICE_REQUEST_FIELD_RULES[name];
  return rule ? rule(value) : null;
}

/**
 * Valida só as chaves presentes em `values`: a edição e a finalização mandam campos diferentes.
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>} erros por campo (vazio = válido)
 */
export function validateServiceRequest(values) {
  const errors = {};
  for (const name of Object.keys(values)) {
    const message = validateServiceRequestField(name, values[name]);
    if (message) errors[name] = message;
  }
  return errors;
}
