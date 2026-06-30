// functions/callback.js
// Paso 2 del login con GitHub para Decap CMS.
// GitHub redirige acá después de que el usuario autoriza el acceso.

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Falta el código de autorización de GitHub.', { status: 400 });
  }

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response('Faltan variables GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET en Cloudflare', { status: 500 });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response('No se pudo obtener el token de GitHub: ' + JSON.stringify(tokenData), { status: 400 });
    }

    // Decap CMS espera recibir el token vía postMessage, con este formato exacto.
    const tokenPayload = JSON.stringify({ token: tokenData.access_token, provider: 'github' });
    const fullMessage = 'authorization:github:success:' + tokenPayload;
    const html = `
      <!DOCTYPE html>
      <html><body>
      <script>
        (function() {
          function receiveMessage(e) {
            window.opener.postMessage(${JSON.stringify(fullMessage)}, e.origin);
            window.removeEventListener('message', receiveMessage, false);
          }
          window.addEventListener('message', receiveMessage, false);
          window.opener.postMessage('authorizing:github', '*');
        })();
      </script>
      </body></html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    return new Response('Error al completar el login: ' + String(err), { status: 500 });
  }
}
