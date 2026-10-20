import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Session } from '../core/session';
import { Dialogs } from '../core/dialogs';
import { dateTime, money, shortId } from '../core/format';
import { Payment } from '../core/models';
import { Icon } from '../ui/icon';
import { Modal } from '../ui/modal';
import { StatusBadge } from '../ui/status';

@Component({
  selector: 'dr-receipt-dialog',
  imports: [Modal, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = payment();
    <dr-modal [heading]="headline()" eyebrow="Constancia de operación" [subtitle]="session.serviceName(p.kind) + ' · ' + dateTime(p.createdAt)" size="sm" (closed)="closed.emit()">
      <div class="flex flex-col items-center py-2 text-center">
        <span class="inline-flex size-14 items-center justify-center rounded-full"
              [class]="p.status === 'Liquidada' ? 'bg-emerald-50 text-emerald-600' : p.status === 'Rechazada' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'">
          <dr-icon class="size-7" [name]="p.status === 'Liquidada' ? 'check-circle' : p.status === 'Rechazada' ? 'alert-circle' : 'clock'" />
        </span>
        <p class="num mt-4 text-4xl font-bold tracking-[-0.03em] text-ink-950">{{ money(p.total) }}<span class="ml-1.5 text-sm font-medium tracking-normal text-ink-400">USD</span></p>
        <dr-status class="mt-3" [value]="p.status" />
      </div>
      <dl class="mt-5 divide-y divide-dashed divide-ink-200 border-y border-dashed border-ink-200 text-sm">
        @for (row of rows(); track row[0]) {
          <div class="flex justify-between gap-6 py-2.5"><dt class="shrink-0 text-ink-500">{{ row[0] }}</dt><dd class="num break-words text-right font-medium text-ink-900">{{ row[1] }}</dd></div>
        }
      </dl>
      <p class="mt-3 text-center"><code class="rounded-md bg-ink-50 px-2 py-1 text-ink-500">{{ p.id }}</code></p>
      <div class="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" class="btn btn-secondary" [disabled]="!!dialogs.pdfBusy()" (click)="preview()">
          @if (dialogs.pdfBusy() === path()) { <span class="spinner"></span> } @else { <dr-icon name="eye" /> } Ver PDF
        </button>
        <button type="button" class="btn btn-primary" [disabled]="!!dialogs.pdfBusy()" (click)="dialogs.downloadPdf(path(), filename())"><dr-icon name="download" /> Descargar PDF</button>
      </div>
      <p class="mt-4 text-center text-xs leading-relaxed text-ink-400">Constancia interna sin validez tributaria. {{ p.simulated ? 'Operación de Sandbox sin dinero real.' : 'Verifica la referencia de liquidación bancaria.' }}</p>
    </dr-modal>
  `,
})
export class ReceiptDialog {
  readonly payment = input.required<Payment>();
  readonly closed = output<void>();
  protected readonly session = inject(Session);
  protected readonly dialogs = inject(Dialogs);
  protected readonly money = money;
  protected readonly dateTime = dateTime;

  protected readonly path = computed(() => `/payments/${this.payment().id}/receipt`);
  protected readonly filename = computed(() => `deporet-constancia-${shortId(this.payment().id)}.pdf`);
  protected readonly headline = computed(() => ({ Liquidada: '¡Operación liquidada!', Procesando: 'Operación en proceso', Rechazada: 'Operación rechazada' } as Record<string, string>)[this.payment().status] ?? 'Operación registrada');
  protected readonly rows = computed(() => {
    const p = this.payment();
    return [
      ['Destinatario', p.recipient], ['Referencia', p.reference], ['Monto', money(p.amount)], ['Comisión', money(p.fee)],
      [`IVA comisión (${p.taxRate * 100}%)`, money(p.tax)],
      ['Liquidación', p.providerReference || 'Pendiente de revisión'],
      ...(p.reviewNote ? [['Revisión', p.reviewNote]] : []),
    ] as [string, string][];
  });

  protected async preview() {
    const p = this.payment();
    await this.dialogs.previewPdf(this.path(), this.filename(), 'Constancia de operación', `${this.session.serviceName(p.kind)} · ${money(p.total)}`);
    if (this.dialogs.pdf()) this.closed.emit();
  }
}
