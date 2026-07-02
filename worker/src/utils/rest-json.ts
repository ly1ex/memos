export function timestampFromUnix(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

export function stateFromRowStatus(rowStatus: string): "NORMAL" | "ARCHIVED" {
  return rowStatus === "ARCHIVED" ? "ARCHIVED" : "NORMAL";
}
