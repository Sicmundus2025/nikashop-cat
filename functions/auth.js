// functions/auth.js
// Paso 1 del login con GitHub para Decap CMS (reemplaza lo que Netlify hacía solo).
// Cuando el panel toca "Login with GitHub", lo manda para acá.

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response('Falta configurar GITHUB_OAUTH_CLIENT_ID en Cloudflare', { status: 500 });
  }

  const redirectUri = `${origin}/callback`;
  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;

  return Response.redirect(authorizeUrl, 302);
}
