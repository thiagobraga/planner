import type { KeyboardEvent } from 'react';

export function handleRadioNavigation(event: KeyboardEvent<HTMLElement>): void {
  const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!direction && event.key !== 'Home' && event.key !== 'End') return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)'));
  const current = options.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + direction! + options.length) % options.length;
  options[next].focus();
  options[next].click();
}
