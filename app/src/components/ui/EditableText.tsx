import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react';
import type { EditableTextProps } from '../../types/editableText';
import { getText, insertText } from '../../utils/editableText';

/**
 * Single-line text field built on contenteditable instead of `<input>`.
 *
 * Chrome on Android shows its password/card/address bar above the keyboard for
 * any focused `<input>`, and ignores `autocomplete="off"`. A contenteditable
 * element is not a form field, so the bar never appears while typing tasks.
 */
export function EditableText({
  ref,
  value,
  defaultValue = '',
  placeholder,
  className = '',
  onValueChange,
  onEnter,
  onKeyDown,
  ...rest
}: EditableTextProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const initialText = useRef(defaultValue);
  const onEnterRef = useRef(onEnter);

  useImperativeHandle(ref, () => elRef.current as HTMLDivElement, []);

  useLayoutEffect(() => {
    onEnterRef.current = onEnter;
  });

  // Children are never rendered by React, so writing the DOM here cannot fight
  // reconciliation; skipping equal text keeps the caret where the user left it.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const next = value ?? initialText.current;
    if (getText(el) !== next) el.textContent = next;
  }, [value]);

  // Some Android keyboards send Enter as keyCode 229 with no usable key, so the
  // line break only shows up here. A handled keydown Enter never reaches it.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'insertParagraph' && event.inputType !== 'insertLineBreak') return;
      event.preventDefault();
      if (!event.isComposing) onEnterRef.current?.(getText(el));
    };
    el.addEventListener('beforeinput', handleBeforeInput);
    return () => el.removeEventListener('beforeinput', handleBeforeInput);
  }, []);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    // Browsers leave a <br> behind when the last character is deleted, which
    // would keep :empty (and so the placeholder) from matching.
    if (getText(el) === '' && el.firstChild) el.replaceChildren();
    onValueChange?.(getText(el), el);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.nativeEvent.isComposing) onEnter?.(getText(event.currentTarget));
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const el = event.currentTarget;
    const text = event.clipboardData.getData('text/plain').replace(/\s*[\r\n]+\s*/g, ' ');
    insertText(el, text);
    onValueChange?.(getText(el), el);
  };

  return (
    <div
      {...rest}
      ref={elRef}
      role="textbox"
      aria-multiline="false"
      aria-placeholder={placeholder}
      contentEditable="plaintext-only"
      tabIndex={0}
      className={`editable-text ${className}`}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
}
