/** Format and checksum only; does not establish that a card exists or can receive money. */
export function validCardNumber(value: string): boolean {
  if (!/^[\d -]+$/.test(value)) return false;
  const digits = value.replace(/[ -]/g, '');
  if (!/^\d{12,19}$/.test(digits) || /^0+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}
