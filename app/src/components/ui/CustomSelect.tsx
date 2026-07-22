import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  className?: string;
  id?: string;
  alwaysOpen?: boolean;
}

export function CustomSelect({
  label,
  placeholder = 'Select an option...',
  options,
  value,
  onChange,
  disabled = false,
  error = false,
  errorText,
  className = '',
  id,
  alwaysOpen = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  
  useEffect(() => {
    if (alwaysOpen) setIsOpen(true);
  }, [alwaysOpen]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const { top, left } = useFloatingPosition(
    triggerRef,
    floatingRef,
    { placement: 'below', align: 'start' },
    isOpen
  );

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex((o) => o.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, options, value]);

  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (alwaysOpen) return;
      if (
        floatingRef.current &&
        !floatingRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        if (!alwaysOpen) setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll('[role="option"]');
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        const container = listboxRef.current;
        const itemTop = highlightedItem.offsetTop;
        const itemBottom = itemTop + highlightedItem.offsetHeight;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        if (itemTop < containerScrollTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerScrollTop + containerHeight) {
          container.scrollTop = itemBottom - containerHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const toggleOpen = () => {
    if (disabled || alwaysOpen) return;
    setIsOpen(!isOpen);
  };

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange?.(option.value);
    if (!alwaysOpen) {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (!alwaysOpen) setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && !options[highlightedIndex].disabled) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < options.length && options[next].disabled) next++;
          return next < options.length ? next : prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && options[next].disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
      default:
        // Basic type-ahead
        if (e.key.length === 1) {
          const char = e.key.toLowerCase();
          const nextIndex = options.findIndex(
            (o, i) => !o.disabled && i > highlightedIndex && o.label.toLowerCase().startsWith(char)
          );
          if (nextIndex >= 0) {
            setHighlightedIndex(nextIndex);
          } else {
            const wrapIndex = options.findIndex(
              (o) => !o.disabled && o.label.toLowerCase().startsWith(char)
            );
            if (wrapIndex >= 0) setHighlightedIndex(wrapIndex);
          }
        }
        break;
    }
  };

  const buttonClasses = `
    flex items-center gap-2 w-full h-10 px-3
    text-sm text-left bg-[var(--planner-control-bg)] border rounded-[8px]
    transition-colors duration-[var(--motion-fast)]
    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
    ${error ? 'border-accent text-accent' : 'border-border focus:border-ink'}
    outline-none
    ${className}
  `;

  return (
    <div className="ui-custom-select flex flex-col gap-1.5 w-full relative">
      {label && (
        <label htmlFor={id} className="ui-custom-select-label text-[13px] font-medium text-ink-light">
          {label}
        </label>
      )}

      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        id={id}
        aria-disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-listbox` : undefined}
        className={`ui-custom-select-trigger ${buttonClasses}`}
      >
        <span
          className={`ui-custom-select-value flex-1 min-w-0 text-left truncate text-sm ${selectedOption ? 'text-ink' : 'text-ink-light opacity-50'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`ui-custom-select-chevron ${error ? 'text-accent' : 'text-ink-light'}`} />
      </div>

      {error && errorText && (
        <span className="text-[13px] text-accent mt-0.5">{errorText}</span>
      )}

      {isOpen && (alwaysOpen ? (
        <div className="ui-custom-select-dropdown absolute z-10 p-1 bg-[var(--planner-control-bg)] border border-border rounded-md shadow-medium left-0 right-0 top-full mt-1">
          <ul
              id={`${id}-listbox`}
              role="listbox"
              ref={listboxRef}
              className="ui-custom-select-options max-h-[240px] overflow-y-auto"
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                let itemClass = `ui-custom-select-option flex items-center h-10 px-2 rounded-[4px] text-sm cursor-pointer select-none `;
                if (option.disabled) {
                  itemClass += `opacity-40 cursor-not-allowed text-ink-light [text-shadow:0_1px_0_rgba(255,255,255,0.7)] `;
                } else if (isSelected) {
                  itemClass += `bg-dot/60 text-ink `;
                } else if (isHighlighted) {
                  itemClass += `bg-dot/40 text-ink `;
                } else {
                  itemClass += `text-ink hover:bg-dot/40 `;
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
        </div>
      ) : (
        createPortal(
          <div
            ref={floatingRef}
            className="ui-custom-select-dropdown fixed z-50 p-1 bg-[var(--planner-control-bg)] border border-border rounded-md shadow-medium"
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
              className="ui-custom-select-options max-h-[240px] overflow-y-auto"
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                let itemClass = `ui-custom-select-option flex items-center h-10 px-2 rounded-[4px] text-sm cursor-pointer select-none `;
                if (option.disabled) {
                  itemClass += `opacity-40 cursor-not-allowed text-ink-light [text-shadow:0_1px_0_rgba(255,255,255,0.7)] `;
                } else if (isSelected) {
                  itemClass += `bg-dot/60 text-ink `;
                } else if (isHighlighted) {
                  itemClass += `bg-dot/40 text-ink `;
                } else {
                  itemClass += `text-ink hover:bg-dot/40 `;
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
          triggerRef.current?.closest('.app-shell') ?? document.body
        )
      ))}
    </div>
  );
}
