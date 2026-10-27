export function usdCents(value: string): number {
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value))
    throw new Error('Invalid USD amount');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents <= 0) throw new Error('Amount must be positive');
  return cents;
}
