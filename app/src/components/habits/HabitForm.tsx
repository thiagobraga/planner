import { useState, FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface HabitFormValues {
  name: string;
  note?: string;
}

export interface HabitFormProps {
  initialValues?: HabitFormValues;
  submitLabel?: string;
  onSubmit: (values: HabitFormValues) => void;
  onCancel: () => void;
}

export function HabitForm({
  initialValues,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, note: note.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-6 border border-border rounded-[8px] bg-cream">
      <div className="flex flex-col gap-4">
        <Input
          placeholder="Habit name"
          value={name}
          maxLength={100}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end mt-6">
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
