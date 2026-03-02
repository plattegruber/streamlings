import type { StreamlingTelemetry } from '@streamlings/shared';

export async function fetchTelemetry(
  url: string,
  streamerId: string
): Promise<StreamlingTelemetry | null> {
  try {
    const res = await fetch(`${url}/telemetry/${streamerId}`);
    if (!res.ok) return null;
    return (await res.json()) as StreamlingTelemetry;
  } catch {
    return null;
  }
}
