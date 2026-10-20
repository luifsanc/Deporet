import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { dateTime, shortId } from '../core/format';
import { AuditEvent } from '../core/models';
import { Icon } from '../ui/icon';
import { Paginator } from '../ui/paginator';
import { Toasts } from '../ui/toast';

const PAGE = 20;

@Component({
  selector: 'dr-audit',
  imports: [FormsModule, Icon, Paginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Un registro de cada acción</p>
        <h1 class="page-title mt-2">Auditoría</h1>
        <p class="page-lead">Últimos 100 eventos de acceso y operación registrados por la API.</p>
      </div>
      <button type="button" class="btn btn-secondary" [disabled]="loading()" (click)="load()">@if (loading()) { <span class="spinner"></span> } @else { <dr-icon name="refresh" /> } Actualizar</button>
    </header>
    <section class="card mt-6 overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:p-5">
        <div class="relative sm:w-80">
          <dr-icon name="search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input type="search" class="h-10! pl-9!" placeholder="Filtrar por acción o recurso" [ngModel]="query()" (ngModelChange)="query.set($event); page.set(1)" aria-label="Filtrar eventos" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="table-modern min-w-[44rem]">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Actor</th><th>Recurso</th></tr></thead>
          <tbody>
            @for (a of visible(); track a.id) {
              <tr>
                <td class="num whitespace-nowrap text-ink-500">{{ dateTime(a.createdAt) }}</td>
                <td><span class="badge" [class]="tone(a.action)"><span class="badge-dot"></span>{{ a.action }}</span></td>
                <td><code class="text-ink-600">{{ a.actorId ? shortId(a.actorId) : 'Sistema' }}</code></td>
                <td class="max-w-80 break-all text-[0.8125rem] text-ink-600">{{ a.resource }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="py-12 text-center text-sm text-ink-500">{{ loading() ? 'Cargando eventos…' : 'Sin eventos para este filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <dr-paginator [page]="page()" [total]="filtered().length" [pageSize]="pageSize" noun="eventos" (pageChange)="page.set($event)" />
    </section>
  `,
})
export class AuditPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly dateTime = dateTime;
  protected readonly shortId = shortId;
  protected readonly pageSize = PAGE;
  protected readonly events = signal<AuditEvent[]>([]);
  protected readonly loading = signal(false);
  protected readonly query = signal('');
  protected readonly page = signal(1);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.events().filter(a => a.action.toLowerCase().includes(q) || a.resource.toLowerCase().includes(q)) : this.events();
  });
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * PAGE, this.page() * PAGE));

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    try { this.events.set(await this.api.get<AuditEvent[]>('/audit')); this.page.set(1); }
    catch (e) { this.toasts.error('No se pudo cargar la auditoría', errorText(e)); }
    finally { this.loading.set(false); }
  }

  protected tone(action: string) {
    if (/failed|rejected|refunded|recovered/.test(action)) return 'badge-danger';
    if (/settled|approved|completed|login/.test(action)) return 'badge-success';
    if (/reserved|requested|charged|exported/.test(action)) return 'badge-info';
    return 'badge-neutral';
  }
}
