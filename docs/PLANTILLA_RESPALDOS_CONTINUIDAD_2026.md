# Plantilla — respaldo, recuperación y prueba de integridad

**Versión descargable:** 1.0 · 11-10-2026. Plantilla vacía; las actas completadas deben permanecer privadas. No publicar IP, direcciones de red, credenciales, copias ni datos reales.

## Configuración a aprobar

| Campo | Valor propuesto o evidencia requerida |
|---|---|
| Servicio / plataforma | [EDUAI / Sello Tecnológico / otro] |
| Responsable de los datos | [institución o Innova según el tratamiento] |
| Operador técnico autorizado | [cargo y sustituto] |
| Estado | [no implementado / pruebas / operativo y auditado] |
| Datos cubiertos | [PostgreSQL, Auth, objetos Storage, configuración, etc.] |
| Fuente / región | [país y proveedor verificados] |
| Medio primario | [medio propio/tercero; datos exactos en inventario privado] |
| Segunda copia independiente | [no existe / medio desconectado / fuera de sitio / proveedor validado] |
| Frecuencia | [propuesta diaria sujeta a prueba y crecimiento] |
| Historial / retención | [definir por categoría, capacidad y excepciones] |
| RPO | [objetivo escrito, medir con última copia recuperable] |
| RTO | [objetivo escrito, medir restauración completa] |
| Cifrado | [algoritmo y gestión de llaves en documento privado] |
| Notificación de fallos | [canal privado verificado] |
| Control de ocupación | [umbrales aprobados y alertas probadas] |
| Eliminación al vencer | [procedimiento y acta firmada] |
| Versión y fecha de aprobación | [completar] |

## Cobertura mínima a verificar

- Bases de datos y schemas necesarios; cuentas, Auth y permisos según herramientas de exportación autorizadas.
- Contenido de objetos Storage, no solamente metadatos SQL.
- Referencias coherentes entre tablas y archivos; rutas y políticas RLS restauradas.
- Configuraciones recuperables de cada aplicación y servicio, sin copiar secretos al repositorio público.
- Integridad por hashes/manifiesto y sincronización de fechas.
- Accesos restringidos, cifrado de datos en tránsito y reposo, segregación de funciones y gestión de llaves.
- Segunda copia independiente del mismo servidor para escenarios de desastre.
- Rotación y destrucción cuando termina finalidad / conservación legal; no reintroducir datos suprimidos.

## Acta de ejecución (una por copia)
- Identificador técnico: [interno].
- Servicio y fecha/hora: [completar].
- Tipo: [completo / incremental / snapshot / exportación].
- Categorías y tamaño global, sin datos personales: [completar].
- Resultado e integridad: [éxito / error / parcial] y [checksum/manifiesto].
- Duración y evidencia de alerta: [completar].
- Próxima fecha de expiración: [completar].
- Responsable y revisor: [completar].

## Acta de restauración (periódica)
- Restauración en entorno aislado, con autorización formal.
- Estado del respaldo de origen y llaves: [comprobar].
- Base de datos consistente y objetos accesibles: [sí/no].
- Autenticación, roles, RLS, reglas de acceso y permisos validados: [sí/no].
- Recuperación en minutos/horas medida realmente: [RTO observado].
- Diferencia temporal entre falla simulada y último dato válido: [RPO observado].
- Registro restringido de supresiones aplicado antes de abrir acceso: [sí/no].
- Informe de causa y acciones correctivas: [completar].
- Aprobación del responsable: [registro privado].

## Estado actual conocido (sin detalles de infraestructura)
Supabase Free no incluye respaldos automáticos disponibles para sus proyectos, y un volcado de PostgreSQL no incluye los archivos binarios de Storage. El alojamiento principal en `us-west-2` no cambia por disponer de copias de respaldo propias. No considerar esta plantilla evidencia de operación real.

**Referencias:** https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/storage/management/delete-objects ; https://www.bcn.cl/leychile/navegar?idNorma=1209272 .
