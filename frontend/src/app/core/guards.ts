import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

/** Requires a session; otherwise sends the visitor to /login remembering the target. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(Session);
  return session.user() ? true : inject(Router).createUrlTree(['/login'], { queryParams: state.url && state.url !== '/' ? { next: state.url } : {} });
};

/** Requires the permission declared in route data; otherwise redirects to the first allowed page. */
export const permissionGuard: CanActivateFn = route => {
  const session = inject(Session);
  const permission = route.data['permission'] as string | undefined;
  const roles = route.data['allowedRoles'] as string[] | undefined;
  const roleAllowed = !roles || roles.includes(session.user()?.baseRole ?? '');
  return roleAllowed && (!permission || session.has(permission)) ? true : inject(Router).createUrlTree(['/', session.homePath()]);
};

export const homeRedirect: CanActivateFn = () => inject(Router).createUrlTree(['/', inject(Session).homePath()]);

export const guestGuard: CanActivateFn = () => {
  const session = inject(Session);
  return session.user() ? inject(Router).createUrlTree(['/', session.homePath()]) : true;
};
