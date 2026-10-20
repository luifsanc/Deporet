import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { Icon } from './icon';

export interface ToastMessage { id: number; tone: 'success' | 'error' | 'info'; title: string; text?: string }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<ToastMessage[]>([]);
  private next = 1;

  success(title: string, text?: string) { this.push('success', title, text, 5000); }
  error(title: string, text?: string) { this.push('error', title, text, 8000); }
  info(title: string, text?: string) { this.push('info', title, text, 6000); }
  dismiss(id: number) { this.items.update(list => list.filter(t => t.id !== id)); }
  clear() { this.items.set([]); }

  private push(tone: ToastMessage['tone'], title: string, text: string | undefined, ttl: number) {
    const id = this.next++;
    this.items.update(list => [...list.slice(-3), { id, tone, title, text }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}

@Component({
  selector: 'dr-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed inset-x-3 top-3 z-[150] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:top-6' },
  template: `
    @for (t of toasts.items(); track t.id) {
      <div class="toast" [class]="t.tone === 'success' ? 'border-emerald-200' : t.tone === 'error' ? 'border-rose-200' : 'border-blue-200'"
           [attr.role]="t.tone === 'error' ? 'alert' : 'status'">
        <span class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
              [class]="t.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : t.tone === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'">
          <dr-icon class="size-[1.125rem]" [name]="t.tone === 'success' ? 'check-circle' : t.tone === 'error' ? 'alert-circle' : 'info'" />
        </span>
        <div class="min-w-0 flex-1 pt-1">
          <p class="font-semibold text-ink-900">{{ t.title }}</p>
          @if (t.text) { <p class="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{{ t.text }}</p> }
        </div>
        <button type="button" class="btn btn-icon -mr-1 -mt-1 size-8" (click)="toasts.dismiss(t.id)" aria-label="Cerrar notificación"><dr-icon class="size-4" name="close" /></button>
      </div>
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(Toasts);
}
