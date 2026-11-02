/** "Phemelo Mokwena" -> "Phemelo". Returns null when there is no usable name. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}
