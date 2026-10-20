# Arquitectura DepoRet

Angular 21 presenta la aplicación en español y consume una API ASP.NET Core sobre .NET 10. Entity Framework Core 10 y Npgsql almacenan la información en PostgreSQL. Nginx sirve los archivos estáticos y enruta `/api` en Docker; la interfaz y API tienen soporte de compilación multi-etapa. Las operaciones financieras usan dólares estadounidenses.

## Alcance funcional

La plataforma se limita a seis módulos: transferencias bancarias nacionales, giros nacionales, recargas de saldo por depósito/transferencia, acreditación de órdenes de Efectivo Móvil Banco Guayaquil, acreditación de pagos Deuna Banco Pichincha, y consulta personal de historial Equifax con configuración administrativa. No existe módulo de pago de servicios básicos ni catálogo de servicios de terceros.

Transferencias y giros requieren identidad del beneficiario, banco/cuenta cuando aplica y una cotización previa. Cobran comisión fija de $0.45. El IVA configurado actualmente es 15% de esa comisión (redondeado a centavos), con principal separado; el total se reserva y requiere revisión antes de liquidar. La clasificación y obligación tributaria dependen del modelo y del contribuyente, ver [Ecuador](ECUADOR.md).

Las tres vías de acreditación de saldo son gratuitas y empiezan como `PENDING`. Un administrador u operador puede aprobarlas o rechazarlas tras verificar la evidencia en el sistema externo; al aprobar se acredita el saldo y se registra el asiento contable de doble partida. El QR Deuna se configura desde el panel administrativo, acepta PNG/JPG/PDF y se guarda en `platform_settings` (PostgreSQL). Si no se ha cargado un QR, el cliente ve un mockup marcado como demostración.

Las operaciones exigen clave UUID de idempotencia. Las transferencias/giro reservan el total bajo bloqueo de fila de la cuenta. La revisión aprobada registra el pago y reparte los asientos entre cuenta del cliente, compensación bancaria, ingresos de comisión e IVA; el rechazo libera la reserva. Las acreditaciones entrantes no aumentan saldo hasta su aprobación. Los endpoints devuelven un `statusCode` estable (`PENDING`, `APPROVED`, `REJECTED`) junto al estado legible en español.

## Seguridad e integraciones

- Autenticación JWT, roles y permisos consultados en servidor. Clientes solo ven sus operaciones; operadores y administradores comparten la bandeja global de revisión, pueden aprobar/rechazar operaciones pendientes y consultar auditoría. El rol técnico legado `Ejecutivo` se presenta como `Operador`.
- Cédulas se validan con módulo 10 y provincia; RUC se valida por longitud y dígitos; la cuenta bancaria acepta de 8 a 12 dígitos. El catálogo de bancos requiere mantenimiento con los registros oficiales.
- Los códigos de seguridad de Efectivo Móvil se cifran mediante Data Protection antes de persistir. Solo se muestran al administrador mientras la solicitud está pendiente; no se incluyen en vistas de cliente ni después de resolver.
- Credenciales de Equifax se cifran y la API nunca las devuelve. La configuración incluye entorno, endpoint, Client ID, API key/secret, cabeceras y switch de servicio. El test de conectividad en producción solo valida host HTTPS y no envía secretos ni datos personales.
- El entorno sandbox devuelve datos de demostración. La conexión productiva Equifax, Deuna, Efectivo Móvil y liquidación bancaria requieren contratos, credenciales, documentación técnica y pruebas de certificación del proveedor.
- HTTPS, gestión/rotación externa de claves, MFA, observabilidad, backups/restauración y revisión de seguridad son requisitos antes de exponer el sistema a producción.

## Despliegue y datos

El Compose de desarrollo usa PostgreSQL persistente y variables del archivo `.env`. La migración `EcuadorModulesV3` renombra las tablas principales a `users`, `transactions` y `equifax_config`, crea `platform_settings`, añade los datos tipados y mantiene los registros existentes. Las solicitudes de pago de servicios pendientes se rechazan y liberan sus reservas, retirando ese módulo del alcance.

El esquema relacional, rutas, permisos, validación de identidad y eventos de crédito están en [MODELO_DATOS.md](MODELO_DATOS.md). Antes de operar se deben resolver las condiciones regulatorias, fiscales, de prevención de lavado y privacidad descritas en [ECUADOR.md](ECUADOR.md).
