import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

/** Visual pagination: range summary, previous/next and numbered pages with ellipses. */
@Component({
  selector: 'dr-paginator',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 border-t border-ink-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6' },
  template: `
    <p class="text-[0.8125rem] text-ink-500">
      @if (total()) { Mostrando <span class="num font-semibold text-ink-800">{{ from() }}–{{ to() }}</span> de <span class="num font-semibold text-ink-800">{{ total() }}</span> {{ noun() }} }
      @else { Sin resultados }
    </p>
    <nav class="flex items-center gap-1" aria-label="Paginación">
      <button type="button" class="btn btn-sm btn-ghost px-2" [disabled]="page() <= 1 || disabled()" (click)="go(page() - 1)" aria-label="Página anterior">
        <dr-icon name="chevron-left" /><span class="hidden sm:inline">Anterior</span>
      </button>
      @for (p of pages(); track $index) {
        @if (p === 0) { <span class="px-1 text-ink-400" aria-hidden="true">…</span> }
        @else {
          <button type="button" class="num inline-flex size-9 items-center justify-center rounded-lg text-[0.8125rem] font-medium transition"
                  [class]="p === page() ? 'bg-navy-900 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100'"
                  [attr.aria-current]="p === page() ? 'page' : null" [disabled]="disabled()" (click)="go(p)">{{ p }}</button>
        }
      }
      <button type="button" class="btn btn-sm btn-ghost px-2" [disabled]="page() >= pageCount() || disabled()" (click)="go(page() + 1)" aria-label="Página siguiente">
        <span class="hidden sm:inline">Siguiente</span><dr-icon name="chevron-right" />
      </button>
    </nav>
  `,
})
export class Paginator {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input(20);
  readonly noun = input('registros');
  readonly disabled = input(false);
  readonly pageChange = output<number>();

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  /** Page numbers to render; 0 marks an ellipsis. */
  protected readonly pages = computed(() => {
    const count = this.pageCount(), current = this.page();
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
    const set = new Set([1, count, current - 1, current, current + 1].filter(p => p >= 1 && p <= count));
    const sorted = [...set].sort((a, b) => a - b);
    return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [0, p] : [p]));
  });

  protected go(page: number) {
    if (page >= 1 && page <= this.pageCount() && page !== this.page()) this.pageChange.emit(page);
  }
}
