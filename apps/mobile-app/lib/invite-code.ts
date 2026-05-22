/** Same normalization as backend GroupsService.normalizeInviteCode */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function paramString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return normalizeInviteCode(v.join(""));
  return v ? normalizeInviteCode(v) : "";
}
