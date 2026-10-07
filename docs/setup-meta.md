# Configurar WhatsApp (Meta Cloud API) para el bot

Todo esto es gratis para uso personal: el **número de prueba** que Meta te da puede escribirse con hasta 5 teléfonos registrados, y las respuestas del bot dentro de la ventana de 24 h desde tu último mensaje no se cobran. El bot solo responde, nunca inicia conversaciones, así que no paga plantillas.

Necesitás una cuenta de Facebook.

## 1. Crear la app

1. Entrá a [developers.facebook.com](https://developers.facebook.com) → **Mis apps → Crear app**.
2. Caso de uso: "Otro" → tipo **Negocios**. Nombre: por ejemplo "Finanzas bot". Si te pide una cuenta de Meta Business, creá una (es solo un contenedor).
3. En el panel de la app, agregá el producto **WhatsApp**.

## 2. Número de prueba y tu teléfono

1. WhatsApp → **Configuración de la API** (API Setup).
2. Anotá el **Identificador de número de teléfono** (Phone number ID) del número de prueba → va en `PHONE_NUMBER_ID` de `wrangler.toml`.
3. En "Para" (To) → **Administrar lista de números** → agregá tu celular con código de país (+54 9 11 …) y confirmá el código que te llega por WhatsApp.
4. Anotá tu número como lo muestra Meta, sin `+` ni espacios (ej. `5491155551234`) → `ALLOWED_NUMBERS`.

## 3. Token permanente (el de la pantalla dura 24 h)

1. [business.facebook.com](https://business.facebook.com) → **Configuración del negocio → Usuarios → Usuarios del sistema → Agregar**. Nombre "finbot", rol **Administrador**.
2. Con el usuario creado: **Agregar activos → Apps** → elegí tu app → activá **Control total**.
3. **Generar nuevo token** → app: la tuya → vencimiento: **Nunca** → permisos: `whatsapp_business_messaging` y `whatsapp_business_management` → Generar. Copialo ya: no se vuelve a mostrar → `META_TOKEN`.

## 4. Clave secreta de la app

Panel de la app → **Configuración de la app → Básica → Clave secreta de la app → Mostrar** → `META_APP_SECRET`. El worker la usa para verificar que cada mensaje venga realmente de Meta.

## 5. Webhook

1. Desplegá el worker (`npx wrangler deploy`) y copiá su URL.
2. WhatsApp → **Configuración** (Configuration) → Webhook → **Editar**:
   - URL de devolución de llamada: `https://finbot.<tu-cuenta>.workers.dev/webhook`
   - Token de verificación: el mismo que pusiste en `META_VERIFY_TOKEN`
   - **Verificar y guardar**.
3. En "Campos del webhook" → **Administrar** → suscribí **messages**.

## 6. Probar

Desde tu celular mandale "hola" al número de prueba (está en la pantalla de Configuración de la API; podés agregarlo a contactos). Tienen que llegarte los botones. Si no, `npx wrangler tail` en la terminal muestra qué pasó.

## Cosas a saber

- **Modo desarrollo** alcanza; no hace falta pedir revisión de la app ni verificar el negocio mientras uses el número de prueba con números registrados.
- El número de prueba figura como "Test WhatsApp number"; no se puede usar desde la app de WhatsApp Business ni para escribirle a números no registrados.
- Si pasan más de 24 h sin que le escribas, el bot igual te responde cuando vos le mandes algo nuevo (tu mensaje abre la ventana).
- Si cambiás el token o la clave secreta, repetí `npx wrangler secret put …` y redesplegá.
- Argentina: Meta a veces muestra el celular como `549…` y otras como `54…`. El worker trata las dos formas como el mismo número.
