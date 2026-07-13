import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# 1. Add alwaysOpen to CustomSelectProps
content = content.replace(
    '  id?: string;',
    '  id?: string;\n  alwaysOpen?: boolean;'
)

# 2. Add alwaysOpen to destructured props
content = content.replace(
    '  className = \'\',\n  id,\n}: CustomSelectProps) {',
    '  className = \'\',\n  id,\n  alwaysOpen = false,\n}: CustomSelectProps) {'
)

# 3. Use alwaysOpen for isOpen state
content = content.replace(
    'const [isOpen, setIsOpen] = useState(false);',
    'const [isOpen, setIsOpen] = useState(alwaysOpen);'
)

# 4. Modify mousedown listener
mousedown_handler = """    function handleMouseDown(e: MouseEvent) {
      if (alwaysOpen) return;
      if (
        floatingRef.current &&"""
content = content.replace('    function handleMouseDown(e: MouseEvent) {\n      if (\n        floatingRef.current &&', mousedown_handler)

# 5. Modify toggleOpen
toggleOpen_handler = """  const toggleOpen = () => {
    if (disabled || alwaysOpen) return;
    setIsOpen(!isOpen);
  };"""
content = re.sub(r'  const toggleOpen = \(\) => \{\n    if \(disabled\) return;\n    setIsOpen\(!isOpen\);\n  \};', toggleOpen_handler, content)

# 6. Modify handleSelect
handleSelect_handler = """  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange?.(option.value);
    if (!alwaysOpen) {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };"""
content = re.sub(r'  const handleSelect = \(option: SelectOption\) => \{\n    if \(option.disabled\) return;\n    onChange\?.\(option.value\);\n    setIsOpen\(false\);\n    triggerRef.current\?.focus\(\);\n  \};', handleSelect_handler, content)

# 7. Modify handleKeyDown (Escape)
content = content.replace(
    '        setIsOpen(false);',
    '        if (!alwaysOpen) setIsOpen(false);'
)

# 8. Render inline if alwaysOpen
render_logic_original = """      {isOpen &&
        createPortal(
          <div
            ref={floatingRef}
            className="fixed z-50 py-1 bg-cream border border-border rounded-md shadow-medium"
            style={{
              top,
              left,
              width: triggerRef.current?.offsetWidth || 200,
            }}
          >
            <ul"""

render_logic_new = """      {isOpen && (alwaysOpen ? (
        <div className="absolute z-10 py-1 bg-cream border border-border rounded-md shadow-medium left-0 right-0 top-full mt-1">
          <ul"""
content = content.replace(render_logic_original, render_logic_new)

render_logic_end_original = """                );
              })}
            </ul>
          </div>,
          document.body
        )}"""
render_logic_end_new = """                );
              })}
            </ul>
        </div>
      ) : (
        createPortal(
          <div
            ref={floatingRef}
            className="fixed z-50 py-1 bg-cream border border-border rounded-md shadow-medium"
            style={{
              top,
              left,
              width: triggerRef.current?.offsetWidth || 200,
            }}
          >
            <ul
              id={`${id}-listbox`}
              role="listbox"
              ref={listboxRef}
              className="max-h-[240px] overflow-y-auto"
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                let itemClass = `flex items-center h-8 px-3 text-[14px] font-journal cursor-pointer select-none `;
                if (option.disabled) {
                  itemClass += `opacity-40 cursor-not-allowed text-ink-light `;
                } else if (isSelected) {
                  itemClass += `bg-[#d4cfc7]/60 text-ink `;
                } else if (isHighlighted) {
                  itemClass += `bg-[#d4cfc7]/40 text-ink `;
                } else {
                  itemClass += `text-ink hover:bg-[#d4cfc7]/40 `;
                }

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    className={itemClass}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                  >
                    {option.label}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      ))}"""
content = content.replace(render_logic_end_original, render_logic_end_new)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Select patched.")
