import { THEME_PALETTES } from '../../utils/themePalettes';
import './ThemePalettes.css';

export function ThemePalettes() {
  return (
    <div className="theme-palettes">
      <p className="text-sm text-ink-light leading-6">
        Each palette runs from 50 (lightest) to 950 (darkest). Semantic tokens
        choose shades for the theme. These previews leave your saved theme unchanged.
      </p>
      {THEME_PALETTES.map(theme => (
        <section
          key={theme.id}
          aria-label={`${theme.name} palette`}
          data-palette-theme={theme.id}
          className="theme-palette"
          style={{
            backgroundColor: theme.semantics['--planner-page-bg'],
            color: theme.semantics['--color-ink'],
            borderColor: theme.semantics['--color-border'],
          }}
        >
          <h3 className="text-lg font-semibold leading-6">{theme.name}</h3>
          {theme.families.map(family => (
            <div key={family.id} className="theme-palette-family">
              <h4 className="font-semibold leading-6">{family.name}</h4>
              <ul aria-label={`${family.name} shades`} className="theme-palette-shades">
                {family.shades.map(shade => (
                  <li key={shade.shade}>
                    <span
                      aria-hidden="true"
                      className="theme-palette-swatch"
                      style={{ backgroundColor: shade.value, borderColor: theme.semantics['--color-border'] }}
                    />
                    <span className="block leading-6">{shade.shade}</span>
                    <span className="block text-xs leading-6">{shade.value}</span>
                  </li>
                ))}
              </ul>
              <dl className="theme-palette-usage">
                {family.shades.flatMap(shade => shade.usage.map(token => (
                  <div key={token}>
                    <dt>{token}</dt>
                    <dd>{family.id}-{shade.shade}</dd>
                  </div>
                )))}
              </dl>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
