# Innova Pay · Mercado Pago v1

## Componentes instalados

- Página pública: `webpay.html`
- Dominio objetivo: `https://webpay.innova-space-edu.cl`
- Backend: `backend/server.js`
- Administración: `assets/admin-enterprise/payments-admin.js`
- SDK reutilizable: `assets/innova-pay.js`
- Proxy Cloudflare: `cloudflare/webpay-worker.js`
- Migración: `sql/company-payments.sql`

CEO permite crear y editar links de cobro. Las cotizaciones incorporan **Generar cobro** y precargan cliente, monto y referencia.

## Variables privadas del backend

Configurar en Render, nunca en el frontend:

- `COMPANY_SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`

Opcionales:

- `INNOVA_PAY_PUBLIC_BASE_URL=https://webpay.innova-space-edu.cl`
- `INNOVA_PAY_FALLBACK_BASE_URL=https://www.innova-space-edu.cl/webpay.html`
- `INNOVA_PAY_RETURN_BASE_URL=https://www.innova-space-edu.cl/webpay.html`

## Mercado Pago

La integración usa Checkout Pro mediante Orders API:

- Crear order: `POST https://api.mercadopago.com/v1/orders`
- Se usa `X-Idempotency-Key`
- El backend conserva `order.id` y `checkout_url`
- El navegador nunca recibe el Access Token.

Configurar en Mercado Pago el webhook productivo para el evento **Order (Mercado Pago)**:

`https://ceo-ai-mira.onrender.com/api/payments/webhooks/mercadopago`

Luego guardar la clave secreta generada por Mercado Pago en `MERCADOPAGO_WEBHOOK_SECRET`.

## Supabase

Ejecutar una vez `sql/company-payments.sql` en el proyecto empresarial `alogqktilzgylzomzwem`.

Las tablas tienen RLS habilitado y no tienen políticas para `anon` ni `authenticated`. El backend usa exclusivamente `service_role`.

## Subdominio Cloudflare

El repositorio ya publica `webpay.html` junto al sitio principal. Para conservar el hostname `webpay.innova-space-edu.cl`, desplegar `cloudflare/webpay-worker.js` como Worker y asociar la ruta:

`webpay.innova-space-edu.cl/*`

El Worker sirve `/webpay.html` en la raíz del subdominio y proxifica los assets al sitio corporativo.

## Uso desde otras páginas

Cargar:

`<script src="https://webpay.innova-space-edu.cl/assets/innova-pay.js"></script>`

y abrir un cobro existente:

`InnovaPay.open("TOKEN_PUBLICO");`

Las otras páginas no necesitan credenciales de Mercado Pago ni implementar Checkout Pro.
