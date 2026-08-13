import { describe, it, expect } from 'vitest';
import { parseDueDate } from '../dateParser.js';

// Error handling is covered here rather than in the property test, which only
// feeds inputs the grammar accepts.
describe('parseDueDate error handling', () => {
  it('throws a descriptive error for an empty input', () => {
    expect(() => parseDueDate('')).toThrow(/Unrecognized date expression: ""/);
  });

  it('throws for whitespace-only input', () => {
    expect(() => parseDueDate('   ')).toThrow(/Unrecognized date expression/);
  });

  it('quotes the unrecognized slice when the parser reports a location', () => {
    expect(() => parseDueDate('tomorrow!!')).toThrow(
      /Unrecognized date expression: "!!"/,
    );
  });

  it('quotes the whole trimmed input when the parser reports no location', () => {
    expect(() => parseDueDate('not a date at all')).toThrow(
      /Unrecognized date expression: "not a date at all"/,
    );
  });
});
