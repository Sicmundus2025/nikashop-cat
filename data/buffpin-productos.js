// netlify/functions/buffpin-productos.js
// Lista los productos disponibles en BuffPin (todas las páginas combinadas).
const crypto = require('crypto');

function firmar(bodyObj, secret) {
  const cadena = JSON.stringify(bodyObj) + secret;
  return crypto.createHash('md5').update(cadena).digest('hex').toLowerCase();
}

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const host = process.env.BUFFPIN_HOST;
  const clientId = process.env.BUFFPIN_CLIENT_ID;
  const clientSecret = process.env.BUFFPIN_CLIENT_SECRET;

  if (!host || !clientId || !clientSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables de entorno de BuffPin en Netlify' }) };
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
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'BuffPin respondió con error', detalle: data }) };
      }

      allProducts = allProducts.concat(data.data || []);
      totalPages = data.page ? data.page.totalPages : 1;
      pageNum++;
    } while (pageNum <= totalPages && pageNum <= 20); // límite de seguridad: máximo 20 páginas

    // Simplificamos cada producto y ya parseamos su platformConfig para el panel
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

    return { statusCode: 200, headers, body: JSON.stringify({ result: true, productos }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error al contactar BuffPin', detalle: String(err) }) };
  }
};
