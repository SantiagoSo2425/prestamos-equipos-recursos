# Despliegue continuo en Azure (contenedores)

Pipeline: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Se ejecuta cuando el **CI termina
en verde sobre `main`** (o a mano desde *Actions → CD (Azure) → Run workflow*):

| Pieza | Servicio de Azure | Cómo se publica |
|---|---|---|
| Backend FastAPI | App Service for Containers (Linux, B1) | El workflow construye `backend/Dockerfile`, sube la imagen a **Azure Container Registry** (etiquetas `<sha>` y `latest`) y actualiza el App Service; el entrypoint aplica `alembic upgrade head` y arranca uvicorn |
| Frontend React | Static Web Apps (Free) | `npm run build` con `VITE_API_URL` + `Azure/static-web-apps-deploy` |
| Base de datos | Azure Database for PostgreSQL – Flexible Server 16 | Se crea una vez a mano; las migraciones se aplican al arrancar el backend |
| Imágenes | Azure Container Registry (Basic) | El App Service las descarga con **identidad administrada** (rol `AcrPull`), sin contraseñas |

Tras desplegar el backend, el job comprueba `GET /api/health`; si falla, el frontend no se publica.

## Entorno local con Docker

```bash
docker compose up --build -d          # PostgreSQL 16 + backend en http://127.0.0.1:8090
docker compose run --rm -e SEED_PASSWORD='<clave-de-demo>' --entrypoint "" backend python -m app.seed
docker compose down -v                # detiene y borra la base local
```

Los puertos del host (`API_PORT`, `DB_PORT`) son configurables para no chocar con otros servicios locales.
El frontend se ejecuta aparte (`npm run dev`, con `VITE_API_URL=http://localhost:8090/api`).

## Costos con Azure for Students

Cuenta con unos 100 USD de crédito y sin tarjeta. Orden de magnitud mensual: App Service B1 ≈ 13 USD,
PostgreSQL Burstable B1ms ≈ 12–15 USD, Container Registry Basic ≈ 5 USD, Static Web Apps Free = 0. Para ahorrar
crédito entre demostraciones: `az postgres flexible-server stop` y `az webapp stop`.

## Regiones: lo que pasó con esta suscripción

Las suscripciones de estudiante restringen PostgreSQL en varias regiones (`eastus`, `eastus2`, `westus2`,
`southcentralus`, `westeurope`…), y `az postgres flexible-server list-skus` puede mostrar una SKU como disponible
y luego fallar con `SkuNotAvailable` (ocurrió en Central US). Por eso en este proyecto:

- PostgreSQL está en **Mexico Central**.
- App Service, Container Registry y Static Web Apps están en **Central US**.

Es una separación tolerable para una demo (algo más de latencia entre backend y base). Si PostgreSQL falla en tu
región, prueba otra de una en una con un nombre de servidor nuevo (un servidor fallido tarda en liberar su nombre).

## 1. Recursos de Azure

```bash
RG=rg-prestamos; LOC=centralus; SUF=<5 dígitos>
PG=pgp$SUF<región-de-la-BD>; APP=app-prestamos-$SUF; PLAN=plan-prestamos
SWA=swa-prestamos-$SUF; ACR=acrprestamos$SUF
PGUSER=prestamos_admin; PGPASS='<contraseña-larga-alfanumérica>'   # guárdala solo en Azure / gestor de contraseñas

az group create -n $RG -l $LOC

# PostgreSQL 16 (acceso solo desde servicios de Azure). La región puede ser distinta de $LOC (ver arriba)
az postgres flexible-server create -g $RG -n $PG -l mexicocentral --version 16 --tier Burstable \
  --sku-name Standard_B1ms --storage-size 32 --admin-user $PGUSER --admin-password "$PGPASS" --public-access 0.0.0.0 --yes
az postgres flexible-server parameter set -g $RG --server-name $PG --name azure.extensions --value BTREE_GIST
az postgres flexible-server db create -g $RG -s $PG -n prestamos

# Registro de contenedores y App Service
az provider register -n Microsoft.ContainerRegistry --wait
az acr create -g $RG -n $ACR -l $LOC --sku Basic --admin-enabled false
az appservice plan create -g $RG -n $PLAN -l $LOC --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP --runtime "PYTHON:3.12"      # luego se cambia a contenedor
az webapp update -g $RG -n $APP --https-only true

# Static Web Apps
az staticwebapp create -g $RG -n $SWA -l $LOC --sku Free
```

`btree_gist` hay que permitirla **antes** del primer arranque del backend: sin ella la migración inicial falla.

## 2. App Service como contenedor (identidad administrada → ACR)

```bash
PID=$(az webapp identity assign -g $RG -n $APP --query principalId -o tsv)
az role assignment create --assignee-object-id $PID --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope $(az acr show -g $RG -n $ACR --query id -o tsv)

# Primera imagen (después la sube el pipeline)
az acr login -n $ACR
docker build -t $ACR.azurecr.io/prestamos-backend:bootstrap backend && docker push $ACR.azurecr.io/prestamos-backend:bootstrap

az webapp config set -g $RG -n $APP --acr-use-identity true
az webapp config container set -g $RG -n $APP \
  --container-image-name $ACR.azurecr.io/prestamos-backend:bootstrap --container-registry-url https://$ACR.azurecr.io
az webapp config set -g $RG -n $APP --startup-file "/app/docker-entrypoint.sh"
az resource update -g $RG -n "$APP/config/web" --resource-type Microsoft.Web/sites/config \
  --set properties.healthCheckPath=/api/health
```

> En PowerShell, un argumento vacío o que empieza con `/` puede romperse al pasar por `az.cmd`; los comandos de
> arriba que llevan rutas se probaron desde PowerShell o con `MSYS_NO_PATHCONV=1` en Git Bash.

Variables del backend (la URL de la base lleva el *driver* `postgresql+psycopg` y `sslmode=require`; codifica los
caracteres especiales de la contraseña). **No imprimas** la salida de este comando: incluye los valores.

```bash
SWA_URL=https://$(az staticwebapp show -g $RG -n $SWA --query defaultHostname -o tsv)
az webapp config appsettings set -g $RG -n $APP -o none --settings \
  DATABASE_URL="postgresql+psycopg://$PGUSER:$PGPASS@$PG.postgres.database.azure.com:5432/prestamos?sslmode=require" \
  JWT_SECRET="$(openssl rand -hex 32)" JWT_EXPIRE_MINUTES=60 CORS_ORIGINS="$SWA_URL" TZ_NAME=America/Bogota \
  WEBSITES_PORT=8000 WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
```

## 3. GitHub ↔ Azure por OIDC (sin secretos de larga duración)

```bash
SUB=$(az account show --query id -o tsv); TENANT=$(az account show --query tenantId -o tsv)
APPID=$(az ad app create --display-name gh-prestamos-deploy --query appId -o tsv)
SPID=$(az ad sp create --id $APPID --query id -o tsv)
az role assignment create --assignee-object-id $SPID --assignee-principal-type ServicePrincipal \
  --role Contributor --scope /subscriptions/$SUB/resourceGroups/$RG
az role assignment create --assignee-object-id $SPID --assignee-principal-type ServicePrincipal \
  --role AcrPush --scope $(az acr show -g $RG -n $ACR --query id -o tsv)
# fedcred.json: {"name":"github-azure","issuer":"https://token.actions.githubusercontent.com",
#   "subject":"repo:<owner>/<repo>:environment:azure","audiences":["api://AzureADTokenExchange"]}
az ad app federated-credential create --id $APPID --parameters fedcred.json
```

Si el tenant no deja crear aplicaciones de Entra ID, la alternativa es un *publish profile* del App Service
guardado como secreto, cambiando `azure/login` por ese perfil.

## 4. GitHub: environment, variables y secretos

```bash
gh api -X PUT repos/<owner>/<repo>/environments/azure
# secretos del environment `azure`
gh secret set AZURE_CLIENT_ID --env azure --body "$APPID"
gh secret set AZURE_TENANT_ID --env azure --body "$TENANT"
gh secret set AZURE_SUBSCRIPTION_ID --env azure --body "$SUB"
az staticwebapp secrets list -g $RG -n $SWA --query properties.apiKey -o tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --env azure
# variables del environment `azure`
gh variable set AZURE_WEBAPP_NAME --env azure --body "$APP"
gh variable set ACR_NAME --env azure --body "$ACR"
gh variable set API_URL --env azure --body "https://$APP.azurewebsites.net/api"
```

**Solo `main` despliega.** Dos barreras: el workflow solo reacciona al CI de `main` (`workflow_run` con
`branches: [main]`) y el environment `azure` acepta únicamente despliegues desde `main`:

```bash
echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' > env.json
gh api -X PUT repos/<owner>/<repo>/environments/azure --input env.json
gh api -X POST repos/<owner>/<repo>/environments/azure/deployment-branch-policies -f name=main -f type=branch
```

**Protección de `main`** (PR obligatorio con 1 aprobación, jobs *Backend (pytest + PostgreSQL)* y *Frontend (lint +
build)* del CI en verde y rama al día, sin *force push* ni borrado, conversaciones resueltas; los administradores
pueden saltarla en emergencias):

```bash
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input prot.json
# prot.json: required_status_checks {strict: true, contexts: [los dos jobs]}, enforce_admins: false,
#   required_pull_request_reviews {required_approving_review_count: 1, dismiss_stale_reviews: true},
#   restrictions: null, allow_force_pushes: false, allow_deletions: false, required_conversation_resolution: true
```

En *Settings → Environments → azure* también se pueden exigir revisores para aprobar cada despliegue.

## 5. Datos iniciales

La migración crea las tablas pero **no** las categorías ni los usuarios: la primera vez hay que cargar la semilla
(datos ficticios de demostración). Opción desde tu equipo, con una regla de firewall temporal para tu IP:

```bash
az postgres flexible-server firewall-rule create -g $RG -n $PG --rule-name mi-ip --start-ip-address <tu-ip> --end-ip-address <tu-ip>
docker run --rm --entrypoint "" -e SEED_PASSWORD='<clave-de-demo>' \
  -e DATABASE_URL="postgresql+psycopg://$PGUSER:$PGPASS@$PG.postgres.database.azure.com:5432/prestamos?sslmode=require" \
  -e JWT_SECRET=x $ACR.azurecr.io/prestamos-backend:bootstrap python -m app.seed
az postgres flexible-server firewall-rule delete -g $RG -n $PG --rule-name mi-ip --yes
```

La semilla es idempotente y deja usuarios `est.ana`, `resp.carlos`, `coord.sofia`… con esa clave. Usa una clave
distinta de las de desarrollo.

## 6. Verificación

1. `https://<APP>.azurewebsites.net/api/health` → `{"status":"ok"}`; `/docs` muestra la API.
2. Abrir la URL de Static Web Apps, iniciar sesión y recorrer el ciclo (solicitar → aprobar → entregar → devolver).
3. Refrescar una ruta interna (p. ej. `/catalogo`): debe cargar la aplicación y no dar 404.

Si el backend no arranca: `az webapp log tail -g $RG -n $APP`. Causas habituales: `btree_gist` no permitida,
`DATABASE_URL` mal codificada o sin `sslmode=require`, o el comando de arranque distinto de `/app/docker-entrypoint.sh`.

## Limitaciones

- Una sola instancia: el entrypoint migra al arrancar; con varias réplicas hay que mover la migración a un paso
  propio del pipeline.
- Un único ambiente (`azure`). Para staging se duplican los recursos y el environment.
- Sin monitoreo más allá del *health check* y los registros del App Service.
