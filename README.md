# DepoRet

Plataforma financiera para Ecuador con **ASP.NET Core / .NET 10, Angular 21 y PostgreSQL 18**. Interfaz en español, operaciones en USD y colores blanco, negro, azul marino y magenta.

Esta entrega registra operaciones y saldos lógicos en PostgreSQL. Una instalación nueva usa **liquidación manual**: el banco/proveedor se verifica fuera de DepoRet y un administrador u operador deja constancia de aprobación o rechazo. DepoRet aún no envía transferencias al banco, no cobra directamente ni tiene contrato real de Equifax; los saldos solo se vuelven reales después de configurar una fuente de fondos verificada y conciliarla. Equifax comienza en Sandbox y devuelve datos de demostración. No emite documentos autorizados por el SRI. La instancia local existente sigue en modo Sandbox porque contiene cuentas y saldos ficticios; no convertir esos saldos en dinero real.

## Funciones incluidas

- Inicio de sesión con contraseñas hash, JWT de 30 minutos, límite de intentos y revocación al desactivar al usuario o cambiar su rol. El frontend guarda el token únicamente en memoria.
- Cliente: saldo, transferencias y giros nacionales con comisión fija de $0.45; recargas bancarias gratuitas; solicitudes pendientes de Efectivo Móvil (Banco Guayaquil) y Deuna (Banco Pichincha); consulta Equifax y constancias.
- Operador: bandeja global de transacciones, acreditaciones pendientes y auditoría; puede aprobar o rechazar con motivo.
- Administrador: acceso operativo, cambio de roles/estado de usuarios, auditoría y consulta de parámetros e integraciones.
- Consulta Equifax: servicio activable por administración, configuración Sandbox/Producción con credenciales cifradas, prueba de conectividad sin enviar credenciales, autorización y reporte PDF. Sandbox usa datos ficticios y el reporte advierte que no es emitido por Equifax.
- Backoffice de acreditaciones pendientes, aprobación/rechazo por administrador u operador, auditoría y carga del QR Deuna. Los códigos de Efectivo Móvil se cifran en PostgreSQL y solo se revelan a quienes revisan mientras la solicitud esté pendiente.
- Revisión previa del monto y la comisión; exportación CSV de la página actual y paginación del historial.
- Libro de movimientos con partida doble, operaciones atómicas, bloqueo por cuenta e idempotencia.
- Formularios dedicados para Transferencias, Giros, Recargas, Efectivo Móvil y Deuna. Historial, revisión y panel operativo con navegación responsive; los flujos principales no se abren en popups.

## Ejecutar con Docker

Requisitos: Docker Engine/Desktop con Compose y PowerShell 7 para generar el archivo de entorno.

```powershell
docker compose up --build -d
```

Abrir **http://localhost:8088**. El puerto web está ligado únicamente a localhost; la base y la API no publican puertos. La base conserva datos en el volumen `pgdata`. En una base nueva Compose usa `Manual`, no crea saldos ficticios y provisiona una sola cuenta administradora con contraseña aleatoria almacenada en el volumen de secretos. Equifax permanece en Sandbox. El perfil local `.env.example` muestra estos valores.

Para recuperar la contraseña inicial en una instalación manual nueva: `docker compose exec api cat /run/deporet/bootstrap-password`. Si `.env` define `BOOTSTRAP_ADMIN_EMAIL`, ese es el correo inicial (por defecto `admin@deporet.test`). Un reinicio no vuelve a crear usuarios ni cambia saldos.

La instalación ya existente de este workspace conserva `PAYMENTS_MODE=Sandbox` y sus cuentas/saldos de prueba por separado. No cambies esa variable a `Manual` para reutilizar los saldos sembrados como fondos reales; migra únicamente con una conciliación explícita.

Para detener sin borrar datos: `docker compose down`. No eliminar el volumen para reiniciar habitualmente.

## Ejecutar localmente sin Docker

Requisitos: SDK .NET 10, Node 24 y PowerShell 7. Para el servidor de PostgreSQL de desarrollo se usa el paquete `embedded-postgres`, únicamente como lanzador de una instancia real de PostgreSQL; no sustituye la base por memoria o SQLite.

```powershell
./scripts/setup-env.ps1
npm.cmd install --prefix .local embedded-postgres@18.4.0-beta.17 --no-audit --no-fund
npm.cmd ci --prefix frontend
dotnet tool restore
dotnet build
```

Ejecutar cada comando siguiente en una terminal separada desde la raíz:

```powershell
node scripts/start-local-db.mjs
./scripts/start-api.ps1
npm.cmd start --prefix frontend
```

Web: **http://127.0.0.1:4200**. API: **http://127.0.0.1:5080/api/health**. PostgreSQL: `127.0.0.1:55432`. Los datos locales permanecen en `.local/pgdata`; no modifica una instalación o base PostgreSQL existente. Ctrl+C detiene cada proceso; el lanzador de la base realiza un cierre ordenado.

Para usar una base PostgreSQL propia, definir `ConnectionStrings__Database`, `Auth__SigningKey` (48 caracteres como mínimo), `Bootstrap__Email`, `Bootstrap__Password` (12 caracteres como mínimo) y `Database__MigrateOnStartup=true`. Para crear datos demostrativos, usar únicamente una base nueva con `Payments__Mode=Sandbox` y `Sandbox__Seed=true`. No usar `start-api.ps1` para una operación manual real, porque fija el modo de demostración.

## Cuentas de prueba

| Perfil | Correo |
|---|---|
| Administrador | `admin@depored.test` |
| Operador | `ejecutivo@depored.test` |
| Segundo operador | `ejecutivo2@depored.test` |
| Cliente | `cliente@depored.test` |
| Segundo cliente | `cliente2@depored.test` |

Las cuentas de esta tabla pertenecen al perfil de prueba de la instalación local, usan una contraseña sandbox común aleatoria y tienen saldos ficticios. Recupérala con `docker compose exec api cat /run/deporet/sandbox-password`. No uses estas cuentas en producción. Una instalación manual nueva crea solo la cuenta admin del `.env` y utiliza el secreto bootstrap descrito arriba.

## Validación

```powershell
dotnet build
npm.cmd run build --prefix frontend
# Con PostgreSQL local activo y backend compilado:
node tests/integration.mjs
```

Las pruebas crean una base temporal `depored_test_*`, arrancan una API aislada en el puerto 5081 y eliminan exclusivamente esa base al terminar. No alteran la base de la demostración. Resultados en `test-results/integration.json`.

Se verifican permisos, acceso entre clientes, validación matemática de cédula, comisión fija, límites, aprobación concurrente, idempotencia, saldo bajo concurrencia, consentimiento, invalidación de sesión y conciliación de asientos. Véase [la verificación de esta entrega](docs/VERIFICACION.md).

## Estructura

```text
backend/DepoRed.Api/  API, dominio, servicios, migraciones PostgreSQL
frontend/            Angular 21 y proxy Nginx
scripts/             Configuración y arranque local
tests/               Pruebas HTTP y contables sobre PostgreSQL real
docs/                Arquitectura, alcance regulatorio y verificación
compose.yaml         Web + API + PostgreSQL
```

## Alcance para producción

El modo `Manual` registra instrucciones y somete las operaciones a verificación externa antes de que un operador o administrador decida. No envía transferencias al banco, mueve fondos ni activa por sí solo una integración productiva. Equifax debe permanecer en Sandbox hasta contar con el contrato, especificación de API, credenciales aprobadas y pruebas con el proveedor; guardar credenciales no sustituye esa integración. Esta versión no es un sistema bancario certificado ni una implementación completa de cumplimiento normativo. La puesta en operación real requiere definir autorizaciones aplicables, KYC/AML, autenticación reforzada, conciliación y reversos, facturación electrónica, privacidad, continuidad y seguridad.

Consultar [arquitectura y decisiones](docs/ARQUITECTURA.md) y [matriz de Ecuador con fuentes oficiales](docs/ECUADOR.md). No cambiar únicamente una variable para intentar operar en producción.
