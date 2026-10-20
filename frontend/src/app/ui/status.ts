import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'brand';

const STATUS: Record<string, { tone: Tone; pulse?: boolean }> = {
  Liquidada: { tone: 'success' },
  Aprobada: { tone: 'success' },
  Completado: { tone: 'success' },
  Verificada: { tone: 'success' },
  Activo: { tone: 'success' },
  Procesando: { tone: 'info', pulse: true },
  Pendiente: { tone: 'warning' },
  Rechazada: { tone: 'danger' },
  Inactivo: { tone: 'danger' },
  Reembolsado: { tone: 'neutral' },
  Sandbox: { tone: 'warning' },
  Produccion: { tone: 'brand' },
};

/** Colour-coded status pill used by every transactional table. */
@Component({
  selector: 'dr-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge-' + meta().tone"><span class="badge-dot" [class.is-pulse]="meta().pulse"></span>{{ label() || value() }}</span>`,
})
export class StatusBadge {
  readonly value = input.required<string>();
  readonly label = input('');
  protected readonly meta = computed(() => STATUS[this.value()] ?? { tone: 'neutral' as Tone });
}
