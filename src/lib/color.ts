function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function mixHex(from: string, to: string, t: number): string {
  const start = channels(from);
  const end = channels(to);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * t));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function heatHex(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped < 0.5) return mixHex("#1d4e89", "#e0a106", clamped / 0.5);
  return mixHex("#e0a106", "#c4473a", (clamped - 0.5) / 0.5);
}

export function scoreHex(score: number): string {
  if (score <= 33) return mixHex("#1f8f5a", "#c6a317", score / 33);
  if (score <= 66) return mixHex("#c6a317", "#e07a1f", (score - 33) / 33);
  return mixHex("#e07a1f", "#c2352d", Math.min(1, (score - 66) / 34));
}

export function percentile(value: number, values: number[]): number {
  if (values.length <= 1) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((item) => item < value).length;
  return below / (sorted.length - 1);
}
