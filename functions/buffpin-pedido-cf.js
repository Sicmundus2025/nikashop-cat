// functions/api/buffpin-pedido.js
// Crea un pedido real en BuffPin. Protegida con PIN (variable PANEL_PIN en Cloudflare).
// Requiere activar el flag "nodejs_compat" en la configuración del proyecto en Cloudflare.
import crypto from 'node:crypto';

function firmar(bodyObj, secret) {
  const cadena = JSON.stringify(bodyObj) + secret;
  return crypto.createHash('md5').update(cadena).digest('hex').toLowerCase();
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const headers = { 'Content-Type': 'application/json' };

  let input;
  try {
    input = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400, headers });
  }

  const { pin, priceGroupGoodsId, buyNumber, campos } = input;

  const panelPin = env.PANEL_PIN;
  if (!panelPin) {
    return new Response(JSON.stringify({ error: 'No hay PANEL_PIN configurado en Cloudflare — no se puede operar este panel sin esto' }), { status: 500, headers });
  }
  if (!pin || String(pin) !== String(panelPin)) {
    return new Response(JSON.stringify({ error: 'PIN incorrecto' }), { status: 403, headers });
  }

  if (!priceGroupGoodsId || !buyNumber || !Array.isArray(campos)) {
    return new Response(JSON.stringify({ error: 'Faltan datos del pedido (producto, cantidad o campos de recarga)' }), { status: 400, headers });
  }

  const host = (env.BUFFPIN_HOST || '').replace(/\/+$/, '');
  const clientId = env.BUFFPIN_CLIENT_ID;
  const clientSecret = env.BUFFPIN_CLIENT_SECRET;

  if (!host || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Faltan variables de entorno de BuffPin en Cloudflare' }), { status: 500, headers });
  }

  const ip = (request.headers.get('cf-connecting-ip') || '127.0.0.1');
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
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error al contactar BuffPin', detalle: String(err) }), { status: 500, headers });
  }
}
