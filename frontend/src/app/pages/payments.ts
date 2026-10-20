import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { Dialogs } from '../core/dialogs';
import { money, saveBlob, shortDateTime, shortId, toCsv } from '../core/format';
import { Page, Payment } from '../core/models';
import { ReviewDialog } from '../dialogs/review-dialog';
import { DateRange, DateRangePicker } from '../ui/date-range';
import { Icon } from '../ui/icon';
import { Paginator } from '../ui/paginator';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

const STATUSES = ['Liquidada', 'Procesando', 'Rechazada'];

/** Transaction history (clients) and settlement queue (staff). */
@Component({
  selector: 'dr-payments',
  imports: [FormsModule, Icon, StatusBadge, Paginator, DateRangePicker, ReviewDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Trazabilidad en cada paso</p>
        <h1 class="page-title mt-2">{{ review() ? 'Revisión de operaciones' : 'Movimientos' }}</h1>
        <p class="page-lead">{{ review() ? 'Confirma la ejecución bancaria y registra la referencia para liquidar.' : 'Consulta tus operaciones y descarga sus constancias en PDF.' }}</p>
      </div>
      <button type="button" class="btn btn-secondary" (click)="exportCsv()" [disabled]="!items().length"><dr-icon name="download" /> Exportar CSV</button>
    </header>

    <section class="card mt-6 overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          <button type="button" class="chip" [class.is-active]="!status()" (click)="setStatus('')">Todos</button>
          @for (s of statuses; track s) {
            <button type="button" class="chip" [class.is-active]="status() === s" (click)="setStatus(s)">
              <span class="size-1.5 rounded-full" [class]="s === 'Liquidada' ? 'bg-emerald-500' : s === 'Procesando' ? 'bg-blue-500' : 'bg-rose-500'"></span>{{ s }}
            </button>
          }
        </div>
        <div class="grid gap-2 sm:grid-cols-2 lg:ml-auto lg:flex">
          <label class="sr-only" for="kind-filter">Tipo de operación</label>
          <select id="kind-filter" class="select-sm" [ngModel]="kind()" (ngModelChange)="setKind($event)">
            <option value="">Todas las operaciones</option>
            @for (s of session.services(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
          </select>
          <dr-date-range [from]="from()" [to]="to()" (rangeChange)="setRange($event)" />
        </div>
      </div>

      @if (error()) { <div class="alert alert-error m-4" role="alert"><dr-icon name="alert-circle" />{{ error() }}</div> }

      @if (loading() && !items().length) {
        <div class="space-y-3 p-5">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton h-12"></div> }</div>
      } @else if (!items().length) {
        <div class="flex flex-col items-center px-6 py-16 text-center">
          <span class="icon-tile size-12 rounded-2xl"><dr-icon name="history" class="size-6" /></span>
          <p class="mt-4 font-semibold text-ink-800">No hay operaciones con estos filtros.</p>
          <p class="mt-1 text-sm text-ink-500">Prueba con otro estado, servicio o rango de fechas.</p>
        </div>
      } @else {
        <div class="table-wrap hidden md:block" [class.opacity-60]="loading()">
          <table class="table-modern">
            <thead><tr><th>Operación</th><th>Destinatario</th><th>Fecha</th><th class="text-right">Total USD</th><th>Estado</th><th class="text-right">Acción</th></tr></thead>
            <tbody>
              @for (p of items(); track p.id) {
                <tr>
                  <td><div class="flex items-center gap-3">
                    <span class="icon-tile size-9"><dr-icon [name]="session.serviceIcon(p.kind)" class="size-[1.125rem]" /></span>
                    <div><p class="font-medium text-ink-900">{{ session.serviceName(p.kind) }}</p><p class="num text-xs text-ink-400">#{{ shortId(p.id) }}</p></div>
                  </div></td>
                  <td class="max-w-56"><p class="truncate text-ink-800">{{ p.recipient }}</p><p class="truncate text-xs text-ink-400">{{ p.reference }}</p></td>
                  <td class="num whitespace-nowrap text-ink-500">{{ shortDateTime(p.createdAt) }}</td>
                  <td class="num whitespace-nowrap text-right font-semibold text-ink-900">{{ money(p.total) }}</td>
                  <td><dr-status [value]="p.status" /></td>
                  <td class="text-right">
                    @if (canReview(p)) {
                      <button type="button" class="btn btn-sm btn-dark" (click)="target.set(p)">Revisar</button>
                    } @else {
                      <button type="button" class="btn btn-sm btn-ghost" (click)="dialogs.receipt.set(p)">Ver detalle <dr-icon name="chevron-right" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <ul class="md:hidden" [class.opacity-60]="loading()">
          @for (p of items(); track p.id) {
            <li class="list-row">
              <span class="icon-tile size-10"><dr-icon [name]="session.serviceIcon(p.kind)" class="size-[1.125rem]" /></span>
              <button type="button" class="min-w-0 flex-1 text-left" (click)="canReview(p) ? target.set(p) : dialogs.receipt.set(p)">
                <span class="block truncate text-sm font-medium text-ink-900">{{ p.recipient }}</span>
                <span class="block truncate text-xs text-ink-500">{{ session.serviceName(p.kind) }} · {{ shortDateTime(p.createdAt) }}</span>
              </button>
              <span class="flex flex-col items-end gap-1">
                <span class="num text-sm font-semibold text-ink-900">{{ money(p.total) }}</span>
                @if (canReview(p)) { <button type="button" class="btn btn-sm btn-dark min-h-7 px-2.5 text-xs" (click)="target.set(p)">Revisar</button> } @else { <dr-status [value]="p.status" /> }
              </span>
            </li>
          }
        </ul>
      }
      <dr-paginator [page]="page()" [total]="total()" noun="operaciones" [disabled]="loading()" (pageChange)="setPage($event)" />
    </section>

    @if (target(); as p) { <dr-review-dialog [payment]="p" (closed)="target.set(null)" (decided)="target.set(null); load()" /> }
  `,
})
export class PaymentsPage {
  /** Route data: true for the staff settlement queue. */
  readonly review = input(false);
  protected readonly session = inject(Session);
  protected readonly dialogs = inject(Dialogs);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly shortDateTime = shortDateTime;
  protected readonly shortId = shortId;
  protected readonly statuses = STATUSES;

  protected readonly items = signal<Payment[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly status = signal('');
  protected readonly kind = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly target = signal<Payment | null>(null);
  private initialized = false;

  constructor() {
    // Initial load, then reload on every realtime change notification.
    effect(() => {
      this.session.changes();
      untracked(() => {
        if (!this.initialized) { this.initialized = true; if (this.review()) this.status.set('Procesando'); }
        void this.load();
      });
    });
  }

  protected canReview(p: Payment) { return this.session.has('transactions.settle') && p.status === 'Procesando' && p.userId !== this.session.user()?.id; }
  protected setStatus(value: string) { this.status.set(value); this.page.set(1); void this.load(); }
  protected setKind(value: string) { this.kind.set(value); this.page.set(1); void this.load(); }
  protected setRange(r: DateRange) { this.from.set(r.from); this.to.set(r.to); this.page.set(1); void this.load(); }
  protected setPage(p: number) { this.page.set(p); void this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const q = new URLSearchParams({ page: String(this.page()) });
      if (this.from()) q.set('from', this.from());
      if (this.to()) q.set('to', this.to());
      if (this.status()) q.set('status', this.status());
      if (this.kind()) q.set('kind', this.kind());
      const data = await this.api.get<Page<Payment>>('/payments?' + q);
      this.items.set(data.items);
      this.total.set(data.total);
    } catch (e) { this.error.set(errorText(e)); } finally { this.loading.set(false); }
  }

  protected exportCsv() {
    const rows = [['Fecha', 'Operación', 'Tipo', 'Destinatario', 'Referencia', 'Monto USD', 'Comisión USD', 'IVA USD', 'Total USD', 'Estado'],
      ...this.items().map(p => [p.createdAt, p.id, this.session.serviceName(p.kind), p.recipient, p.reference, p.amount, p.fee, p.tax, p.total, p.status])];
    saveBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `deporet-movimientos-p${this.page()}.csv`);
    this.toasts.success('CSV exportado', `${this.items().length} operaciones de la página ${this.page()}.`);
  }
}
