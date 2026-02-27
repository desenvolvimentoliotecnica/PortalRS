/**
 * URL base para chamadas ao backend (BFF/API).
 * S3: use NEXT_PUBLIC_BACKEND_URL (ex: https://portal.example.com).
 * Dev com rewrites: usa "/app" (same-origin).
 */
export function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  return url || "/app";
}
