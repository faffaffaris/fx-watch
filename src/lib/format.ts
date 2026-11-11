const CURRENCY_LABEL: Record<string, string> = {
  USD: "USD",
  CNY: "RMB",
  SDR: "SDR",
};

export function currencyLabel(code: string): string {
  return CURRENCY_LABEL[code] ?? code;
}

export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatMoney(value: number, currency: string): string {
  const label = currencyLabel(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const scales: [number, string][] = [
    [1e12, "tn"],
    [1e9, "bn"],
    [1e6, "mn"],
  ];
  for (const [size, suffix] of scales) {
    if (abs >= size) {
      const scaled = abs / size;
      const digits = scaled >= 100 ? 0 : 1;
      return `${sign}${label} ${formatNumber(scaled, digits)} ${suffix}`;
    }
  }
  return `${sign}${label} ${formatNumber(abs, 0)}`;
}

export function formatShare(value: number): string {
  return `${formatNumber(value * 100, 1)}%`;
}
