/** Formats cents as South African rand, e.g. 150050 -> "R1 500,50", 150000 -> "R1 500". */
export function formatRand(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const fraction = abs % 100;
  return `${sign}R${whole}${fraction === 0 ? "" : `,${fraction.toString().padStart(2, "0")}`}`;
}
