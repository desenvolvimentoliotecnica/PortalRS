// Client-safe env — no server-only dependencies.
export const env = {
  API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "",
};
