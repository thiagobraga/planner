// RFC 5321 caps a full address at 254 characters; rejecting longer input up front
// keeps regex matching bounded no matter what an attacker sends.
export const EMAIL_MAX_LENGTH = 254;

// Every quantifier here is either anchored by a literal (`@`, `.`) or bounded ({0,61}),
// so no sub-expression can match the same input two ways. Do not replace this with the
// looser /^[^\s@]+@[^\s@]+\.[^\s@]+$/ shape: its dot-tolerant classes overlap and give
// quadratic backtracking on hostile input (CWE-1333).
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(value)
  );
}
