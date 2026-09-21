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
    if (value < todayIso()) return 'A data da requisição/autorização não pode ser retroativa';
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
