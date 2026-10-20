import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { Icon } from './icon';
import { todayEc } from '../core/format';

export interface DateRange { from: string; to: string }
interface Cell { iso: string; day: number; inMonth: boolean; disabled: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const shortDate = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' });

/** Range calendar with quick presets, in Ecuador's local calendar (UTC−5). */
@Component({
  selector: 'dr-date-range',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '(document:mousedown)': 'onOutside($event)', '(keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="select-sm flex w-full items-center gap-2 text-left sm:min-w-60" [class.border-brand-500]="open()"
            (click)="toggle()" [attr.aria-expanded]="open()" aria-haspopup="dialog">
      <dr-icon name="calendar" class="size-4 text-ink-400" />
      <span class="truncate" [class.text-ink-500]="!from()">{{ label() }}</span>
    </button>
    @if (open()) {
      <div class="card absolute left-0 top-12 z-40 w-[min(21.5rem,calc(100vw-2rem))] p-4 sm:left-auto sm:right-0" style="animation: var(--animate-rise-in)" role="dialog" aria-label="Seleccionar rango de fechas">
        <div class="mb-3 flex flex-wrap gap-1.5">
          @for (p of presets; track p.id) {
            <button type="button" class="chip h-8 px-2.5 text-xs" (click)="preset(p.id)">{{ p.label }}</button>
          }
        </div>
        <div class="mb-2 flex items-center justify-between">
          <button type="button" class="btn btn-icon size-8" (click)="shift(-1)" aria-label="Mes anterior"><dr-icon name="chevron-left" class="size-4" /></button>
          <p class="text-sm font-semibold capitalize text-ink-900" aria-live="polite">{{ title() }}</p>
          <button type="button" class="btn btn-icon size-8" (click)="shift(1)" [disabled]="!canNext()" aria-label="Mes siguiente"><dr-icon name="chevron-right" class="size-4" /></button>
        </div>
        <div class="grid grid-cols-7 text-center text-[0.6875rem] font-semibold uppercase text-ink-400">
          @for (w of weekdays; track $index) { <span class="py-1.5">{{ w }}</span> }
        </div>
        <div class="grid grid-cols-7 gap-y-0.5" role="grid">
          @for (c of cells(); track c.iso) {
            <button type="button" role="gridcell" class="num relative h-9 text-[0.8125rem] transition"
                    [class]="cellClass(c)" [disabled]="c.disabled" [attr.aria-selected]="isEdge(c.iso)" [attr.aria-label]="c.iso"
                    (click)="pick(c.iso)" (mouseenter)="hover.set(c.iso)">{{ c.day }}</button>
          }
        </div>
        <div class="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
          <p class="truncate text-xs text-ink-500">{{ draftLabel() }}</p>
          <div class="flex gap-1.5">
            <button type="button" class="btn btn-sm btn-ghost" (click)="clear()">Limpiar</button>
            <button type="button" class="btn btn-sm btn-dark" [disabled]="!draftFrom()" (click)="apply()">Aplicar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DateRangePicker {
  readonly from = input('');
  readonly to = input('');
  readonly rangeChange = output<DateRange>();

  protected readonly open = signal(false);
  protected readonly draftFrom = signal('');
  protected readonly draftTo = signal('');
  protected readonly hover = signal('');
  protected readonly view = signal(parse(todayEc()));
  protected readonly weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  protected readonly presets = [
    { id: 'today', label: 'Hoy' }, { id: '7', label: '7 días' }, { id: '30', label: '30 días' },
    { id: 'month', label: 'Este mes' }, { id: 'prev', label: 'Mes anterior' }, { id: 'all', label: 'Todo' },
  ];
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly today = todayEc();

  protected readonly label = computed(() => describe(this.from(), this.to()) || 'Todas las fechas');
  protected readonly draftLabel = computed(() => describe(this.draftFrom(), this.draftTo()) || 'Selecciona el inicio del rango');
  protected readonly title = computed(() => monthName.format(this.view()));
  protected readonly canNext = computed(() => {
    const v = this.view(), t = parse(this.today);
    return v.getFullYear() < t.getFullYear() || (v.getFullYear() === t.getFullYear() && v.getMonth() < t.getMonth());
  });
  protected readonly cells = computed<Cell[]>(() => {
    const v = this.view(), y = v.getFullYear(), m = v.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, m, i - offset + 1), iso = toIso(d);
      return { iso, day: d.getDate(), inMonth: d.getMonth() === m, disabled: iso > this.today };
    });
  });

  protected toggle() {
    if (!this.open()) {
      this.draftFrom.set(this.from());
      this.draftTo.set(this.to());
      this.view.set(parse(this.to() || this.today));
    }
    this.open.update(o => !o);
  }

  protected shift(delta: number) {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  protected pick(iso: string) {
    if (!this.draftFrom() || this.draftTo()) { this.draftFrom.set(iso); this.draftTo.set(''); return; }
    if (iso < this.draftFrom()) { this.draftTo.set(this.draftFrom()); this.draftFrom.set(iso); return; }
    this.draftTo.set(iso);
  }

  protected isEdge(iso: string) { return iso === this.draftFrom() || iso === this.draftTo(); }

  protected cellClass(c: Cell): string {
    const from = this.draftFrom(), to = this.draftTo() || (from && this.hover() > from ? this.hover() : '');
    if (this.isEdge(c.iso)) return 'rounded-lg bg-brand-600 font-semibold text-white shadow-sm';
    if (from && to && c.iso > from && c.iso < to) return 'bg-brand-50 text-brand-800';
    if (c.disabled) return 'text-ink-300';
    const base = c.inMonth ? 'text-ink-700' : 'text-ink-300';
    return `${base} rounded-lg hover:bg-ink-100 ${c.iso === this.today ? 'font-bold text-brand-600' : ''}`;
  }

  protected preset(id: string) {
    const t = parse(this.today);
    const at = (y: number, m: number, d: number) => toIso(new Date(y, m, d));
    const y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
    const ranges: Record<string, DateRange> = {
      today: { from: this.today, to: this.today },
      '7': { from: at(y, m, d - 6), to: this.today },
      '30': { from: at(y, m, d - 29), to: this.today },
      month: { from: at(y, m, 1), to: this.today },
      prev: { from: at(y, m - 1, 1), to: at(y, m, 0) },
      all: { from: '', to: '' },
    };
    this.emit(ranges[id]);
  }

  protected apply() { this.emit({ from: this.draftFrom(), to: this.draftTo() || this.draftFrom() }); }
  protected clear() { this.emit({ from: '', to: '' }); }

  protected onOutside(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private emit(range: DateRange) {
    this.open.set(false);
    this.rangeChange.emit(range);
  }
}

function describe(from: string, to: string): string {
  if (!from) return '';
  if (!to || from === to) return longDate.format(parse(from));
  const a = parse(from), b = parse(to);
  return `${a.getFullYear() === b.getFullYear() ? shortDate.format(a) : longDate.format(a)} – ${longDate.format(b)}`;
}
