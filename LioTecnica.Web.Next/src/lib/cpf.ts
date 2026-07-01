/** Valida CPF brasileiro (11 dígitos + dígitos verificadores). */
export function validateCpf(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (Number(digits[9]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return Number(digits[10]) === d2;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
