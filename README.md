# Flora App Backend

Backend REST para administracion de una floreria con 2 sucursales. Usa NestJS, Prisma, PostgreSQL, JWT, bcrypt, DTOs validados, Helmet y CORS limitado al frontend Angular.

## Instalacion

```bash
npm install
```

Copiar `.env.example` a `.env` y ajustar valores:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flora_app?schema=public"
JWT_SECRET="change-this-secret"
JWT_EXPIRES_IN="1d"
PORT=3000
FRONTEND_URL="http://localhost:4200"
```

## Prisma

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

El seed crea las sucursales `Centro` y `Norte`, el usuario inicial y productos de ejemplo.

Usuario inicial:

- Email: `admin@flora.local`
- Password: `cambiar123`

Cambiar esta password antes de usar el sistema en produccion.

## Desarrollo

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api`.

## Build

```bash
npm run build
npm run start:prod
```

## Deploy con Neon y Render

Para una app pequena, una opcion gratuita practica es:

- Base de datos: Neon PostgreSQL
- Backend: Render Web Service Free
- Frontend Angular: Render Static Site, Vercel, Netlify o Firebase Hosting

Variables requeridas en Render:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="generar-un-secreto-largo"
JWT_EXPIRES_IN="1d"
FRONTEND_URL="https://url-del-frontend"
NODE_ENV="production"
```

Configuracion del Web Service:

```bash
Build Command: npm run render:build
Start Command: npm run start:prod
Health Check Path: /api/health
```

Antes del primer uso en produccion, aplicar migraciones y seed contra Neon:

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

No guardar `DATABASE_URL` ni `JWT_SECRET` en GitHub. Deben cargarse como variables privadas del servicio.

## Autenticacion

Login:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@flora.local",
  "password": "cambiar123"
}
```

Respuesta:

```json
{
  "accessToken": "...",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@flora.local",
    "isActive": true
  }
}
```

Usar el token en todos los endpoints protegidos:

```http
Authorization: Bearer <accessToken>
```

## Endpoints Principales

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/branches`
- `GET /api/stock?branchId=1&search=rosas`
- `POST /api/stock`
- `GET /api/stock/:id`
- `PATCH /api/stock/:id`
- `PATCH /api/stock/:id/units`
- `GET /api/sales?branchId=1&paymentMethod=Efectivo&from=2026-08-01&to=2026-08-31`
- `POST /api/sales`
- `GET /api/sales/:id`
- `GET /api/orders?branchId=1&status=PENDING`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id`
- `PATCH /api/orders/:id/cancel`
- `POST /api/orders/:id/convert-to-sale`
- `GET /api/reports/sales-total?branchId=1&paymentMethod=Efectivo&from=2026-08-01&to=2026-08-31`
- `GET /api/reports/payment-methods?branchId=1&from=2026-08-01&to=2026-08-31`
- `GET /api/reports/low-stock?branchId=1`
- `GET /api/reports/pending-orders?branchId=1`

## Medios de Pago

La API acepta:

- `Efectivo`
- `Debito`
- `Credito`
- `Transferencia`
- `Mercado Pago`

Internamente Prisma guarda `Mercado Pago` como `Mercado_Pago` por restriccion de nombres de enum.
