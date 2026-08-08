# Innova Admin Enterprise v2

Release integral de gestión empresarial sobre la plataforma existente.

## Incluye

Clientes/proveedores, órdenes de compra, contratos, tesorería, conciliación, RR.HH., activos, garantías, tributario, archivo empresarial, aprobaciones, vencimientos, expediente 360°, deduplicación y auditor ampliado.

## Acceso

El login queda solo para ingreso. Las cuentas nuevas son creadas por el superadministrador con correo + RUT. La clave temporal corresponde a los primeros 6 dígitos del RUT y debe cambiarse en el primer ingreso. El acceso a datos empresariales queda bloqueado por RLS hasta completar ese cambio.

## Facturas

La importación mantiene el parser DTE/PDF, enlaza contrapartes y tesorería, y agrega protecciones frente a duplicados. El registro duplicado de prueba de la factura 11 fue consolidado en un único registro correcto en producción.
