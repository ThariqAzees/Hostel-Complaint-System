/**
 * Formats a Date object to a DDMMYY string for temporary student passwords.
 * Example: March 15, 2005 -> "150305"
 */
export function formatDobToPassword(dob: Date | string): string {
  const date = typeof dob === "string" ? new Date(dob) : dob;
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date provided for DOB password formatting");
  }
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

/**
 * Validates password strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUppercase && hasLowercase && hasNumber && hasSpecial;
}
