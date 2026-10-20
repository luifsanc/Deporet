# Ecuador: alcance normativo y fiscal

Consulta de fuentes oficiales: **18 de octubre de 2026**, zona horaria America/Bogota. Este documento distingue controles técnicos implementados de requisitos aún pendientes; no declara que el producto esté autorizado para operar.

## Marco y decisiones

| Tema | Fuente oficial | Aplicación en esta versión | Pendiente antes de operar |
|---|---|---|---|
| Medios y sistemas de pago | [BCE: Sistema Auxiliar de Pagos](https://www.bce.fin.ec/sistema-de-pagos/sistema-auxiliar-de-pagos/) y [norma BCE-GG-024-2024](https://www.bce.fin.ec/storage/BCE/sistemas_auxiliares/BCE-GG-024-2024.pdf) | Solo sandbox; no se presenta DepoRed como entidad autorizada | Definir si actuará como proveedor tecnológico, agente/recaudador de un autorizado o partícipe. Determinar permisos y calificaciones correspondientes al modelo y al regulador competente |
| IVA sobre servicios y comisiones | [SRI: Circular NAC-DGECCGC26-00000003, 31/03/2026](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=f99ca91e-b9bb-45e5-b817-4237fc9f7bbf&nombre=NAC-DGECCGC26-00000003.pdf) | El demo calcula 15% solo sobre la comisión de $0.45 para transferencias y giros; principal separado; tasa y regla fiscal guardadas con cada operación | Validar clasificación del servicio y régimen de la entidad, tarifas autorizadas y contratos. No asumir que todo flujo tiene el mismo tratamiento |
| Facturación electrónica | [SRI: Facturación electrónica](https://www.sri.gob.ec/facturacion-electronica) | Constancia de simulación identificada como no fiscal | RUC, establecimientos/puntos de emisión, firma electrónica, XML, validaciones, recepción/autorización, RIDE, contingencia, notas de crédito y retenciones aplicables |
| Prevención de lavado | [UAFE: Sujetos obligados](https://www.uafe.gob.ec/sujetos-obligados/) y [Ley orgánica publicada por UAFE](https://www.uafe.gob.ec/wp-content/uploads/downloads/2025/07/Art19/1-2/ANEXOS/LEY-ORGANICA-DE-PREVENCION-DETECCION-Y-ERRADICACION-DEL-DELITO-DE-LAVADO-DE-ACTIVOS-Y-DEL-FINANCIAMIENTO-DE-DELITOS.pdf) | Auditoría, revisión de operaciones y límites de prueba | Determinar condición de sujeto obligado; diligencia debida real, beneficiario final, PEP/listas, monitoreo, reportes, oficial responsable y retención aplicable |
| Protección de datos | [SPDP: Marco normativo](https://www.spdp.gob.ec/marco-normativo/) y [resoluciones](https://www.spdp.gob.ec/resoluciones/) | Acceso limitado por perfil y por titular, registro de solicitud Equifax | Inventario, base de legitimación por finalidad, avisos, contratos de encargados, derechos del titular, gestión de incidentes, conservación y transferencias de datos |
| Datos crediticios | [SPDP: consultas 2025, datos crediticios/art. 28](https://spdp.gob.ec/consultas2025/) | Solo autorización de prueba para consulta propia; sin score ni envío al proveedor | Contrato con Equifax, legitimación y alcance real del servicio, verificación del titular, seguridad y conservación del reporte |

La autorización del BCE depende del servicio y del modelo operativo; revisar [los requisitos de autorización como partícipe](https://www.bce.fin.ec/servicios-y-tramites/calificacion-y-autorizacion-a-entidades-financieras-entidades-publicas-no-financieras-sistemas-auxiliares-de-pago-y-agentes-economicos/requerimiento-de-autorizacion-de-entidades-como-administradoras-de-los-sistemas-auxiliares-de-pago/) antes de definir el flujo comercial.

## Tratamiento fiscal implementado

La circular del SRI incluye cobros por transferencias y comisiones en su pronunciamiento sobre servicios financieros y recuerda la continuidad de la tarifa general del 15% hasta modificación por decreto. El ejemplo de software distingue el dinero transferido de la retribución por el servicio. La parametrización no reemplaza el análisis fiscal de una entidad concreta.

Ejemplo de transferencia/giro: principal **$100.00**, comisión fija **$0.45**, IVA de prueba de la comisión **$0.07** (15%, redondeado a centavos), total debitado **$100.52**. No se calcula IVA sobre el principal transferido. La app no añade comisión a los módulos de recarga de saldo, Efectivo Móvil o Deuna; su tratamiento tributario y contractual debe definirse con la entidad que opera el servicio antes de producción.

La fecha del hecho generador, clasificación del servicio, exenciones y retenciones requieren reglas adicionales según el contribuyente. No se implementaron declaraciones, ATS, impuesto a la renta, retenciones ni ISD. No se modelan pagos internacionales. Las reglas futuras deberán tener vigencia temporal y aprobación, preservando el cálculo original de cada documento.

## Tarifas y límites de demostración

| Módulo | Cargo de plataforma en esta versión | Máximo por solicitud |
|---|---:|---:|
| Transferencia | Comisión fija $0.45 + IVA parametrizado | $5,000 |
| Giro nacional | Comisión fija $0.45 + IVA parametrizado | $3,000 |
| Recarga de saldo | $0.00; acredita tras aprobación administrativa | $50,000 |
| Efectivo Móvil | $0.00; acredita tras aprobación | $50,000 |
| Deuna | $0.00; acredita tras aprobación | $50,000 |
| Consulta Equifax de sandbox | $5.00 en el demo | Tarifa de producto, no regulatoria |

La comisión de $0.45 es el valor comercial solicitado para DepoRet, no una tarifa oficial del BCE ni una tarifa de Deuna o de un banco. La tarifa de consulta Equifax de $5.00 pertenece al producto de demostración y debe reemplazarse por el convenio real. El límite diario de $10,000 también es un parámetro del sandbox, no un umbral legal de reporte o debida diligencia.

## Datos necesarios para la siguiente etapa

1. Razón social, RUC, actividad y modelo de operación: plataforma tecnológica, agente o entidad autorizada; responsables y reguladores aplicables.
2. Proveedor de recaudación y alcance contractual; documentación de APIs, credenciales de sandbox, convenios bancarios, Deuna, efectivo móvil y giros.
3. Contrato de Equifax, finalidad de consulta, verificación de identidad, condiciones y modelo de autorización.
4. Tarifario comercial aprobado y definición fiscal por concepto, régimen tributario y reglas de retención/facturación.
5. Política KYC/AML y límites, atención de reclamos, reversos, conciliación, seguridad, privacidad y operación.

La arquitectura permite continuar con estas integraciones, pero sus contratos reales aún no están implementados ni certificados.
