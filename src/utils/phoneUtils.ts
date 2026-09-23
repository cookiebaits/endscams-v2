/**
 * Utility functions for cleaning and formatting phone numbers for copy actions.
 */

export function getCleanCopyPhone(text: string): string {
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (!digits) return text.trim();

  // If 10-digit US number
  if (digits.length === 10) {
    return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // If 11-digit US number starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // If international number starting with + or digits
  return text.trim().startsWith('+') ? text.trim() : `+${digits}`;
}
