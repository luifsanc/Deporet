const ZONE = 'America/Guayaquil';
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateTimeFmt = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONE });
const shortFmt = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: ZONE });
const dayFmt = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONE });
const weekdayFmt = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONE });

export const money = (value: number | null | undefined) => moneyFmt.format(value ?? 0);
export const dateTime = (value: string) => dateTimeFmt.format(new Date(value));
export const shortDateTime = (value: string) => shortFmt.format(new Date(value));
export const longDate = (value: Date | string = new Date()) => dayFmt.format(typeof value === 'string' ? new Date(value) : value);
export const todayLabel = () => weekdayFmt.format(new Date());
/** Today in Ecuador as YYYY-MM-DD. */
export const todayEc = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const initials = (name: string | undefined) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('') || 'DR';

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** Reference risk scale used by the gauge and the PDF report (1–999). */
export const RISK_BANDS = [
  { label: 'Alto', from: 1, to: 499, color: '#e11d48', tone: 'danger', text: 'Riesgo alto' },
  { label: 'Medio', from: 500, to: 699, color: '#f59e0b', tone: 'warning', text: 'Riesgo medio' },
  { label: 'Bajo', from: 700, to: 999, color: '#10b981', tone: 'success', text: 'Riesgo bajo' },
] as const;
export const riskBand = (score: number) => RISK_BANDS.find(b => score >= b.from && score <= b.to) ?? RISK_BANDS[0];

/** CSV export with spreadsheet formula-injection protection. */
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map(r => r.map(x => '"' + String(x).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(',')).join('\r\n');
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
