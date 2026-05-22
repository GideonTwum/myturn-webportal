/**
 * Canonical phone key for OTP API — must match backend OtpService.normalizePhone:
 * all digits, no stripping of leading 0 or country code.
 */
export function normalizePhoneForApi(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) {
    throw new Error("Invalid phone number");
  }
  return digits;
}

/** Display-only: local Ghana format without country code. */
export function normalizePhoneDigits(phone: string): string {
  const digits = normalizePhoneForApi(phone);
  if (digits.startsWith("233") && digits.length > 9) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function maskPhone(phone: string): string {
  const d = normalizePhoneDigits(phone);
  const tail = d.slice(-2);
  return `+233 ••• ••${tail}`;
}
