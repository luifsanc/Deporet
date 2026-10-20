import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { Dialogs } from '../core/dialogs';
import { dateTime, money, RISK_BANDS, riskBand, shortDateTime, shortId } from '../core/format';
import { CreditData, CreditReport } from '../core/models';
import { cedulaLooksValid, DrValidators, Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { ScoreGauge } from '../ui/score-gauge';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

const COST = 5;

@Component({
  selector: 'dr-credit',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon, ScoreGauge, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Información para decidir mejor</p>
        <h1 class="page-title mt-2">Tu historial crediticio.</h1>
        <p class="page-lead">Consulta con autorización expresa. Recibes tu score y un reporte PDF listo para imprimir. Valor: <span class="num font-semibold text-ink-800">{{ money(cost) }}</span>.</p>
      </div>
      <div class="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-[var(--shadow-xs)]">
        <span class="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">Fuente</span>
        <img src="/equifax.svg" alt="Equifax" class="h-5 w-auto" />
      </div>
    </header>

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <!-- Request -->
      <section class="card card-pad h-fit" aria-labelledby="credit-form-title">
        <div class="flex items-center gap-3">
          <span class="icon-tile is-brand"><dr-icon name="search" /></span>
          <div><h2 id="credit-form-title" class="section-title">Nueva consulta</h2><p class="text-sm text-ink-500">Una consulta, más claridad.</p></div>
        </div>
        <form [formGroup]="form" (ngSubmit)="request()" class="mt-5 space-y-4" novalidate>
          <dr-field label="Cédula o RUC del titular" [warning]="documentWarning()" [successText]="documentSuccess()" [messages]="{ digits: 'Ingresa 10 dígitos (cédula) o 13 dígitos (RUC).' }">
            <input drControl id="credit-document" class="num tracking-wider" formControlName="document" inputmode="numeric" maxlength="13" autocomplete="off" />
          </dr-field>
          <div class="rounded-2xl bg-ink-50 p-4 text-sm">
            <div class="flex justify-between"><span class="text-ink-500">Costo de la consulta</span><span class="num font-semibold text-ink-900">{{ money(cost) }}</span></div>
            <div class="mt-1.5 flex justify-between"><span class="text-ink-500">Saldo disponible</span>
              <span class="num font-medium" [class]="insufficient() ? 'text-rose-600' : 'text-ink-700'">{{ money(session.dashboard()?.balance ?? 0) }}</span></div>
          </div>
          @if (insufficient()) { <div class="alert alert-warning"><dr-icon name="alert" />Tu saldo disponible no cubre la consulta. Solicita una recarga primero.</div> }
          <label class="check-label">
            <input type="checkbox" class="check" formControlName="consent" />
            <span>Declaro ser titular o contar con autorización válida para consultar este documento. Autorizo su envío al proveedor configurado y el débito previo de {{ money(cost) }} <span class="text-ink-400">(consentimiento equifax-v2)</span>.</span>
          </label>
          <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="busy() || form.invalid || insufficient()">
            @if (busy()) { <span class="spinner"></span> Consultando… } @else { Consultar · {{ money(cost) }} <dr-icon name="arrow" /> }
          </button>
          <p class="text-xs leading-relaxed text-ink-400">Si el proveedor no responde, el cargo se devuelve automáticamente. Repetir el mismo documento en esta sesión recupera la misma solicitud, sin un nuevo cobro.</p>
        </form>
      </section>

      <!-- Result -->
      <section class="card overflow-hidden" aria-live="polite" aria-labelledby="credit-result-title">
        @if (selected(); as r) {
          <div class="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-4 sm:px-6">
            <h2 id="credit-result-title" class="section-title mr-auto">Reporte #{{ shortId(r.id) }}</h2>
            @if (r.mode === 'Sandbox') { <span class="badge badge-sandbox">Reporte ficticio</span> }
            <dr-status [value]="r.status" />
          </div>
          @if (r.report; as data) {
            @let band = riskBand(data.score);
            <div class="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              <div class="text-center">
                <dr-score-gauge [score]="data.score" class="mx-auto max-w-[17rem]" />
                <p class="num -mt-2 text-6xl font-extrabold tracking-[-0.05em] text-navy-900">{{ data.score }}</p>
                <p class="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-400">Score de referencia · 1–999</p>
                <span class="badge mt-3" [class]="'badge-' + band.tone"><span class="badge-dot"></span>{{ r.mode === 'Sandbox' ? band.text + ' (ejemplo)' : 'Escala referencial' }}</span>
                <ul class="mt-5 flex justify-center gap-3 text-[0.6875rem] text-ink-500">
                  @for (b of bands; track b.label) { <li class="flex items-center gap-1.5"><span class="size-2 rounded-full" [style.background]="b.color"></span>{{ b.label }} {{ b.from }}–{{ b.to }}</li> }
                </ul>
              </div>
              <div class="min-w-0">
                <dl class="grid grid-cols-2 gap-3">
                  @for (k of kpis(); track k.label) {
                    <div class="rounded-2xl border border-ink-100 bg-ink-25 p-3.5">
                      <dt class="text-xs text-ink-500">{{ k.label }}</dt>
                      <dd class="num mt-1 text-lg font-bold tracking-[-0.02em]" [class]="k.alert ? 'text-rose-600' : 'text-ink-950'">{{ k.value }}</dd>
                    </div>
                  }
                </dl>
                @if (data.entities?.length) {
                  <h3 class="mt-5 text-sm font-semibold text-ink-900">Distribución por entidad</h3>
                  <ul class="mt-2.5 space-y-2.5">
                    @for (e of data.entities!.slice(0, 4); track e.institution) {
                      <li>
                        <div class="flex justify-between gap-3 text-[0.8125rem]"><span class="truncate text-ink-700">{{ e.institution }}</span><span class="num shrink-0 font-semibold text-ink-900">{{ money(e.direct ?? e.balance ?? 0) }}</span></div>
                        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100"><div class="h-full rounded-full bg-gradient-to-r from-navy-700 to-brand-500" [style.width.%]="e.share ?? 0"></div></div>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
            <div class="flex flex-col gap-3 border-t border-ink-100 bg-ink-25 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <p class="flex-1 text-xs leading-relaxed text-ink-500">{{ r.documentType === 'RUC' ? 'RUC' : 'Cédula' }} {{ r.documentMasked }} · emitido {{ dateTime(r.completedAt || r.createdAt) }}</p>
              <div class="flex gap-2">
                <button type="button" class="btn btn-secondary flex-1" [disabled]="!!dialogs.pdfBusy()" (click)="preview(r)">
                  @if (dialogs.pdfBusy() === pdfPath(r)) { <span class="spinner"></span> } @else { <dr-icon name="eye" /> } Ver PDF
                </button>
                <button type="button" class="btn btn-primary flex-1" [disabled]="!!dialogs.pdfBusy()" (click)="download(r)"><dr-icon name="download" /> Descargar</button>
              </div>
            </div>
            @if (data.disclaimer) { <p class="flex gap-2 border-t border-amber-100 bg-amber-50/60 px-5 py-3 text-xs leading-relaxed text-amber-900 sm:px-6"><dr-icon name="info" class="size-4 shrink-0" />{{ data.disclaimer }}</p> }
          } @else {
            <div class="p-6"><div class="alert" [class]="r.status === 'Procesando' ? 'alert-info' : 'alert-warning'"><dr-icon [name]="r.status === 'Procesando' ? 'clock' : 'alert'" />{{ r.error || 'Consulta en proceso. Te avisaremos al completarse.' }}</div></div>
          }
        } @else {
          <div class="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center">
            <div class="relative">
              <span class="icon-tile is-navy size-16 rounded-3xl"><dr-icon name="chart" class="size-8" /></span>
              <span class="absolute -right-2 -top-2 inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-brand)]"><dr-icon name="sparkles" class="size-4" /></span>
            </div>
            <h2 id="credit-result-title" class="mt-5 text-lg font-semibold">Tu reporte aparecerá aquí</h2>
            <p class="mt-1 max-w-sm text-sm text-ink-500">Ingresa el documento, autoriza la consulta y obtén tu score con el resumen de obligaciones y mora.</p>
          </div>
        }
      </section>
    </div>

    <section class="card mt-6 overflow-hidden" aria-labelledby="credit-history-title">
      <div class="px-5 pb-3 pt-5 sm:px-6"><h2 id="credit-history-title" class="section-title">Consultas recientes</h2></div>
      @if (!reports().length) {
        <p class="px-6 pb-6 text-sm text-ink-500">{{ loading() ? 'Cargando…' : 'Aún no tienes consultas.' }}</p>
      } @else {
        <div class="table-wrap">
          <table class="table-modern">
            <thead><tr><th>Fecha</th><th>Documento</th><th>Score</th><th class="text-right">Costo</th><th>Estado</th><th class="text-right">Reporte</th></tr></thead>
            <tbody>
              @for (r of reports(); track r.id) {
                <tr [class.bg-brand-50]="selected()?.id === r.id">
                  <td class="num whitespace-nowrap text-ink-500">{{ shortDateTime(r.createdAt) }}</td>
                  <td class="num whitespace-nowrap"><span class="font-medium text-ink-900">{{ r.documentMasked }}</span> <span class="ml-1 text-xs text-ink-400">{{ r.documentType }} · {{ r.mode }}</span></td>
                  <td class="num font-semibold text-ink-900">{{ r.report?.score ?? '—' }}</td>
                  <td class="num text-right text-ink-700">{{ money(r.cost) }}</td>
                  <td><dr-status [value]="r.status" /></td>
                  <td class="whitespace-nowrap text-right">
                    <button type="button" class="btn btn-sm btn-ghost" (click)="selected.set(r)">Ver</button>
                    @if (r.report) { <button type="button" class="btn btn-sm btn-ghost text-brand-700" [disabled]="!!dialogs.pdfBusy()" (click)="download(r)"><dr-icon name="download" /> PDF</button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class CreditPage {
  protected readonly session = inject(Session);
  protected readonly dialogs = inject(Dialogs);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly dateTime = dateTime;
  protected readonly shortDateTime = shortDateTime;
  protected readonly shortId = shortId;
  protected readonly riskBand = riskBand;
  protected readonly bands = RISK_BANDS;
  protected readonly cost = COST;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    document: ['', [Validators.required, DrValidators.digits(10, 13)]],
    consent: [false, Validators.requiredTrue],
  });
  private readonly document = toSignal(this.form.controls.document.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly reports = signal<CreditReport[]>([]);
  protected readonly selected = signal<CreditReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  private key = crypto.randomUUID();
  private lastDocument = '';

  protected readonly insufficient = computed(() => {
    const balance = this.session.dashboard()?.balance;
    return balance !== undefined && balance < COST;
  });
  protected readonly documentWarning = computed(() => {
    const v = this.document();
    if (v.length === 10 && /^\d+$/.test(v) && !cedulaLooksValid(v)) return 'El dígito verificador no corresponde a una cédula ecuatoriana. Revisa el número.';
    if (v.length === 13 && /^\d+$/.test(v) && !v.endsWith('001')) return 'Los RUC normalmente terminan en 001. Revisa el número.';
    return null;
  });
  protected readonly documentSuccess = computed(() => (this.document().length === 13 ? 'RUC con formato válido.' : 'Cédula con formato válido.'));
  protected readonly kpis = computed(() => {
    const s: NonNullable<CreditData['summary']> = this.selected()?.report?.summary ?? {};
    return [
      { label: 'Obligaciones directas', value: s.directObligations !== undefined ? money(s.directObligations) : 'No informado', alert: false },
      { label: 'Obligaciones indirectas', value: s.indirectObligations !== undefined ? money(s.indirectObligations) : 'No informado', alert: false },
      { label: 'Saldo vencido', value: s.overdue !== undefined ? money(s.overdue) : 'No informado', alert: (s.overdue ?? 0) > 0 },
      { label: 'Pagos puntuales', value: s.onTimePayments !== undefined ? `${s.onTimePayments}%` : '—', alert: (s.onTimePayments ?? 100) < 80 },
    ];
  });

  constructor() {
    effect(() => { this.session.changes(); untracked(() => void this.load()); });
  }

  protected pdfPath(r: CreditReport) { return `/credit/reports/${r.id}/pdf`; }
  private pdfName(r: CreditReport) { return `deporet-equifax-${shortId(r.id)}.pdf`; }

  async load() {
    this.loading.set(true);
    try {
      const list = await this.api.get<CreditReport[]>('/credit/reports');
      this.reports.set(list);
      const current = this.selected();
      this.selected.set(current ? list.find(r => r.id === current.id) ?? current : list.find(r => r.report) ?? null);
    } catch (e) { this.toasts.error('No se pudo cargar el historial', errorText(e)); } finally { this.loading.set(false); }
  }

  protected async request() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.insufficient()) return;
    const { document } = this.form.getRawValue();
    if (document !== this.lastDocument) { this.key = crypto.randomUUID(); this.lastDocument = document; }
    this.busy.set(true);
    try {
      const report = await this.api.post<CreditReport>('/credit/reports', { document, accepted: true, consentVersion: 'equifax-v2' }, { 'Idempotency-Key': this.key });
      this.selected.set(report);
      if (report.status === 'Completado') this.toasts.success('Consulta completada', `Score ${report.report?.score} · reporte PDF disponible.`);
      else this.toasts.info('Consulta registrada', report.error ?? 'Revisa el estado en el historial.');
      await Promise.all([this.load(), this.session.refresh()]);
    } catch (e) { this.toasts.error('No se pudo completar la consulta', errorText(e)); } finally { this.busy.set(false); }
  }

  protected preview(r: CreditReport) {
    void this.dialogs.previewPdf(this.pdfPath(r), this.pdfName(r), r.mode === 'Sandbox' ? 'Reporte ficticio de Sandbox' : 'Reporte de datos del proveedor', `${r.documentType} ${r.documentMasked} · Score ${r.report?.score ?? '—'}`);
  }
  protected download(r: CreditReport) { void this.dialogs.downloadPdf(this.pdfPath(r), this.pdfName(r)); }
}
