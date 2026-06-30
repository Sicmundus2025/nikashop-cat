// functions/api/buffpin-productos.js
// Lista los productos disponibles en BuffPin (todas las páginas combinadas).
// Versión Cloudflare Pages Functions. Requiere activar el flag "nodejs_compat"
// en la configuración del proyecto en Cloudflare (Settings → Functions → Compatibility flags).
import crypto from 'node:crypto';

function firmar(bodyObj, secret) {
  const cadena = JSON.stringify(bodyObj) + secret;
  return crypto.createHash('md5').update(cadena).digest('hex').toLowerCase();
}

export async function onRequestGet(context) {
  return handle(context);
}
export async function onRequestPost(context) {
  return handle(context);
}

async function handle(context) {
  const { env } = context;
  const headers = { 'Content-Type': 'application/json' };

  const host = (env.BUFFPIN_HOST || '').replace(/\/+$/, '');
  const clientId = env.BUFFPIN_CLIENT_ID;
  const clientSecret = env.BUFFPIN_CLIENT_SECRET;

  if (!host || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Faltan variables de entorno de BuffPin en Cloudflare' }), { status: 500, headers });
  }

  const pageSize = 100;
  let allProducts = [];
  let pageNum = 1;
  let totalPages = 1;

  try {
    do {
      const body = {};
      const authSign = firmar(body, clientSecret);

      const res = await fetch(`${host}/api/v1/getGoodsList/${pageNum}/${pageSize}`, {
        method: 'POST',
        headers: {
          'ClientId': clientId,
          'AuthSign': authSign,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!data.result) {
        return new Response(JSON.stringify({ error: 'BuffPin respondió con error', detalle: data }), { status: 502, headers });
      }

      allProducts = allProducts.concat(data.data || []);
      totalPages = data.page ? data.page.totalPages : 1;
      pageNum++;
    } while (pageNum <= totalPages && pageNum <= 20);

    const productos = allProducts.map(p => {
      let campos = [];
      try { campos = JSON.parse(p.platformConfig); } catch (e) { campos = []; }
      return {
        id: p.id,
        nombre: p.goodsName,
        precio: p.payPrice,
        moneda: p.costCurrency,
        tipo: p.type,
        campos
      };
    });

    return new Response(JSON.stringify({ result: true, productos }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error al contactar BuffPin', detalle: String(err) }), { status: 500, headers });
  }
}
