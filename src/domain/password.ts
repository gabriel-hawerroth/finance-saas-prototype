/** Password policy (C20, generic.password-requirements). The server stays the source of truth. */
export const PASSWORD_SPECIALS = `!@#$%^&*(),.?":{}|<>`;

export interface PasswordCheck {
  key: "length" | "upper" | "digit" | "special";
  label: string;
  ok: boolean;
}

export function checkPassword(value: string): PasswordCheck[] {
  return [
    { key: "length", label: "8 ou mais caracteres", ok: value.length >= 8 },
    { key: "upper", label: "Uma letra maiúscula", ok: /[A-Z]/.test(value) },
    { key: "digit", label: "Um número", ok: /\d/.test(value) },
    { key: "special", label: `Um caractere especial`, ok: [...value].some((c) => PASSWORD_SPECIALS.includes(c)) },
  ];
}

export function isPasswordValid(value: string): boolean {
  return checkPassword(value).every((c) => c.ok);
}
