import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

/**
 * Lightweight tooltip rendered into <body> so it is never clipped by scrolling containers
 * (e.g. the collapsed sidebar). Shown on hover and keyboard focus.
 */
@Directive({
  selector: '[drTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(focusin)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusout)': 'hide()',
    '(click)': 'hide()',
  },
})
export class Tooltip implements OnDestroy {
  readonly drTooltip = input('');
  readonly tooltipEnabled = input(true);
  readonly tooltipSide = input<'right' | 'bottom'>('right');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private tip?: HTMLElement;

  show() {
    if (!this.tooltipEnabled() || !this.drTooltip() || this.tip) return;
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = this.drTooltip();
    document.body.appendChild(tip);
    const r = this.host.nativeElement.getBoundingClientRect();
    if (this.tooltipSide() === 'right') {
      tip.style.left = `${r.right + 12}px`;
      tip.style.top = `${r.top + r.height / 2 - tip.offsetHeight / 2}px`;
    } else {
      tip.style.left = `${Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)}px`;
      tip.style.top = `${r.bottom + 8}px`;
    }
    this.tip = tip;
  }

  hide() {
    this.tip?.remove();
    this.tip = undefined;
  }

  ngOnDestroy() { this.hide(); }
}
