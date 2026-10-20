import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { money } from '../core/format';
import { Payment, Quote, Service } from '../core/models';
import { DrValidators, Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Toasts } from '../ui/toast';

@Component({
  selector: 'dr-transaction-page',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl">
      <header class="mb-6">
        <p class="eyebrow">{{ quote() ? 'Paso 2 de 2 · Revisa y confirma' : 'Paso 1 de 2 · Datos de la operación' }}</p>
        <h1 class="page-title mt-2">{{ service().name }}</h1>
        <p class="page-lead">{{ quote() ? 'Verifica el destino y el total antes de enviar la solicitud.' : service().description }}</p>
      </header>
      <div class="card card-pad">
      <ol class="mb-5 grid grid-cols-2 gap-2" aria-hidden="true">
        <li class="h-1.5 rounded-full bg-brand-600"></li>
        <li class="h-1.5 rounded-full transition-colors duration-300" [class]="quote() ? 'bg-brand-600' : 'bg-ink-100'"></li>
      </ol>

      @if (error()) { <div class="alert alert-error mb-4" role="alert"><dr-icon name="alert-circle" />{{ error() }}</div> }

      @if (!quote()) {
        <form [formGroup]="form" (ngSubmit)="review()" class="space-y-4" novalidate>
          <dr-field label="Nombres y apellidos del beneficiario / razón social"><input drControl id="pay-recipient" formControlName="recipient" maxlength="120" autocomplete="name" autofocus /></dr-field>
          <div class="grid gap-3 sm:grid-cols-2">
            <dr-field label="Tipo de documento"><select drControl id="pay-document-type" formControlName="documentType"><option value="Cedula">Cédula</option><option value="RUC">RUC</option>@if(service().id === 'giro'){<option value="Pasaporte">Pasaporte</option>}</select></dr-field>
            <dr-field label="Número de documento"><input drControl id="pay-document-number" formControlName="documentNumber" maxlength="13" inputmode="numeric" autocomplete="off" /></dr-field>
          </div>
          @if(service().id === 'giro'){
            <dr-field label="Método de entrega"><select drControl id="pay-delivery" formControlName="deliveryMethod"><option value="DepositoCuenta">Depósito en cuenta bancaria</option><option value="RetiroEfectivo">Retiro en efectivo / ventanilla</option></select></dr-field>
            <dr-field label="Motivo del giro"><input drControl id="pay-reference" formControlName="reference" maxlength="80" autocomplete="off" /></dr-field>
          }
          @if(service().id === 'transferencia' || form.controls.deliveryMethod.value === 'DepositoCuenta'){
            <div class="grid gap-3 sm:grid-cols-2">
              <dr-field label="Institución financiera"><select drControl id="pay-bank" formControlName="bankName"><option value="">Selecciona un banco</option>@for(b of session.banks();track b){<option [value]="b">{{b}}</option>}</select></dr-field>
              <dr-field label="Tipo de cuenta"><select drControl id="pay-account-type" formControlName="accountType"><option value="Ahorros">Ahorros</option><option value="Corriente">Corriente</option></select></dr-field>
            </div>
            <dr-field label="Número de cuenta" hint="Entre 8 y 12 dígitos."><input drControl id="pay-account-number" formControlName="accountNumber" maxlength="12" inputmode="numeric" autocomplete="off" /></dr-field>
          }
          <dr-field label="Monto en USD" prefix="$" [warning]="amountWarning()" [hint]="amountHint()">
            <input drControl id="pay-amount" class="num text-lg! font-semibold" type="number" inputmode="decimal" step="0.01" min="0.01" [max]="service().limit" formControlName="amount" />
          </dr-field>
          <button type="submit" class="btn btn-primary btn-lg btn-block mt-2" [disabled]="busy()">
            @if (busy()) { <span class="spinner"></span> Calculando… } @else { Revisar operación <dr-icon name="arrow" /> }
          </button>
        </form>
      } @else {
        @let q = quote()!;
        <div class="rounded-2xl bg-ink-50 p-4">
          <p class="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500">Destinatario</p>
          <p class="mt-1.5 text-base font-semibold text-ink-900">{{ form.value.recipient }}</p>
          <p class="mt-0.5 break-all text-sm text-ink-500">{{ form.value.deliveryMethod === 'RetiroEfectivo' ? 'Retiro en efectivo / ventanilla' : form.value.bankName + ' · ' + form.value.accountType }}</p>
        </div>
        <dl class="mt-4 space-y-2.5 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-ink-500">Monto</dt><dd class="num font-medium text-ink-900">{{ money(q.amount) }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-ink-500">Comisión</dt><dd class="num font-medium text-ink-900">{{ money(q.fee) }}</dd></div>
          @if(q.tax>0){<div class="flex justify-between gap-4"><dt class="text-ink-500">IVA sobre comisión</dt><dd class="num font-medium text-ink-900">{{ money(q.tax) }}</dd></div>}
          <div class="flex items-baseline justify-between gap-4 border-t border-dashed border-ink-200 pt-3.5">
            <dt class="font-semibold text-ink-900">Total a debitar</dt>
            <dd class="num text-2xl font-bold tracking-tight text-ink-950">{{ money(q.total) }} <span class="text-xs font-medium text-ink-400">USD</span></dd>
          </div>
        </dl>
        @if (q.requiresReview) {
          <div class="alert alert-info mt-4"><dr-icon name="info" /><span>El total se reserva de inmediato. La operación quedará <strong>Procesando</strong> hasta que un operador confirme la ejecución bancaria; si se rechaza, se libera la reserva.</span></div>
        }
        <label class="check-label mt-5">
          <input type="checkbox" class="check" [checked]="accepted()" (change)="accepted.set($any($event.target).checked)" />
          Confirmo los datos y acepto el monto, la comisión fija de $0.45 y el IVA aplicable.
        </label>
        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" class="btn btn-secondary btn-lg sm:flex-1" [disabled]="busy()" (click)="edit()"><dr-icon name="chevron-left" /> Editar</button>
          <button type="button" class="btn btn-primary btn-lg sm:flex-[2]" [disabled]="busy() || !accepted()" (click)="confirm()">
            @if (busy()) { <span class="spinner"></span> Procesando… } @else { <dr-icon name="check" /> Solicitar operación }
          </button>
        </div>
      }
      <p class="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-400"><dr-icon name="lock" class="size-3.5" />
        {{ session.mode() === 'Sandbox' ? 'Entorno de demostración · no se mueve dinero real' : 'Validación física y bancaria a cargo de operación' }}</p>
      </div>
    </section>
  `,
})
export class TransactionPage implements OnInit {
  readonly kind = input<'transferencia'|'giro'>('transferencia');
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly service = computed<Service>(() => this.session.services().find(s => s.id === this.kind()) ?? { id: this.kind(), name: this.kind() === 'giro' ? 'Giros Nacionales' : 'Transferencias', description: '', icon: 'arrows', fee: 0.45, limit: this.kind() === 'giro' ? 3000 : 5000 });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    recipient: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    documentType: ['Cedula', [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$|^\d{13}$/)]],
    bankName: ['', [Validators.required]],
    accountType: ['Ahorros', [Validators.required]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{8,12}$/)]],
    deliveryMethod: ['DepositoCuenta'],
    reference: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01), DrValidators.decimals(2)]],
  });
  private readonly amount = toSignal(this.form.controls.amount.valueChanges.pipe(startWith(null)));

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly quote = signal<Quote | null>(null);
  protected readonly accepted = signal(false);
  private payload: unknown = null;
  private requestKey = crypto.randomUUID();

  protected readonly amountHint = computed(() => `Máximo ${money(this.service().limit)} por operación · comisión fija $0.45 + IVA`);
  protected readonly amountWarning = computed(() => {
    const amount = Number(this.amount() ?? 0), s = this.service();
    if (!amount || amount > s.limit) return null;
    const available = this.session.dashboard()?.balance;
    if (available !== undefined && amount + s.fee * (1 + this.session.vatRate()) > available) return `Con comisión e IVA superaría tu saldo disponible (${money(available)}).`;
    if (amount >= s.limit * 0.8) return `Estás cerca del máximo por operación (${money(s.limit)}).`;
    return null;
  });

  ngOnInit() {
    const s = this.service(), c = this.form.controls;
    c.amount.addValidators(Validators.max(s.limit));
    c.bankName.setValue(this.session.banks()[0] ?? '');
    c.reference.setValidators(s.id === 'giro' ? [Validators.required, Validators.maxLength(80)] : []);
    c.accountNumber.setValidators(s.id === 'transferencia' || c.deliveryMethod.value === 'DepositoCuenta' ? [Validators.required, Validators.pattern(/^\d{8,12}$/)] : []);
    c.bankName.setValidators(s.id === 'transferencia' || c.deliveryMethod.value === 'DepositoCuenta' ? [Validators.required] : []);
    const setDocumentRule=()=>{const type=c.documentType.value;c.documentNumber.setValidators([Validators.required,type==='Cedula'?DrValidators.ecuadorianId():Validators.pattern(type==='RUC'?/^\d{13}$/:/^[A-Za-z0-9]{5,20}$/)]);c.documentNumber.updateValueAndValidity();};
    setDocumentRule();c.documentType.valueChanges.subscribe(setDocumentRule);
    c.deliveryMethod.valueChanges.subscribe(method => {
      const needsAccount = s.id === 'transferencia' || method === 'DepositoCuenta';
      for (const control of [c.bankName,c.accountType,c.accountNumber]) { control.setValidators(needsAccount ? [Validators.required] : []); control.updateValueAndValidity(); }
    });
    this.form.updateValueAndValidity();
  }

  protected async review() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const cash = this.service().id === 'giro' && v.deliveryMethod === 'RetiroEfectivo';
      const payload = { kind: this.service().id, amount: Number(v.amount), recipient: v.recipient.trim(), beneficiaryName: v.recipient.trim(), documentType: v.documentType, documentNumber: v.documentNumber, bankName: cash ? '' : v.bankName, accountType: cash ? '' : v.accountType, accountNumber: cash ? '' : v.accountNumber, deliveryMethod: v.deliveryMethod, reference: v.reference.trim(), acceptCharges: true };
      this.quote.set(await this.api.post<Quote>('/transactions/quote', payload));
      this.payload = payload;
      this.requestKey = crypto.randomUUID();
      this.accepted.set(false);
    } catch (e) { this.error.set(errorText(e)); } finally { this.busy.set(false); }
  }

  protected edit() { this.quote.set(null); this.accepted.set(false); this.error.set(''); }

  protected async confirm() {
    if (!this.accepted()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const endpoint=this.service().id==='transferencia'?'/transactions/transfer':'/transactions/national-remittance';
      const payment = await this.api.post<Payment>(endpoint, this.payload, { 'Idempotency-Key': this.requestKey });
      this.toasts.success('Operación registrada', `${this.service().name} por ${money(payment.total)} · ${payment.status}`);
      await this.router.navigateByUrl('/movimientos');
      await this.session.refresh();
    } catch (e) { this.error.set(errorText(e)); } finally { this.busy.set(false); }
  }
}
