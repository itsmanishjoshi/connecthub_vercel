/**
 * Optimistic-write conflict helpers (used by offline sync queue tests and API payloads).
 */
export function isStaleWrite(serverUpdatedAt, clientExpectedAt) {
  if (!clientExpectedAt) return false;
  return new Date(serverUpdatedAt).getTime() > new Date(clientExpectedAt).getTime();
}

export function stripConflictMeta(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const { expected_updated_at: _ignored, ...rest } = payload;
  return rest;
}
