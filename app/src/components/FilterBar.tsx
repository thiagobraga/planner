import { useState, useCallback, useRef, useEffect } from 'react';

// Simple syntax highlighting token types
type TokenType = 'keyword' | 'operator' | 'string' | 'error' | 'text';

interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = ['today', 'overdue', 'no date', 'p1', 'p2', 'p3', 'p4', 'assigned to: me'];
const COLLECTION_RE = /^#\S+/;
const LABEL_RE = /^@\S+/;
const DATE_FILTER_RE = /^due\s*(?:before|after)?:\s*\d{4}-\d{2}-\d{2}/;
const LOGIC_OPS = ['&', '|', '!'];
const PARENS = ['(', ')'];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    if (s[i] === ' ') {
      tokens.push({ text: ' ', type: 'text' });
      i++;
      continue;
    }

    if (LOGIC_OPS.includes(s[i]) || PARENS.includes(s[i])) {
      tokens.push({ text: s[i], type: 'operator' });
      i++;
      continue;
    }

    // Quoted string
    if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      tokens.push({ text: s.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    // Collection
    const projMatch = s.slice(i).match(COLLECTION_RE);
    if (projMatch) {
      tokens.push({ text: projMatch[0], type: 'keyword' });
      i += projMatch[0].length;
      continue;
    }

    // Label
    const labelMatch = s.slice(i).match(LABEL_RE);
    if (labelMatch) {
      tokens.push({ text: labelMatch[0], type: 'keyword' });
      i += labelMatch[0].length;
      continue;
    }

    // Due date filter
    const dateMatch = s.slice(i).match(DATE_FILTER_RE);
    if (dateMatch) {
      tokens.push({ text: dateMatch[0], type: 'keyword' });
      i += dateMatch[0].length;
      continue;
    }

    // Keywords (longest match first)
    let matched = false;
    for (const kw of [...KEYWORDS].sort((a, b) => b.length - a.length)) {
      if (s.slice(i).toLowerCase().startsWith(kw)) {
        tokens.push({ text: s.slice(i, i + kw.length), type: 'keyword' });
        i += kw.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Unknown word - collect until space or operator
    let j = i;
    while (j < s.length && !LOGIC_OPS.includes(s[j]) && !PARENS.includes(s[j]) && s[j] !== ' ') {
      j++;
    }
    tokens.push({ text: s.slice(i, j), type: 'error' });
    i = j;
  }

  return tokens;
}

function validateFilter(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check balanced parens
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) return 'Unmatched closing parenthesis';
  }
  if (depth > 0) return 'Unclosed parenthesis';

  // Check for empty groups like ()
  if (/\(\s*\)/.test(trimmed)) return 'Empty group ()';

  // Check consecutive ops
  if (/[&|]{2,}/.test(trimmed)) return 'Consecutive operators';

  return null;
}

// Syntax-highlight colors for query tokens. These are one-off tokenizer colors,
// not part of the design-system palette, so they are expressed as Tailwind
// arbitrary-value classes rather than theme tokens.
const tokenClassNames: Record<TokenType, string> = {
  keyword: 'text-accent',
  operator: 'text-[#8b7355]',
  string: 'text-[#2e7d32]',
  error: 'text-[#b71c1c]',
  text: 'text-ink',
};

interface FilterBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onApply?: (value: string) => void;
}

export function FilterBar({ value: externalValue, onChange, onApply }: FilterBarProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? '');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = externalValue ?? internalValue;
  const tokens = tokenize(value);
  const error = validateFilter(value);

  useEffect(() => {
    if (externalValue !== undefined) setInternalValue(externalValue);
  }, [externalValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setInternalValue(v);
      onChange?.(v);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !error && value.trim()) {
      onApply?.(value.trim());
    }
  };

  const handleClear = () => {
    setInternalValue('');
    onChange?.('');
    onApply?.('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex flex-col gap-1">
      <div
        className={`flex items-center gap-2 py-1.5 px-3 border rounded bg-cream transition-[border-color] duration-[120ms] ${error ? 'border-accent' : isFocused ? 'border-ink' : 'border-dot'}`}
      >
        {/* Filter icon */}
        <span className="text-xs text-ink-light shrink-0">⊟</span>

        {/* Syntax-highlighted overlay */}
        <div
          aria-hidden="true"
          className={`absolute left-9 top-[7px] text-[13px] leading-[22px] pointer-events-none whitespace-pre ${isFocused || value ? 'flex' : 'hidden'}`}
        >
          {tokens.map((tok, i) => (
            <span key={i} className={tokenClassNames[tok.type]}>
              {tok.text}
            </span>
          ))}
        </div>

        {/* Actual invisible input (for typing) */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Filter: #collection @label p1 today overdue…"
          aria-label="Filter tasks"
          aria-invalid={!!error}
          aria-describedby={error ? 'filter-error' : undefined}
          className={`flex-1 text-[13px] leading-[22px] border-0 outline-none bg-transparent p-0 caret-ink ${isFocused && value ? 'text-transparent' : 'text-ink'}`}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear filter"
            className="bg-transparent border-0 text-ink-light cursor-pointer text-sm leading-none px-0.5 shrink-0"
          >
            ×
          </button>
        )}
      </div>

      {/* Validation error */}
      {error && (
        <div
          id="filter-error"
          role="alert"
          className="text-[11px] text-accent pl-3 leading-4"
        >
          {error}
        </div>
      )}
    </div>
  );
}
