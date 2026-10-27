/** Turns validation issues into one friendly message per form field. */
export function toFieldErrors<K extends string>(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>,
  messages: Record<K, string>,
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key in messages) errors[key as K] = messages[key as K];
  }
  return errors;
}
