import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { money } from '../core/format';
import { Payment } from '../core/models';
import { Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Modal } from '../ui/modal';
import { Toasts } from '../ui/toast';

/** Settlement decision for a reserved operation (executive / administrator). */
@Component({
  selector: 'dr-review-dialog',
  imports: [ReactiveFormsModule, Modal, Field, FieldControl, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = payment();
    <dr-modal heading="Liquidar operación" eyebrow="Revisión" icon="shield" [subtitle]="session.serviceName(p.kind) + ' · ' + p.recipient" [dismissible]="!busy()" (closed)="closed.emit()">
      <dl class="rounded-2xl bg-ink-50 p-4 text-sm">
        <div class="flex justify-between gap-4 py-1"><dt class="text-ink-500">Referencia</dt><dd class="break-all text-right font-medium text-ink-900">{{ p.reference }}</dd></div>
        <div class="flex justify-between gap-4 py-1"><dt class="text-ink-500">Monto</dt><dd class="num font-medium text-ink-900">{{ money(p.amount) }}</dd></div>
        <div class="flex justify-between gap-4 py-1"><dt class="text-ink-500">Comisión + IVA</dt><dd class="num font-medium text-ink-900">{{ money(p.fee + p.tax) }}</dd></div>
        <div class="mt-2 flex items-baseline justify-between gap-4 border-t border-dashed border-ink-200 pt-3"><dt class="font-semibold text-ink-900">Total reservado</dt><dd class="num text-xl font-bold text-ink-950">{{ money(p.total) }}</dd></div>
      </dl>
      @if (error()) { <div class="alert alert-error mt-4" role="alert"><dr-icon name="alert-circle" />{{ error() }}</div> }
      <form [formGroup]="form" class="mt-5 space-y-4" novalidate>
        <dr-field label="Referencia bancaria de liquidación" hint="Obligatoria para aprobar. Número de la operación externa.">
          <input drControl id="review-bank" formControlName="bankReference" maxlength="100" autocomplete="off" />
        </dr-field>
        <dr-field label="Motivo de la decisión" [showSuccess]="false">
          <textarea drControl id="review-reason" formControlName="reason" maxlength="200" rows="3"></textarea>
        </dr-field>
        <label class="check-label">
          <input type="checkbox" class="check" formControlName="confirmExecuted" />
          Confirmo que la operación bancaria externa fue ejecutada con éxito{{ session.mode() === 'Sandbox' ? ' (simulada en Sandbox)' : '' }}.
        </label>
      </form>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" class="btn btn-danger btn-lg sm:flex-1" [disabled]="busy() || !form.controls.reason.valid" (click)="decide(false)">Rechazar</button>
        <button type="button" class="btn btn-primary btn-lg sm:flex-[1.6]" [disabled]="busy() || form.invalid || !form.value.confirmExecuted || !form.value.bankReference?.trim()" (click)="decide(true)">
          @if (busy()) { <span class="spinner"></span> } @else { <dr-icon name="check" /> } Confirmar liquidación
        </button>
      </div>
      <p class="mt-4 text-center text-xs text-ink-400">La decisión quedará registrada en auditoría.</p>
    </dr-modal>
  `,
})
export class ReviewDialog {
  readonly payment = input.required<Payment>();
  readonly closed = output<void>();
  readonly decided = output<void>();
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    bankReference: ['', [Validators.maxLength(100)]],
    reason: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/.*\S.*/)]],
    confirmExecuted: [false],
  });

  protected async decide(approve: boolean) {
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      await this.api.post(`/payments/${this.payment().id}/review`, { approve, reason: v.reason.trim(), bankReference: v.bankReference.trim(), confirmExecuted: v.confirmExecuted });
      this.toasts.success(approve ? 'Operación liquidada' : 'Operación rechazada', approve ? 'La referencia bancaria quedó registrada.' : 'La reserva fue liberada.');
      this.decided.emit();
    } catch (e) { this.error.set(errorText(e)); } finally { this.busy.set(false); }
  }
}
