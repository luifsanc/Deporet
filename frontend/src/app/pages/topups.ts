import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { money, shortDateTime } from '../core/format';
import { Page, TopUp } from '../core/models';
import { DrValidators, Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Modal } from '../ui/modal';
import { Paginator } from '../ui/paginator';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

@Component({
  selector: 'dr-topups',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon, Modal, Paginator, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Más saldo, más posibilidades</p>
        <h1 class="page-title mt-2">{{ title() }}</h1>
        <p class="page-lead">{{ session.has('topups.approve') ? 'Revisa la evidencia externa antes de aprobar o rechazar la acreditación.' : 'Registra la operación. Administración u Operación validarán la acreditación.' }}</p>
      </div>
      <span class="badge badge-neutral num">{{ total() }} solicitudes</span>
    </header>

    <div class="mt-6 grid gap-6" [class]="session.isClient() && session.has('topups.create') ? 'xl:grid-cols-[24rem_minmax(0,1fr)]' : ''">
      @if (session.isClient() && session.has('topups.create')) {
        <section class="card card-pad h-fit" aria-labelledby="topup-form-title">
          <div class="flex items-center gap-3">
            <span class="icon-tile is-brand"><dr-icon [name]="moduleIcon()" /></span>
            <div><h2 id="topup-form-title" class="section-title">{{ actionTitle() }}</h2><p class="text-sm text-ink-500">El saldo permanece pendiente hasta la validación.</p></div>
          </div>
          @if (kind() === 'Deuna') {
            <div class="mt-5 rounded-2xl border border-ink-100 bg-white p-4 text-center"><p class="mb-3 text-sm font-semibold">Escanea el QR oficial de cobro DepoRet</p>@if(qrPdf()){<iframe [src]="qrPreview()" title="Código QR de cobro Deuna" class="h-64 w-full rounded-lg"></iframe>}@else{<img [src]="qrPreview()" alt="Código QR de cobro Deuna" class="mx-auto max-h-64 max-w-full object-contain" />}<p class="mt-3 text-xs text-ink-500">Verifica que el beneficiario del pago sea DepoRet antes de continuar.</p></div>
            @if (deunaStep() === 1) { <button type="button" class="btn btn-primary btn-lg btn-block mt-4" (click)="deunaStep.set(2)">Siguiente <dr-icon name="arrow" /></button> }
          }
          @if (kind() !== 'Deuna' || deunaStep() === 2) {
          <form [formGroup]="form" (ngSubmit)="create()" class="mt-5 space-y-4" novalidate>
            @if(kind()==='RecargaSaldo'){
              <dr-field label="Monto depositado" prefix="$" [warning]="amountWarning()" hint="Hasta $50,000.00 por operación."><input drControl id="topup-amount" class="num text-lg! font-semibold" type="number" inputmode="decimal" step="0.01" min="0.01" max="50000" formControlName="amount" /></dr-field>
              <dr-field label="Entidad financiera"><select drControl id="topup-bank" formControlName="bank"><option value="">Selecciona un banco</option>@for (b of session.banks(); track b) { <option [value]="b">{{b}}</option> }</select></dr-field>
              <dr-field label="Nombre completo del depositante"><input drControl id="topup-depositor" formControlName="depositorName" maxlength="120" autocomplete="name" /></dr-field>
              <dr-field label="Comprobante de referencia / depósito"><input drControl id="topup-reference" formControlName="reference" maxlength="100" autocomplete="off" /></dr-field>
            }
            @if(kind()==='EfectivoMovil'){
              <dr-field label="Código de retiro / ordenante"><input drControl id="topup-withdrawal-code" type="password" formControlName="withdrawalCode" maxlength="32" autocomplete="off" /></dr-field>
              <dr-field label="Código de beneficiario recibido por SMS"><input drControl id="topup-beneficiary-code" type="password" formControlName="beneficiaryCode" maxlength="32" autocomplete="off" /></dr-field>
              <dr-field label="Celular asociado a la orden"><input drControl id="topup-phone" formControlName="phoneNumber" maxlength="10" inputmode="numeric" autocomplete="tel-national" /></dr-field>
              <dr-field label="Nombre de la persona beneficiaria"><input drControl id="topup-beneficiary" formControlName="beneficiaryName" maxlength="120" autocomplete="name" /></dr-field>
              <dr-field label="Monto exacto del retiro" prefix="$" [warning]="amountWarning()" hint="Hasta $50,000.00 por orden."><input drControl id="topup-amount" class="num text-lg! font-semibold" type="number" inputmode="decimal" step="0.01" min="0.01" max="50000" formControlName="amount" /></dr-field>
            }
            @if(kind()==='Deuna'){
              <dr-field label="Nombre completo del emisor"><input drControl id="topup-sender" formControlName="senderName" maxlength="120" autocomplete="name" /></dr-field>
              <dr-field label="Monto transferido" prefix="$" [warning]="amountWarning()" hint="Hasta $50,000.00 por operación."><input drControl id="topup-amount" class="num text-lg! font-semibold" type="number" inputmode="decimal" step="0.01" min="0.01" max="50000" formControlName="amount" /></dr-field>
              <dr-field label="Referencia del comprobante Deuna"><input drControl id="topup-deuna-reference" formControlName="transactionReference" maxlength="100" autocomplete="off" /></dr-field>
            }
            <div class="flex gap-2"><button type="button" class="btn btn-secondary" (click)="deunaStep.set(1)" [class.hidden]="kind() !== 'Deuna'">Atrás</button><button type="submit" class="btn btn-primary btn-lg flex-1" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> Enviando… } @else { {{ kind() === 'Deuna' ? 'Confirmar pago Deuna' : 'Registrar solicitud pendiente' }} <dr-icon name="arrow" /> }
            </button>
            </div>
          </form>
          }
        </section>
      }

      <section class="card overflow-hidden" aria-labelledby="topup-list-title">
        <div class="px-5 pb-3 pt-5 sm:px-6"><h2 id="topup-list-title" class="section-title">{{ session.has('topups.approve') ? 'Solicitudes por revisar' : 'Mis solicitudes' }}</h2></div>
        @if (loading() && !items().length) {
          <div class="space-y-3 px-5 pb-5">@for (i of [1, 2, 3]; track i) { <div class="skeleton h-12"></div> }</div>
        } @else if (!items().length) {
          <div class="flex flex-col items-center px-6 pb-14 pt-6 text-center">
            <span class="icon-tile size-12 rounded-2xl"><dr-icon name="wallet" class="size-6" /></span>
            <p class="mt-4 font-semibold text-ink-800">Aún no hay solicitudes.</p>
            <p class="mt-1 text-sm text-ink-500">Los depósitos registrados aparecerán aquí con su estado.</p>
          </div>
        } @else {
          <div class="table-wrap hidden md:block">
            <table class="table-modern">
              <thead><tr><th>Fecha</th><th>Tipo / datos</th><th class="text-right">Monto</th><th>Estado</th><th>Revisión</th></tr></thead>
              <tbody>
                @for (t of items(); track t.id) {
                  <tr>
                    <td class="num whitespace-nowrap text-ink-500">{{ shortDateTime(t.createdAt) }}</td>
                    <td>
                      <p class="font-medium text-ink-900">{{ topupName(t.kind) }} · {{ t.userName || 'Cliente' }}</p>
                      <p class="text-xs text-ink-500">{{ summary(t) }}</p>
                      <p class="text-xs text-ink-400">{{ shortDateTime(t.createdAt) }}</p>
                    </td>
                    <td class="num whitespace-nowrap text-right font-semibold text-ink-900">{{ money(t.amount) }}</td>
                    <td><dr-status [value]="t.status" /></td>
                    <td class="max-w-60">
                      @if (session.has('topups.approve') && t.status === 'Pendiente') { <button type="button" class="btn btn-sm btn-dark" (click)="openReview(t)">Revisar y validar</button> }
                      @else { <span class="line-clamp-2 text-[0.8125rem] text-ink-500">{{ t.reviewNote || 'Pendiente de validación' }}</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="md:hidden">
            @for (t of items(); track t.id) {
              <li class="list-row">
                <span class="icon-tile size-10"><dr-icon name="bank" class="size-[1.125rem]" /></span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-ink-900">{{ topupName(t.kind) }} · {{ t.userName || 'Cliente' }}</span><span class="block truncate text-xs text-ink-500">{{ summary(t) }} · {{ shortDateTime(t.createdAt) }}</span></span>
                <span class="flex flex-col items-end gap-1">
                  <span class="num text-sm font-semibold text-ink-900">{{ money(t.amount) }}</span>
                  @if (session.has('topups.approve') && t.status === 'Pendiente') { <button type="button" class="btn btn-sm btn-dark min-h-7 px-2.5 text-xs" (click)="openReview(t)">Validar</button> } @else { <dr-status [value]="t.status" /> }
                </span>
              </li>
            }
          </ul>
        }
        <dr-paginator [page]="page()" [total]="total()" noun="solicitudes" [disabled]="loading()" (pageChange)="page.set($event); load()" />
      </section>
    </div>

    @if (reviewing(); as t) {
      <dr-modal [heading]="reviewTitle(t.kind)" eyebrow="Revisión de fondos" icon="wallet" [subtitle]="topupName(t.kind) + ' · ' + (t.userName || 'Cliente')" size="md" [dismissible]="!busy()" (closed)="reviewing.set(null)">
        <div class="rounded-2xl border border-ink-100 bg-white p-4">
          <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-semibold uppercase tracking-wide text-ink-500">Cliente que recibirá la acreditación</p><p class="mt-1 font-semibold text-ink-900">{{ t.userName || 'Cliente' }}</p><p class="text-xs text-ink-500">{{ t.userEmail }}</p></div><div class="text-right"><p class="text-xs font-semibold uppercase tracking-wide text-ink-500">Monto exacto</p><p class="num mt-1 text-2xl font-bold text-ink-950">{{ money(t.amount) }}</p></div></div>
        </div>
        @if (t.kind === 'RecargaSaldo') {
          <dl class="mt-3 space-y-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div><dt class="text-xs text-ink-500">Entidad financiera receptora</dt><dd class="mt-0.5 font-medium text-ink-900">{{ t.bank || 'No informado' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Nombre del depositante</dt><dd class="mt-0.5 font-medium text-ink-900">{{ t.depositorName || 'No informado' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Comprobante de referencia / depósito</dt><dd class="mt-0.5 break-all font-medium text-ink-900">{{ t.reference || 'No informado' }}</dd></div>
          </dl>
        } @else if (t.kind === 'EfectivoMovil') {
          <dl class="mt-3 space-y-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div><dt class="text-xs text-ink-500">Número de celular asociado a la orden</dt><dd class="mt-0.5 font-medium text-ink-900">{{ t.phoneNumber || 'No informado' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Persona asignada como beneficiaria</dt><dd class="mt-0.5 font-medium text-ink-900">{{ t.beneficiaryName || 'No informado' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Código de retiro / ordenante</dt><dd class="mt-0.5 break-all font-mono font-semibold text-ink-900">{{ t.withdrawalCode || 'No disponible' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Código de beneficiario recibido por SMS</dt><dd class="mt-0.5 break-all font-mono font-semibold text-ink-900">{{ t.beneficiaryCode || 'No disponible' }}</dd></div>
          </dl>
        } @else {
          <dl class="mt-3 space-y-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div><dt class="text-xs text-ink-500">Nombre completo del emisor</dt><dd class="mt-0.5 font-medium text-ink-900">{{ t.senderName || 'No informado' }}</dd></div>
            <div><dt class="text-xs text-ink-500">Código de referencia del comprobante Deuna</dt><dd class="mt-0.5 break-all font-medium text-ink-900">{{ t.transactionReference || 'No informado' }}</dd></div>
          </dl>
        }
        <p class="mt-3 text-sm text-ink-500">{{ reviewInstruction(t.kind) }}</p>
        @if (reviewError()) { <div class="alert alert-error mt-4" role="alert"><dr-icon name="alert-circle" />{{ reviewError() }}</div> }
        <form [formGroup]="reviewForm" class="mt-5" novalidate>
          <dr-field label="Motivo de la decisión" [showSuccess]="false">
            <textarea drControl id="topup-review-reason" formControlName="reason" maxlength="200" rows="3"></textarea>
          </dr-field>
        </form>
        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" class="btn btn-danger btn-lg sm:flex-1" [disabled]="busy() || reviewForm.invalid" (click)="decide(false)">Rechazar</button>
          <button type="button" class="btn btn-primary btn-lg sm:flex-[1.6]" [disabled]="busy() || reviewForm.invalid" (click)="decide(true)">
            @if (busy()) { <span class="spinner"></span> } @else { <dr-icon name="check" /> } Aprobar y acreditar
          </button>
        </div>
      </dr-modal>
    }
  `,
})
export class TopupsPage {
  readonly module = input<'RecargaSaldo'|'EfectivoMovil'|'Deuna'>('RecargaSaldo');
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly money = money;
  protected readonly shortDateTime = shortDateTime;
  protected readonly kind = signal<'RecargaSaldo'|'EfectivoMovil'|'Deuna'>('RecargaSaldo');
  protected readonly deunaStep = signal(1);
  protected readonly title = () => ({RecargaSaldo:'Recargas de saldo',EfectivoMovil:'Efectivo Móvil',Deuna:'Deuna · Pago con QR'} as Record<string,string>)[this.kind()];
  protected readonly actionTitle = () => ({RecargaSaldo:'Acreditar por depósito o transferencia',EfectivoMovil:'Registrar orden de Efectivo Móvil',Deuna:'Confirmar pago realizado'} as Record<string,string>)[this.kind()];
  protected readonly moduleIcon = () => ({RecargaSaldo:'wallet',EfectivoMovil:'phone',Deuna:'qr'} as Record<string,string>)[this.kind()];
  protected readonly qrPreview = signal<SafeResourceUrl>(this.sanitizer.bypassSecurityTrustResourceUrl('/deuna-qr-placeholder.svg'));
  protected readonly qrPdf = signal(false);

  protected readonly items = signal<TopUp[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly reviewing = signal<TopUp | null>(null);
  protected readonly reviewError = signal('');
  protected readonly amountWarning = signal<string | null>(null);

  protected readonly form = this.fb.group({
    kind: ['RecargaSaldo'],
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(50000), DrValidators.decimals(2)]],
    bank: [''], reference: [''], depositorName: [''], senderName: [''], transactionReference: [''], phoneNumber: [''], beneficiaryName: [''], withdrawalCode: [''], beneficiaryCode: [''],
  });
  protected readonly reviewForm = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/.*\S.*/)]] });
  private key = crypto.randomUUID();
  private fingerprint = '';
  private loadGeneration = 0;

  constructor() {
    effect(() => {
      this.session.changes();
      const module = this.module();
      untracked(() => {
        this.setKind(module);
        if (module === 'Deuna') void this.loadQr();
        void this.load();
      });
    });
    this.form.controls.amount.valueChanges.subscribe(v =>
      this.amountWarning.set(v && v >= 10000 && v <= 50000 ? 'Depósitos altos pueden requerir validación adicional del comprobante.' : null));
  }

  async load() {
    const generation = ++this.loadGeneration;
    const kind = this.kind();
    this.loading.set(true);
    try {
      const data = await this.api.get<Page<TopUp>>('/topups?page=' + this.page() + '&kind=' + encodeURIComponent(kind));
      if (generation !== this.loadGeneration || kind !== this.kind()) return;
      this.items.set(data.items);
      this.total.set(data.total);
    } catch (e) { if (generation === this.loadGeneration) this.toasts.error('No se pudieron cargar las solicitudes de ' + this.topupName(kind), errorText(e)); } finally { if (generation === this.loadGeneration) this.loading.set(false); }
  }

  protected async create() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body = { kind: v.kind, amount: Number(v.amount), bank: v.bank.trim(), reference: v.reference.trim(), depositorName:v.depositorName.trim(), senderName:v.senderName.trim(), transactionReference:v.transactionReference.trim(), phoneNumber:v.phoneNumber.trim(), beneficiaryName:v.beneficiaryName.trim(), withdrawalCode:v.withdrawalCode, beneficiaryCode:v.beneficiaryCode };
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.fingerprint) { this.key = crypto.randomUUID(); this.fingerprint = fingerprint; }
    this.busy.set(true);
    try {
      await this.api.post('/topups', body, { 'Idempotency-Key': this.key });
      this.toasts.success('Solicitud registrada', 'El saldo se acreditará cuando Administración u Operación validen la transacción.');
      this.form.reset({kind:this.kind(),amount:null,bank:'',reference:'',depositorName:'',senderName:'',transactionReference:'',phoneNumber:'',beneficiaryName:'',withdrawalCode:'',beneficiaryCode:''});
      this.deunaStep.set(1);
      this.page.set(1);
      await Promise.all([this.load(), this.session.refresh()]);
    } catch (e) { this.toasts.error('No se pudo registrar la recarga', errorText(e)); } finally { this.busy.set(false); }
  }

  protected openReview(t: TopUp) { this.reviewForm.reset(); this.reviewError.set(''); this.reviewing.set(t); }

  protected setKind(value: 'RecargaSaldo'|'EfectivoMovil'|'Deuna') {
    this.kind.set(value);
    const c=this.form.controls;
    c.kind.setValue(value);
    c.bank.setValidators(value==='RecargaSaldo'?[Validators.required]:[]);c.reference.setValidators(value==='RecargaSaldo'?[Validators.required,Validators.minLength(3)]:[]);c.depositorName.setValidators(value==='RecargaSaldo'?[Validators.required,Validators.minLength(3)]:[]);
    c.senderName.setValidators(value==='Deuna'?[Validators.required,Validators.minLength(3)]:[]);c.transactionReference.setValidators(value==='Deuna'?[Validators.required,Validators.minLength(3)]:[]);
    c.withdrawalCode.setValidators(value==='EfectivoMovil'?[Validators.required]:[]);c.beneficiaryCode.setValidators(value==='EfectivoMovil'?[Validators.required]:[]);c.phoneNumber.setValidators(value==='EfectivoMovil'?[Validators.required,DrValidators.mobile()]:[]);c.beneficiaryName.setValidators(value==='EfectivoMovil'?[Validators.required,Validators.minLength(3)]:[]);
    for(const control of [c.bank,c.reference,c.depositorName,c.senderName,c.transactionReference,c.withdrawalCode,c.beneficiaryCode,c.phoneNumber,c.beneficiaryName])control.updateValueAndValidity();
  }
  protected topupName(kind:string){return ({RecargaSaldo:'Recarga bancaria',EfectivoMovil:'Efectivo Móvil',Deuna:'Deuna'} as Record<string,string>)[kind]??kind;}
  protected summary(t: TopUp) {
    if (t.kind === 'RecargaSaldo') return [t.bank, t.depositorName, t.reference].filter(Boolean).join(' · ');
    if (t.kind === 'EfectivoMovil') return [t.phoneNumber, t.beneficiaryName].filter(Boolean).join(' · ');
    return [t.senderName, t.transactionReference].filter(Boolean).join(' · ');
  }
  protected reviewTitle(kind: string) { return kind === 'EfectivoMovil' ? 'Validar Efectivo Móvil' : kind === 'Deuna' ? 'Validar pago Deuna' : 'Validar recarga'; }
  protected reviewInstruction(kind: string) {
    if (kind === 'EfectivoMovil') return 'Confirma fuera de DepoRet que la orden de Banco Guayaquil fue cobrada con ambos códigos antes de acreditar el saldo.';
    if (kind === 'Deuna') return 'Confirma el pago con su referencia en el canal de conciliación de Banco Pichincha antes de acreditar el saldo.';
    return 'Confirma el depósito o transferencia y su comprobante en la cuenta receptora antes de acreditar el saldo.';
  }
  private async loadQr(){try{const blob=await this.api.blob('/settings/deuna-qr');this.qrPdf.set(blob.type==='application/pdf');this.qrPreview.set(this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob)));}catch{/* shown with configured placeholder */}}

  protected async decide(approve: boolean) {
    this.busy.set(true);
    this.reviewError.set('');
    try {
      await this.api.post(`/topups/${this.reviewing()!.id}/review`, { approve, reason: this.reviewForm.getRawValue().reason.trim() });
      this.toasts.success(approve ? 'Recarga aprobada' : 'Recarga rechazada', approve ? 'El saldo fue acreditado al cliente.' : 'El cliente verá el motivo registrado.');
      this.reviewing.set(null);
      await Promise.all([this.load(), this.session.refresh()]);
    } catch (e) { this.reviewError.set(errorText(e)); } finally { this.busy.set(false); }
  }
}
