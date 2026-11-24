export const viewEnglish = {
  'view.options': 'Display',
  'view.alignTaskItemsRight': 'Align items right',
} as const;

export const viewPortuguese = {
  'view.options': 'Exibição',
  'view.alignTaskItemsRight': 'Alinhar itens à direita',
} satisfies Record<keyof typeof viewEnglish, string>;
