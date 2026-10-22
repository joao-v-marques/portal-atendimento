/**
 * Cadastros auxiliares dos atendimentos configurados em /configurar-atendimentos.
 * Todos seguem o mesmo CRUD (GET, POST, PUT /{id}, PATCH /{id}/deactivate|reactivate);
 * a severidade tem também o nível.
 *
 * - section: valor de ?secao= e data-section do painel
 * - singular: usado nas mensagens ("categoria Reclamação desativada")
 * - feminine: concordância ("desativada" / "desativado")
 * - systemIds: registros que sustentam o fluxo e não podem ser desativados (o backend também recusa)
 */
export const LOOKUPS = [
  {
    section: 'categorias',
    endpoint: 'api/service-request-categories',
    singular: 'categoria',
    newLabel: 'Nova categoria',
    feminine: true,
    hasLevel: false,
    systemIds: [],
  },
  {
    section: 'canais',
    endpoint: 'api/service-request-channels',
    singular: 'canal',
    newLabel: 'Novo canal',
    feminine: false,
    hasLevel: false,
    systemIds: [],
  },
  {
    section: 'tipos',
    endpoint: 'api/service-request-types',
    singular: 'tipo',
    newLabel: 'Novo tipo',
    feminine: false,
    hasLevel: false,
    systemIds: [],
  },
  {
    section: 'severidades',
    endpoint: 'api/service-request-severities',
    singular: 'severidade',
    newLabel: 'Nova severidade',
    feminine: true,
    hasLevel: true,
    systemIds: [],
  },
  {
    section: 'status',
    endpoint: 'api/service-request-status',
    singular: 'status',
    newLabel: 'Novo status',
    feminine: false,
    hasLevel: false,
    // Em andamento e Finalizado (seed da V7): igual ao SYSTEM_STATUS_IDS do ServiceRequestStatusService
    systemIds: [1, 2],
  },
];

export const DEFAULT_LOOKUP_SECTION = LOOKUPS[0].section;

/** @param {string} section */
export function lookupBySection(section) {
  return LOOKUPS.find((lookup) => lookup.section === section) ?? LOOKUPS[0];
}

/** "desativada" / "desativado" conforme o gênero do cadastro */
export function agree(lookup, masculine) {
  return lookup.feminine ? masculine.replace(/o$/, 'a') : masculine;
}

export function isSystemItem(lookup, item) {
  return lookup.systemIds.includes(item.id);
}
