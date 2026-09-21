/**
 * "Mostrar senha" + aviso de Caps Lock, o mesmo comportamento da tela de login.
 * @param {HTMLInputElement} field
 * @param {HTMLButtonElement} toggleButton
 * @param {HTMLElement} [capsLockHint] região aria-live que recebe o aviso
 */
export function initPasswordField(field, toggleButton, capsLockHint) {
  function setVisible(isVisible) {
    field.type = isVisible ? 'text' : 'password';
    toggleButton.setAttribute('aria-pressed', String(isVisible));
    const label = isVisible ? 'Ocultar senha' : 'Mostrar senha';
    toggleButton.setAttribute('aria-label', label);
    toggleButton.title = label;
  }

  function updateCapsLockHint(isOn) {
    if (!capsLockHint) return;
    const text = isOn ? 'Caps Lock está ligado.' : '';
    // Só escreve quando muda, para o leitor de tela não repetir o aviso a cada tecla
    if (capsLockHint.textContent !== text) capsLockHint.textContent = text;
  }

  function handleCapsLockKey(event) {
    if (typeof event.getModifierState !== 'function') return;
    updateCapsLockHint(event.getModifierState('CapsLock'));
  }

  toggleButton.addEventListener('click', () => {
    setVisible(toggleButton.getAttribute('aria-pressed') !== 'true');
    field.focus();
  });

  field.addEventListener('keydown', handleCapsLockKey);
  field.addEventListener('keyup', handleCapsLockKey);
  field.addEventListener('blur', () => updateCapsLockHint(false));

  return {
    /** Volta ao estado oculto ao reabrir o diálogo */
    reset() {
      setVisible(false);
      updateCapsLockHint(false);
    },
  };
}
