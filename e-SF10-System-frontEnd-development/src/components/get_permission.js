export const getUserPermissions = () => {
  const stored = sessionStorage.getItem("loginResponse");
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return parsed.user?.permissions || [];
  } catch {
    return [];
  }
};
