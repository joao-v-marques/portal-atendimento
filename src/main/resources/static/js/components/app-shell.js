import { getCurrentUser, logout } from '../core/auth.js';
import { handleError } from '../core/errors.js';
import { getInitials, roleLabel } from '../core/format.js';
import { getTheme, toggleTheme } from '../core/theme.js';
import { initDropdownMenu } from './dropdown-menu.js';
import { initOwnPasswordDialog } from './own-password-dialog.js';

// Mesmo valor do breakpoint md em layout.css (custom properties não funcionam em media query)
const DESKTOP_QUERY = '(min-width: 60em)';

/**
 * Nome para exibir: `name` quando existir, senão o `username`.
 * @param {{ name?: string | null, username?: string } | null | undefined} user
 */
export function displayName(user) {
  return user?.name?.trim() || user?.username || '';
}

// ── Usuário na topbar ────────────────────────────────────────

// Itens só de administrador: escondidos no HTML e revelados aqui (guia 11.6).
// É UX, não segurança: a proteção real é o hasRole("ADMIN") do backend.
function revealAdminItems(user) {
  if (user.role !== 'ADMIN') return;
  document.querySelectorAll('.js-admin-only').forEach((node) => { node.hidden = false; });
}

// Controle de atendimentos: mesma ideia, liberado também para o colaborador do relacionamento
const SERVICE_REQUEST_ROLES = ['ADMIN', 'EMPLOYEE_RELATIONSHIP'];

function revealServiceRequestItems(user) {
  if (!SERVICE_REQUEST_ROLES.includes(user.role)) return;
  document.querySelectorAll('.js-service-request-only').forEach((node) => { node.hidden = false; });
}

function renderUser(chip, user) {
  const name = displayName(user);
  chip.querySelector('.js-user-avatar').textContent = getInitials(name);
  chip.querySelector('.js-user-name').textContent = name;
  chip.querySelector('.js-user-role').textContent = roleLabel(user.role);
  chip.removeAttribute('aria-busy');
  revealAdminItems(user);
  revealServiceRequestItems(user);
}

function renderUserUnavailable(chip) {
  chip.querySelector('.js-user-avatar').textContent = '?';
  chip.querySelector('.js-user-name').textContent = 'Usuário';
  chip.querySelector('.js-user-role').textContent = '';
  chip.removeAttribute('aria-busy');
}

// ── Sair ─────────────────────────────────────────────────────

function setLogoutBusy(button, isBusy) {
  button.disabled = isBusy;
  button.querySelector('.js-logout-label').textContent = isBusy ? 'Saindo…' : 'Sair';
}

function initLogout(button, userMenu) {
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    // O item tem data-keep-open: o menu fica aberto mostrando "Saindo…" até a navegação
    setLogoutBusy(button, true);
    try {
      await logout(); // navega para o login
    } catch (error) {
      setLogoutBusy(button, false);
      userMenu.close();
      handleError(error);
    }
  });
}

// ── Tema ─────────────────────────────────────────────────────

function initThemeToggle(button) {
  const sync = () => button.setAttribute('aria-checked', String(getTheme() === 'dark'));
  button.addEventListener('click', () => {
    toggleTheme();
    sync();
  });
  sync();
}

// ── Gaveta do menu (mobile) ──────────────────────────────────

function initDrawer({ openButton, closeButton, sidebar, backdrop, inertTargets }) {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  let isOpen = false;

  function open() {
    if (isOpen || desktop.matches) return;
    isOpen = true;
    sidebar.classList.add('is-open');
    openButton.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    // inert tira topbar e conteúdo do Tab e do leitor de tela: o foco fica preso na gaveta
    inertTargets.forEach((element) => { element.inert = true; });
    document.documentElement.classList.add('has-drawer-open');
    sidebar.querySelector('.c-nav__link')?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    sidebar.classList.remove('is-open');
    openButton.setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
    inertTargets.forEach((element) => { element.inert = false; });
    document.documentElement.classList.remove('has-drawer-open');
    if (restoreFocus) openButton.focus();
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) close();
  });

  // Clicou num item: a página vai navegar, não precisa devolver o foco
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) close({ restoreFocus: false });
  });

  // Passou para desktop com a gaveta aberta: a sidebar vira fixa
  desktop.addEventListener('change', (event) => {
    if (event.matches) close({ restoreFocus: false });
  });
}

// ── Sidebar retrátil (desktop) ───────────────────────────────

// Mesma chave do script inline no <head> dos templates
const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';

function initSidebarCollapse({ button, sidebar }) {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const root = document.documentElement;
  const links = sidebar.querySelectorAll('.c-nav__link');

  // Rótulo e estado do ☰ e tooltips dos itens conforme a tela e o estado atual
  function sync() {
    const isDesktop = desktop.matches;
    const isCollapsed = isDesktop && root.classList.contains('has-sidebar-collapsed');
    const label = !isDesktop ? 'Abrir menu' : (isCollapsed ? 'Expandir menu' : 'Recolher menu');
    button.setAttribute('aria-label', label);
    button.title = label;
    // No mobile o aria-expanded descreve a gaveta, que fecha ao trocar de tela
    button.setAttribute('aria-expanded', String(isDesktop && !isCollapsed));
    // Trilho só com ícones: o nome do item aparece no tooltip
    links.forEach((link) => {
      if (isCollapsed) link.title = link.textContent.trim();
      else link.removeAttribute('title');
    });
  }

  button.addEventListener('click', () => {
    if (!desktop.matches) return; // no mobile o clique abre a gaveta (initDrawer)
    const isCollapsed = root.classList.toggle('has-sidebar-collapsed');
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Armazenamento bloqueado: funciona, só não lembra na próxima página
    }
    sync();
  });

  desktop.addEventListener('change', sync);
  sync();
}

// ── Itens expansíveis da sidebar ─────────────────────────────

// O estado inicial vem do HTML (aberto na página que está dentro do item); aqui só alterna
function initNavToggles(sidebar) {
  sidebar.querySelectorAll('.js-nav-toggle').forEach((button) => {
    const list = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!isOpen));
      list.hidden = isOpen;
    });
  });
}

// ── Inicialização ────────────────────────────────────────────

/**
 * Liga o comportamento do shell autenticado (topbar, menu do usuário, sidebar e sair).
 * Chame uma vez no entry point de cada página autenticada.
 * @returns {Promise<{ name: string | null, username: string, role: string }>} usuário logado
 */
export function initAppShell() {
  const topbar = document.querySelector('.js-topbar');
  const main = document.querySelector('.js-main');
  const chip = document.querySelector('.js-user-chip');

  initDrawer({
    openButton: document.querySelector('.js-menu-open'),
    closeButton: document.querySelector('.js-menu-close'),
    sidebar: document.querySelector('.js-sidebar'),
    backdrop: document.querySelector('.js-menu-backdrop'),
    inertTargets: [topbar, main],
  });

  // Depois do initDrawer: ao virar desktop, o close() da gaveta roda antes e o sync() acerta o aria-expanded
  initSidebarCollapse({
    button: document.querySelector('.js-menu-open'),
    sidebar: document.querySelector('.js-sidebar'),
  });

  initNavToggles(document.querySelector('.js-sidebar'));

  const userMenu = initDropdownMenu(document.querySelector('.js-user-menu'));
  initLogout(document.querySelector('.js-logout'), userMenu);
  initThemeToggle(document.querySelector('.js-theme-toggle'));

  // data-keep-open: o menu é fechado aqui sem devolver o foco (senão o gatilho roubaria o
  // foco do diálogo recém-aberto); ao fechar o diálogo, o foco volta ao gatilho do menu
  const ownPasswordDialog = initOwnPasswordDialog(document.querySelector('.js-own-password-dialog'));
  const userMenuTrigger = document.querySelector('.js-user-menu .js-dropdown-trigger');
  document.querySelector('.js-own-password-open').addEventListener('click', () => {
    userMenu.close({ restoreFocus: false });
    ownPasswordDialog.open(userMenuTrigger);
  });

  const userPromise = getCurrentUser();
  userPromise
    .then((user) => renderUser(chip, user))
    .catch((error) => {
      renderUserUnavailable(chip);
      handleError(error); // 401 → login?erro=sessao-expirada
    });

  return userPromise;
}
