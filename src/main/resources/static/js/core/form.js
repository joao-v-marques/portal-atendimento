/**
 * Remove todos os erros de campo do formulário.
 * @param {HTMLFormElement} form
 */
export function clearFieldErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  form.querySelectorAll('.c-field__error').forEach((el) => {
    el.textContent = '';
    el.hidden = true;
  });
}

/**
 * Marca o campo como inválido e mostra a mensagem em `#<id>-error`.
 * @param {HTMLElement} field
 * @param {string} message
 */
export function setFieldError(field, message) {
  field.setAttribute('aria-invalid', 'true');
  const errorEl = document.getElementById(`${field.id}-error`);
  if (errorEl) {
    errorEl.textContent = message; // textContent: nunca innerHTML
    errorEl.hidden = false;
  }
}

/**
 * @param {HTMLElement} field
 */
export function clearFieldError(field) {
  field.removeAttribute('aria-invalid');
  const errorEl = document.getElementById(`${field.id}-error`);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}

/**
 * Aplica um mapa { name: mensagem } e foca o primeiro campo inválido.
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} fields
 */
export function showFieldErrors(form, fields) {
  let first = null;
  for (const [name, message] of Object.entries(fields)) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) continue;
    setFieldError(field, message);
    first ??= field;
  }
  first?.focus();
}

/**
 * Liga/desliga o estado de envio (bloqueia envio duplo e mostra spinner).
 * @param {HTMLFormElement} form
 * @param {boolean} isSubmitting
 */
export function setSubmitting(form, isSubmitting) {
  const submit = form.querySelector('[type="submit"]');
  form.toggleAttribute('aria-busy', isSubmitting);
  if (!submit) return;
  submit.disabled = isSubmitting;
  submit.classList.toggle('is-loading', isSubmitting);
}
