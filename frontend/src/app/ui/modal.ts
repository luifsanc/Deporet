import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, input, OnDestroy, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/** Number of open dialogs, so stacked dialogs lock page scroll exactly once. */
let openDialogs = 0;
const FOCUSABLE ='button:not(:disabled),[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),iframe,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus trap, Escape to close, scroll lock and focus restore.
 * Renders as a bottom sheet on phones and a centered card from 640px.
 */
@Component({
  selector: 'dr-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <section #panel class="dialog" [class]="widthClass()" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <span class="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-200 sm:hidden" aria-hidden="true"></span>
        <header class="flex items-start gap-3 px-5 pb-1 pt-4 sm:px-7 sm:pt-6">
          @if (icon()) { <span class="icon-tile is-brand size-11 rounded-2xl"><dr-icon [name]="icon()" /></span> }
          <div class="min-w-0 flex-1">
            @if (eyebrow()) { <p class="eyebrow mb-1">{{ eyebrow() }}</p> }
            <h2 [id]="titleId" class="text-xl font-bold tracking-[-0.02em]">{{ heading() }}</h2>
            @if (subtitle()) { <p class="mt-1 text-sm text-ink-500">{{ subtitle() }}</p> }
          </div>
          <button type="button" class="btn btn-icon -mr-2 -mt-1" [disabled]="!dismissible()" (click)="closed.emit()" aria-label="Cerrar"><dr-icon name="close" /></button>
        </header>
        <div #body class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3 sm:px-7 sm:pb-7"><ng-content /></div>
        <ng-content select="[footer]" />
      </section>
    </div>
  `,
})
export class Modal implements OnDestroy {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly eyebrow = input('');
  readonly icon = input('');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly dismissible = input(true);
  readonly closed = output<void>();

  protected readonly titleId = 'dlg-' + Math.random().toString(36).slice(2, 8);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly previous = document.activeElement as HTMLElement | null;

  constructor() {
    if (openDialogs++ === 0) document.body.style.overflow = 'hidden';
    afterNextRender(() => {
      const body = this.body().nativeElement;
      const target = body.querySelector<HTMLElement>('[autofocus]') ?? body.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? this.panel().nativeElement.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    });
  }

  protected widthClass() {
    return { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-5xl' }[this.size()];
  }

  protected onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget && this.dismissible()) this.closed.emit();
  }

  protected onKey(event: KeyboardEvent) {
    const panel = this.panel().nativeElement;
    if (event.key === 'Escape' && this.dismissible()) { event.preventDefault(); this.closed.emit(); return; }
    if (event.key !== 'Tab') return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { first.focus(); event.preventDefault(); }
  }

  ngOnDestroy() {
    if (--openDialogs === 0) document.body.style.overflow = '';
    if (this.previous?.isConnected) this.previous.focus();
  }
}
