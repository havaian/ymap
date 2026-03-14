// frontend/src/utils/detailFormatters.ts
// Shared formatting helpers for OrgSidebar and InfraSidebar

export function formatUZS(value?: number): string | null {
  if (value == null || value === 0) return null;
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(1)} млрд UZS`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн UZS`;
  return `${value.toLocaleString("ru-RU")} UZS`;
}

export function formatUSD(value?: number): string | null {
  if (value == null || value === 0) return null;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function budgetPercent(spent?: number, committed?: number): number {
  if (!spent || !committed || committed === 0) return 0;
  return Math.min(100, Math.round((spent / committed) * 100));
}

export function translateSourceType(sourceType?: string): string {
  if (!sourceType) return "—";
  const map: Record<string, string> = {
    IFI: "МФО (Международные финансовые организации)",
    HOMIY: "Спонсор / Донор",
    BYUDJET: "Государственный бюджет",
  };
  return map[sourceType] ?? sourceType;
}

export function translateStatus(status?: string): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    Rejalashtirilgan: "Запланировано",
    Tugallangan: "Завершено",
    "Qurilish/ta'mir": "Строительство / Ремонт",
    Tender: "Тендер",
  };
  return map[status] ?? status;
}

export function statusColor(status?: string): string {
  if (!status)
    return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  const map: Record<string, string> = {
    Rejalashtirilgan:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    Tugallangan:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    "Qurilish/ta'mir":
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    Tender:
      "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  };
  return (
    map[status] ??
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
  );
}
