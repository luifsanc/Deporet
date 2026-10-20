# Esquema de datos y API

PostgreSQL usa `uuid` como identificador de entidades, `numeric(18,2)` para importes USD y `timestamptz` para fechas. La migración EF Core `EcuadorModulesV3` preserva los datos existentes. Las entidades adicionales de acceso y auditoría se describen al final.

## Tablas y relaciones

```text
users (1) ── (1) Accounts
  ├── (N) transactions
  ├── (N) TopUps
  ├── (N) CreditRequests
  ├── (N) CreditReports
  └── cartera: users.AssignedExecutiveId → users.Id

transactions (1) ── (N) Ledger
users (N) ── (1) Roles ── (N) RolePermissions ── (1) Permissions
equifax_config (credenciales y endpoint singleton)
platform_settings (QR Deuna y auditoría de configuración singleton)
Audit (registro de actor/acción/recurso)
Outbox (eventos de entrega)
```

| Tabla | Datos principales y reglas |
|---|---|
| `users` | Nombre, correo único, hash de contraseña, rol, estado/KYC, ejecutivo asignado, versión de seguridad y datos de perfil. |
| `Accounts` | `UserId` único, moneda USD, `Balance` y `Reserved`. Una solicitud de transferencia/giro bloquea la fila para reservar/liberar fondos sin sobregiro concurrente. |
| `transactions` | Tipo `transferencia` o `giro`; beneficiario, tipo/número de documento, banco, tipo/número de cuenta, método de entrega, referencia, principal, comisión, IVA, total, estado, idempotencia, simulación y revisión. Documento y número de cuenta se enmascaran en las respuestas. Solo se listan esos dos tipos. |
| `TopUps` | Tipo `RecargaSaldo`, `EfectivoMovil` o `Deuna`, monto, referencias y campos del emisor/beneficiario, estado y revisión. Claves idempotentes y referencias financieras tienen restricciones únicas parciales. Los dos códigos de Efectivo Móvil se guardan cifrados; la huella de solicitud previene reutilizar la misma orden. |
| `Ledger` | Asientos inmutables por lote y cuenta contable. La suma de débitos debe igualar créditos. Aprobación de acreditación aumenta cuenta del cliente contra `bank:deposits`; liquidación de transferencia carga al cliente y distribuye principal, comisión e IVA. |
| `equifax_config` | Entorno, endpoint, plantilla y mapeo de respuesta, estado habilitado, estado contractual y cabeceras. Client ID, API key y secret cifrados con ASP.NET Data Protection; la lectura pública nunca los devuelve. |
| `platform_settings` | Archivo QR activo de Deuna como `bytea`, MIME, nombre, fecha y usuario que lo cambió. Singleton `Id=platform`. |
| `CreditRequests` / `CreditReports` | Consentimiento versionado; reporte de prueba por usuario, costo, modo, estado y payload cifrado. El proveedor sandbox no devuelve un score oficial ni equivale a un reporte Equifax. |
| `Roles`, `Permissions`, `RolePermissions`, `Audit`, `Outbox` | Definiciones de roles/permisos, auditoría administrativa/financiera y eventos para notificación. |

## Validación de cédula ecuatoriana (módulo 10)

1. Debe tener exactamente diez dígitos; los dos primeros identifican una provincia de 01 a 24 y el tercer dígito debe ser menor que 6.
2. Sobre los primeros nueve dígitos, multiplicar posiciones 1, 3, 5, 7 y 9 (índice par desde cero) por 2; restar 9 a cada producto mayor que 9.
3. Sumar los nueve resultados. El verificador es `(10 - (suma % 10)) % 10`; debe coincidir con el décimo dígito.

La API aplica este control en transferencias y giros cuando el tipo es cédula. RUC se comprueba en esta versión por 13 dígitos numéricos; la identidad y vigencia completa del RUC o pasaporte deben verificarse con fuentes autorizadas en producción.

## API REST

Prefijo `/api`. Salvo login y health, se requiere `Authorization: Bearer <JWT>`. Toda creación financiera requiere encabezado `Idempotency-Key` UUID. La autorización se comprueba en el servidor por rol y permiso.

| Método y ruta | Acceso | Efecto |
|---|---|---|
| `GET /catalog` | autenticado | Catálogo de bancos, módulos de transferencia/giro, moneda y tasa fiscal configurada. |
| `POST /transactions/quote` | cliente `transactions.create` | Valida datos de beneficiario/cuenta y devuelve principal, comisión $0.45, IVA de comisión y total. No registra operación. |
| `POST /transactions/transfer` | cliente `transactions.create` | Crea transferencia `PENDING` y reserva total. Body exige `kind: transferencia`, `beneficiaryName`, `documentType`, `documentNumber`, `bankName`, `accountType`, `accountNumber`, `amount` y aceptación de cargos. |
| `POST /transactions/national-remittance` | cliente `transactions.create` | Crea giro `PENDING`, con `deliveryMethod: DepositoCuenta` y cuenta, o `RetiroEfectivo` sin cuenta; requiere `reference`/motivo. |
| `GET /payments`, `GET /payments/{id}` | cliente titular, operador o administrador | El cliente consulta sus operaciones; operador y administrador pueden auditar todas las pendientes. Identificadores de cuenta/documento enmascarados. |
| `POST /payments/{id}/review` | operador o administrador | Aprueba liquidación manualmente verificada con referencia bancaria o rechaza y libera reserva. |
| `POST /topups` | cliente `topups.create` | `kind` debe ser `RecargaSaldo`, `EfectivoMovil` o `Deuna`; crea pendiente sin comisión y sin acreditar saldo. |
| `GET /topups` | cliente titular, operador o administrador | Cliente ve sus solicitudes; operador y administrador ven solicitudes pendientes y pueden revisar códigos de Efectivo Móvil mientras estén pendientes. |
| `POST /topups/{id}/review` | operador o administrador `topups.approve` | Aprueba y acredita una vez o rechaza sin abono; registra libro y auditoría. |
| `GET /settings/deuna-qr/status` | `integrations.manage` | Estado de configuración QR para backoffice. |
| `GET /settings/deuna-qr` | `transactions.create` | Devuelve QR activo como imagen/PDF o `404` si aún no hay uno. |
| `PUT /settings/deuna-qr` | administrador | Carga multipart `file` PNG/JPG/PDF (máx. 5 MB); valida extensión, tipo y firma del archivo. |
| `POST /credit/reports`, `GET /credit/reports`, `GET /credit/reports/{id}/pdf` | titular `credit.request` | Solicita/consulta historial; requiere aceptación versionada. El sandbox es demostrativo; el costo de demo actual es $5. |
| `GET/PUT /integrations/equifax` | administración `integrations.manage` | Lee/guarda entorno, endpoint, client ID, credenciales cifradas, cabeceras y switch `Enabled`. Campos secretos vacíos conservan su valor. |
| `POST /integrations/equifax/test` | administrador | Sandbox confirma que es local; Producción valida host HTTPS sin enviar secretos o información personal. |

El cliente inicia cada flujo en una página propia (`/transferencias`, `/giros-nacionales`, `/recargas`, `/efectivo-movil`, `/deuna` y `/equifax`). La parametrización Equifax se encuentra en `/admin/config-equifax`; el servicio solo admite `Sandbox` o `Produccion` y permanece en Sandbox hasta que un administrador configure credenciales válidas y lo habilite.

Los endpoints de cotización y creación heredados `/payments/quote` y `POST /payments` permanecen como alias del prototipo, con la misma validación estricta y catálogo reducido. No aceptan tipos fuera de transferencias/giro.

## Estados y eventos de saldo

| Estado API | Significado | Evento/efecto |
|---|---|---|
| `PENDING` | Transferencia/giro reservada o acreditación entrante pendiente de verificación. | `payment.reserved` para salida; `topup.requested` para entrada. No se confirma una transferencia real en sandbox. |
| `APPROVED` | Pago aprobado como ejecutado o acreditación de entrada verificada. | Pago: consume reserva y contabiliza principal/comisión/IVA. Acreditación: suma monto al balance y registra lote de ledger. Emite notificación al titular y auditoría. |
| `REJECTED` | Operación denegada por revisor autorizado. | Pago: libera reserva sin cargar balance. Acreditación: no abona fondos. Se guarda motivo, actor, fecha y evento de auditoría. |

Las respuestas conservan `status` legible en español (`Procesando`, `Liquidada`, `Rechazada`; en recargas `Pendiente`, `Aprobada`, `Rechazada`) y añaden `statusCode` estable. Una aprobación de recarga requiere que el cliente siga activo y verificado. Estas reglas de demostración no sustituyen conciliación bancaria o confirmación autenticada del proveedor.
