export const CUSTOMER_USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/i;

export function normalizeCustomerUsername(username: string): string {
  const cleaned = username.trim();

  if (!CUSTOMER_USERNAME_PATTERN.test(cleaned)) {
    throw new Error(
      "Username must be 3-20 characters and can contain letters, numbers, dots, underscores, or hyphens."
    );
  }

  return cleaned.toLowerCase();
}

export function buildCustomerAuthEmail(username: string): string {
  return `${normalizeCustomerUsername(username)}@kamalia-customer.local`;
}
