import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors?: Record<string, string[]>) { super(message); }
}

type Body = unknown;
interface Options { method?: string; body?: Body; headers?: Record<string, string>; form?: FormData }

const FALLBACK: Record<number, string> = {
  403: 'Tu perfil no tiene permiso para esta acción.',
  404: 'No encontramos el recurso solicitado.',
  409: 'La operación entra en conflicto con el estado actual.',
  429: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
};

/** Thin fetch client for /api. The bearer token lives only in memory. */
@Injectable({ providedIn: 'root' })
export class Api {
  token = '';
  /** Emits when an authenticated call is rejected with 401 (expired or revoked session). */
  readonly unauthorized = new Subject<void>();

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body?: Body, headers?: Record<string, string>) { return this.request<T>(path, { method: 'POST', body, headers }); }
  put<T>(path: string, body?: Body) { return this.request<T>(path, { method: 'PUT', body }); }
  patch<T>(path: string, body?: Body) { return this.request<T>(path, { method: 'PATCH', body }); }
  upload<T>(path: string, form: FormData) { return this.request<T>(path, { method: 'POST', form }); }
  putUpload<T>(path: string, form: FormData) { return this.request<T>(path, { method: 'PUT', form }); }

  async request<T>(path: string, { method = 'GET', body, headers = {}, form }: Options = {}): Promise<T> {
    const response = await this.send(path, method, body, headers, form);
    return (await response.json().catch(() => ({}))) as T;
  }

  /** Downloads a binary resource (PDF, image) with the session token. */
  async blob(path: string): Promise<Blob> {
    const response = await this.send(path, 'GET', undefined, {});
    return response.blob();
  }

  private async send(path: string, method: string, body: Body, headers: Record<string, string>, form?: FormData): Promise<Response> {
    let response: Response;
    try {
      response = await fetch('/api' + path, {
        method,
        headers: {
          ...(form || body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}),
          ...headers,
        },
        body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
    } catch {
      throw new ApiError('No pudimos conectar con DepoRet. Revisa tu conexión.', 0);
    }
    if (response.ok) return response;
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && this.token) {
      this.unauthorized.next();
      throw new ApiError('Tu sesión terminó. Vuelve a ingresar.', 401);
    }
    throw new ApiError(data.message || FALLBACK[response.status] || 'No se pudo completar la solicitud.', response.status, data.errors);
  }
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la solicitud.');
