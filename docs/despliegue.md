# Despliegue continuo en Azure

Pipeline: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Se ejecuta cuando el **CI termina
en verde sobre `main`** (o a mano desde *Actions → CD (Azure) → Run workflow*) y publica:

| Pieza | Servicio de Azure | Cómo se publica |
|---|---|---|
| Backend FastAPI | App Service (Linux, Python 3.12) | `azure/webapps-deploy`; Oryx instala `requirements.txt` y `startup.sh` aplica `alembic upgrade head` y arranca uvicorn |
| Frontend React | Static Web Apps (Free) | `npm run build` con `VITE_API_URL` + `Azure/static-web-apps-deploy` |
| Base de datos | Azure Database for PostgreSQL – Flexible Server 16 | Se crea una vez a mano; las migraciones se aplican al arrancar el backend |

Tras el despliegue del backend, el job hace una prueba de humo contra `GET /api/health`; si falla, el frontend
no se publica.

> Los comandos de abajo se ejecutan **una sola vez** con la CLI de Azure (`az`) y la de GitHub (`gh`),
> iniciando sesión con `az login`. No se han podido ejecutar desde el repositorio: la primera ejecución real
> del pipeline puede requerir ajustes.

## Costos con Azure for Students

Cuenta con unos 100 USD de crédito y sin tarjeta. Orden de magnitud mensual: App Service B1 ≈ 13 USD,
PostgreSQL Flexible Burstable B1ms ≈ 12–15 USD, Static Web Apps Free = 0. Para ahorrar crédito entre
demostraciones: `az postgres flexible-server stop` y `az webapp stop` (el servidor PostgreSQL se vuelve a
encender solo a los 7 días). Las suscripciones de estudiante limitan las regiones permitidas: si un comando
falla por política o falta de capacidad, prueba otra región (`az postgres flexible-server list-skus -l <región>`).

## 1. Recursos de Azure

```bash
# Variables (elige nombres únicos; el sufijo evita colisiones de dominio)
RG=rg-prestamos
LOC=eastus2                      # ajustar a una región permitida en tu suscripción
SUF=$RANDOM
PG=pg-prestamos-$SUF
APP=app-prestamos-$SUF
PLAN=plan-prestamos
SWA=swa-prestamos-$SUF
PGUSER=prestamos_admin
PGPASS='<contraseña-larga-sin-@-ni-:>'   # guárdala en un gestor de contraseñas

az group create -n $RG -l $LOC

# PostgreSQL 16 (acceso público limitado a servicios de Azure; abre tu IP solo si vas a conectarte desde tu equipo)
az postgres flexible-server create -g $RG -n $PG -l $LOC --version 16 \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --admin-user $PGUSER --admin-password "$PGPASS" --public-access 0.0.0.0
# La restricción anti-solape necesita btree_gist: hay que permitirla antes de migrar
az postgres flexible-server parameter set -g $RG --server-name $PG --name azure.extensions --value BTREE_GIST
az postgres flexible-server db create -g $RG --server-name $PG --database-name prestamos

# App Service para el backend
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP --runtime "PYTHON:3.12"
az webapp config set -g $RG -n $APP --startup-file "bash startup.sh" --generic-configurations '{"healthCheckPath":"/api/health"}'
az webapp update -g $RG -n $APP --https-only true

# Static Web Apps para el frontend
az staticwebapp create -g $RG -n $SWA -l $LOC --sku Free
```

## 2. Configuración del backend

La URL de la base lleva el *driver* `postgresql+psycopg` y SSL obligatorio; si la contraseña tiene
caracteres especiales, codifícala (por ejemplo `@` → `%40`).

```bash
SWA_URL=https://$(az staticwebapp show -g $RG -n $SWA --query defaultHostname -o tsv)

az webapp config appsettings set -g $RG -n $APP --settings \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  DATABASE_URL="postgresql+psycopg://$PGUSER:<contraseña-codificada>@$PG.postgres.database.azure.com:5432/prestamos?sslmode=require" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  JWT_EXPIRE_MINUTES=60 \
  CORS_ORIGINS="$SWA_URL" \
  TZ_NAME=America/Bogota
```

`SEED_PASSWORD` no se configura de forma permanente (ver el paso 5).

## 3. Autenticación de GitHub con Azure (OIDC, sin secretos de larga duración)

```bash
SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
REPO=SantiagoSo2425/prestamos-equipos-recursos

APPID=$(az ad app create --display-name gh-prestamos-deploy --query appId -o tsv)
az ad sp create --id $APPID
az role assignment create --assignee $APPID --role Contributor \
  --scope /subscriptions/$SUB/resourceGroups/$RG

# Credencial federada: solo el environment `azure` de este repositorio puede iniciar sesión
az ad app federated-credential create --id $APPID --parameters "{
  \"name\": \"github-azure\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$REPO:environment:azure\",
  \"audiences\": [\"api://AzureADTokenExchange\"]}"
```

> En algunas cuentas de estudiante el tenant no permite crear aplicaciones de Entra ID. Si
> `az ad app create` falla por permisos, la alternativa es un *publish profile* del App Service
> (`az webapp deployment list-publishing-profiles --xml`), guardado como secreto, y cambiar los pasos
> `azure/login` y `azure/webapps-deploy` para usarlo.

## 4. GitHub: environment, variables y secretos

```bash
gh api -X PUT repos/$REPO/environments/azure          # crea el environment `azure`
# (opcional) en Settings → Environments → azure: «Required reviewers» para aprobar cada despliegue

gh secret set AZURE_CLIENT_ID --env azure --body "$APPID"
gh secret set AZURE_TENANT_ID --env azure --body "$TENANT"
gh secret set AZURE_SUBSCRIPTION_ID --env azure --body "$SUB"
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --env azure \
  --body "$(az staticwebapp secrets list -g $RG -n $SWA --query properties.apiKey -o tsv)"

gh variable set AZURE_WEBAPP_NAME --env azure --body "$APP"
gh variable set API_URL --env azure --body "https://$APP.azurewebsites.net/api"
```

Además, en *Settings → Branches* conviene exigir los jobs **Backend** y **Frontend** del CI como
comprobaciones obligatorias en `main` y `develop`, para que solo código con pruebas en verde llegue al CD.

## 5. Datos iniciales

La migración crea las tablas pero **no** las categorías ni los usuarios, así que la primera vez hay que
cargar la semilla (datos ficticios de demostración). Con la clave temporal y sin dejarla guardada:

```bash
az webapp ssh -g $RG -n $APP
# dentro del contenedor:
SEED_PASSWORD='<clave-de-demo>' python -m app.seed
```

La semilla es idempotente y deja usuarios `est.ana`, `resp.carlos`, `coord.sofia`, etc. con esa clave.
Para una demostración pública conviene usar una clave distinta de las de desarrollo.

## 6. Verificación

1. `https://<APP>.azurewebsites.net/api/health` → `{"status":"ok"}`; `/docs` muestra la API.
2. Abrir la URL de Static Web Apps, iniciar sesión y recorrer el ciclo (solicitar → aprobar → entregar → devolver).
3. Refrescar una ruta interna (por ejemplo `/catalogo`): debe cargar la aplicación y no dar 404.

Si el backend no arranca: *App Service → Log stream* (`az webapp log tail -g $RG -n $APP`). Causas habituales:
extensión `btree_gist` no permitida, `DATABASE_URL` mal codificada o falta de `sslmode=require`.

## Limitaciones

- Una sola instancia: `startup.sh` migra al arrancar; con varias instancias hay que mover la migración a un
  paso propio del pipeline.
- Un único ambiente (`azure`). Para añadir staging se duplican los recursos y el environment, y se dispara
  también desde `develop`.
- No hay monitoreo más allá del *health check* y los registros del App Service (Application Insights es opcional).
