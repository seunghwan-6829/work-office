export const ADMIN_EMAIL = "motiol_6829@naver.com";

export function isAdminEmail(email?: string | null) {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL;
}