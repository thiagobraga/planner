import palettesCss from '../styles/palettes.css?raw';
import themeCss from '../styles/theme.css?raw';
import type { PaletteFamilyId, PaletteShade, PaletteThemeId, ThemePalette } from '../types/theme';

export const SHADE_STEPS: PaletteShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const THEMES: [PaletteThemeId, string][] = [
  ['white', 'White'], ['beige', 'Beige'], ['dark', 'Dark'],
  ['nord-light', 'Nord Light'], ['nord-dark', 'Nord Dark'],
];
const FAMILIES: [PaletteFamilyId, string][] = [
  ['neutral', 'Neutral'], ['accent', 'Accent'], ['danger', 'Danger'],
  ['warning', 'Warning'], ['info', 'Info'], ['success', 'Success'],
];

function declarations(css: string, theme: PaletteThemeId) {
  const values: Record<string, string> = {};
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '').split(',').map(selector => selector.trim());
    if (!selectors.includes(':root') && !selectors.includes('@theme') && !selectors.includes(`:root[data-theme="${theme}"]`)) continue;
    for (const declaration of block[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) values[declaration[1]] = declaration[2].trim();
  }
  return values;
}

export const THEME_PALETTES: ThemePalette[] = THEMES.map(([id, name]) => {
  const palette = declarations(palettesCss, id);
  const mappings = declarations(themeCss, id);
  const semantics = Object.fromEntries(Object.entries(mappings).flatMap(([token, value]) => {
    const reference = /^var\((--palette-[\w-]+)\)$/.exec(value);
    if (!reference) return [];
    if (!palette[reference[1]]) throw new Error(`Missing palette shade ${reference[1]} for ${id}`);
    return [[token, palette[reference[1]]]];
  }));
  return {
    id, name, semantics,
    families: FAMILIES.map(([familyId, familyName]) => ({
      id: familyId, name: familyName,
      shades: SHADE_STEPS.map(shade => {
        const token = `--palette-${familyId}-${shade}`;
        if (!palette[token]) throw new Error(`Missing palette shade ${token} for ${id}`);
        return { shade, token, value: palette[token], usage: Object.keys(mappings).filter(key => mappings[key].includes(`var(${token})`)) };
      }),
    })),
  };
});
