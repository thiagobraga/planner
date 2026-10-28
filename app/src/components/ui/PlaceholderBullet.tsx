import { useCheckboxStore } from '../../stores/checkboxStore';
import { CheckboxMark } from './Checkbox';

/** Leading marker of an add-task row: a faint bullet, or a faint empty checkbox when that setting is on. */
export function PlaceholderBullet() {
  const showCheckboxes = useCheckboxStore((s) => s.enabled);
  return (
    <span aria-hidden="true" className="w-6 h-6 flex items-center justify-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
      {showCheckboxes ? <CheckboxMark checked={false} /> : '•'}
    </span>
  );
}
