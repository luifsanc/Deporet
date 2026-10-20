import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Session } from '../core/session';
import { Dialogs } from '../core/dialogs';
import { NAV, NavItem } from '../core/nav';
import { initials } from '../core/format';
import { Icon } from '../ui/icon';
import { Logo } from '../ui/logo';
import { Tooltip } from '../ui/tooltip';
import { ReceiptDialog } from '../dialogs/receipt-dialog';
import { PdfDialog } from '../dialogs/pdf-dialog';

const STORAGE_KEY = 'deporet.sidebar.collapsed';

@Component({
  selector: 'dr-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, Tooltip, ReceiptDialog, PdfDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  host: { '(document:keydown.escape)': 'closeMenus()', '(document:mousedown)': 'onOutside($event)' },
})
export class Shell {
  protected readonly session = inject(Session);
  protected readonly dialogs = inject(Dialogs);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(readCollapsed());
  protected readonly mobileOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly initials = computed(() => initials(this.session.user()?.name));

  private readonly url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)), { initialValue: this.router.url });
  protected readonly current = computed<NavItem | undefined>(() => {
    const path = this.url().split(/[?#]/)[0].replace(/^\//, '');
    return NAV.find(i => i.path === path);
  });
  protected readonly groups = computed(() => {
    const items = this.session.nav();
    return (['Principal', 'Gestión', 'Cuenta'] as const)
      .map(name => ({ name, items: items.filter(i => i.group === name) }))
      .filter(g => g.items.length);
  });
  protected readonly alerts = computed(() => {
    const d = this.session.dashboard();
    return (d?.pending ?? 0) + (this.session.has('topups.approve') ? d?.pendingTopups ?? 0 : 0);
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.closeMenus());
  }

  protected badge(item: NavItem): number {
    const d = this.session.dashboard();
    if (!d || !item.badge) return 0;
    if (item.badge === 'topups') return d.pendingTopups;
    // Staff see pending operations on the review queue, clients on their own history.
    if (item.path === 'movimientos') return this.session.isClient() ? d.pending : 0;
    return d.pending;
  }

  protected toggleCollapsed() {
    this.collapsed.update(c => !c);
    try { localStorage.setItem(STORAGE_KEY, String(this.collapsed())); } catch { /* storage may be unavailable */ }
  }

  protected closeMenus() {
    this.mobileOpen.set(false);
    this.notificationsOpen.set(false);
    this.profileOpen.set(false);
  }

  protected onOutside(event: MouseEvent) {
    if (!(this.notificationsOpen() || this.profileOpen())) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-menu]')) { this.notificationsOpen.set(false); this.profileOpen.set(false); }
  }

  protected logout() { this.session.logout(); }
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}
