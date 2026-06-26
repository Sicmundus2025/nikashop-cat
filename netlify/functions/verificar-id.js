// Netlify Function: verificar-id
// Verifica un ID de jugador (PUBG Mobile o Mobile Legends) contra la API de BuffPin
// sin exponer el clientSecret al navegador del cliente.

const crypto = require('crypto');

// Estas credenciales viven SOLO en el servidor (variables de entorno de Netlify),
// nunca se envían al navegador del cliente.
const CLIENT_ID = process.env.BUFFPIN_CLIENT_ID;
const CLIENT_SECRET = process.env.BUFFPIN_CLIENT_SECRET;
const API_HOST = 'http://merchantapi.vtrustcard.com';

function calcularFirma(params, secret) {
  const jsonStr = JSON.stringify(params);
  const signStr = jsonStr + secret;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toLowerCase();
}

exports.handler = async function (event) {
  // Solo aceptamos POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Configuración del servidor incompleta' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'JSON inválido' }),
    };
  }

  const { accountId, type, serverId } = body;

  if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Falta el ID de jugador (accountId)' }),
    };
  }

  // type: 1 = PUBG Mobile (default), 2 = Mobile Legends (MLBB Ru)
  const gameType = type === 2 ? 2 : 1;

  const params = { type: gameType, accountId: accountId.trim() };
  if (gameType === 2 && serverId) {
    params.serverId = serverId;
  }

  const authSign = calcularFirma(params, CLIENT_SECRET);

  try {
    const response = await fetch(`${API_HOST}/api/v1/getAccountInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ClientId: CLIENT_ID,
        AuthSign: authSign,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!data.result) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          message: (data.error && data.error.message) || 'No se pudo verificar el ID',
        }),
      };
    }

    const exists = data.data && data.data.exist === 1;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        exists,
        accountName: data.data ? data.data.accountName : null,
        region: data.data ? data.data.region : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ ok: false, message: 'Error al contactar el servidor de verificación' }),
    };
  }
};
