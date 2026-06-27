// netlify/functions/buffpin-pedido.js
// Crea un pedido real en BuffPin. Protegida con PIN (variable PANEL_PIN en Netlify).
const crypto = require('crypto');

function firmar(bodyObj, secret) {
  const cadena = JSON.stringify(bodyObj) + secret;
  return crypto.createHash('md5').update(cadena).digest('hex').toLowerCase();
}

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let input;
  try {
    input = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { pin, priceGroupGoodsId, buyNumber, campos } = input;

  const panelPin = process.env.PANEL_PIN;
  if (!panelPin) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No hay PANEL_PIN configurado en Netlify — no se puede operar este panel sin esto' }) };
  }
  if (!pin || String(pin) !== String(panelPin)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'PIN incorrecto' }) };
  }

  if (!priceGroupGoodsId || !buyNumber || !Array.isArray(campos)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos del pedido (producto, cantidad o campos de recarga)' }) };
  }

  const host = process.env.BUFFPIN_HOST;
  const clientId = process.env.BUFFPIN_CLIENT_ID;
  const clientSecret = process.env.BUFFPIN_CLIENT_SECRET;

  if (!host || !clientId || !clientSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables de entorno de BuffPin en Netlify' }) };
  }

  const ip = (event.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0].trim();
  const merchantOrderId = 'NIKA' + Date.now();

  const body = {
    ip,
    merchantOrderId,
    orderItemsBOList: [{
      priceGroupGoodsId: Number(priceGroupGoodsId),
      buyNumber: Number(buyNumber),
      rechargePlatformConfig: JSON.stringify(campos)
    }]
  };

  const authSign = firmar(body, clientSecret);

  try {
    const res = await fetch(`${host}/api/v1/submitOrder`, {
      method: 'POST',
      headers: {
        'ClientId': clientId,
        'AuthSign': authSign,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error al contactar BuffPin', detalle: String(err) }) };
  }
};
