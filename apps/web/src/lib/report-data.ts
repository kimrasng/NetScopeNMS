export function observedAvailability(observations: Record<string, unknown>[]): number | null {
  const measured = observations.filter(row => row.uptime_pct != null && Number.isFinite(Number(row.uptime_pct)) && Number.isFinite(Number(row.samples)) && Number(row.samples) > 0);
  const samples = measured.reduce((total, row) => total + Number(row.samples), 0);
  return samples ? measured.reduce((total, row) => total + Number(row.uptime_pct) * Number(row.samples), 0) / samples : null;
}
