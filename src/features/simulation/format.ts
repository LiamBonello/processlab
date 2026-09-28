export function formatSimulationDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0.0 min';
  if (minutes < 60) return `${minutes.toFixed(1)} min`;

  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;

  return `${(hours / 24).toFixed(1)} days`;
}
