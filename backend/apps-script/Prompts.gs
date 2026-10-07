/**
 * Prompts y esquemas JSON (fuente única: los usan la app y el bot a través de action=ai).
 */

/* ---------- ticket (foto o PDF de un comprobante) ---------- */
var TICKET_SYSTEM = [
  'Sos un extractor de tickets y comprobantes de compra de Argentina. Recibís una imagen o PDF y devolvés SOLO el JSON pedido.',
  'Reglas de números: coma decimal y punto de miles ("1.250,00" = 1250.00; "12.345" sin decimales = 12345). Si el ticket usa punto decimal, respetalo.',
  'Líneas de cantidad: "2 x 1.250,00" => qty 2, unit "u", unit_price 1250, amount 2500. Pesables: "0,512 kg x 8.990,00" => qty 0.512, unit "kg", unit_price 8990, amount como figura impreso.',
  'Descuentos: líneas con DTO, DESC, DESCUENTO, AHORRO, PROMO, BONIF o importe negativo => is_discount true y amount NEGATIVO. No las omitas.',
  'total = el importe final pagado (TOTAL manda sobre SUBTOTAL). subtotal = suma antes de descuentos si figura; si no, null. discount_total = suma de descuentos (número positivo, 0 si no hay).',
  'Ignorá como ítems: IVA, impuestos internos, percepciones, "SU PAGO", "EFECTIVO", "CAMBIO", "VUELTO", "TARJETA", "CUOTAS", números de comprobante, CUIT. Usá esas líneas solo para payment_hint (ej: "VISA", "DEBITO", "EFECTIVO", "MERCADOPAGO", "QR").',
  'merchant: nombre comercial del encabezado (ej: "COTO", "DIA", "CARREFOUR", "JUMBO", "FARMACITY", "MERCADO PAGO"), sin razón social ni sucursal. date: la del ticket en formato YYYY-MM-DD (acepta dd/mm/yyyy, dd-mm-yy); null si no se ve.',
  'currency: "USD" solo si el comprobante está claramente en dólares; si no, "ARS".',
  'Si la foto está cortada, borrosa o faltan renglones, agregá un warning en español y bajá confidence. confidence va de 0 a 1.',
  'Las descripciones de ítems van tal como figuran pero en una sola línea, sin códigos internos.'
].join('\n');

var TICKET_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['merchant', 'date', 'currency', 'total', 'subtotal', 'discount_total', 'items', 'payment_hint', 'confidence', 'warnings'],
  properties: {
    merchant: { type: ['string', 'null'] },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    currency: { type: 'string', enum: ['ARS', 'USD'] },
    total: { type: ['number', 'null'] },
    subtotal: { type: ['number', 'null'] },
    discount_total: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['desc', 'qty', 'unit', 'unit_price', 'amount', 'is_discount'],
        properties: {
          desc: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string', enum: ['u', 'kg', 'l', 'm'] },
          unit_price: { type: ['number', 'null'] },
          amount: { type: 'number' },
          is_discount: { type: 'boolean' }
        }
      }
    },
    payment_hint: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } }
  }
};

/* ---------- parse (texto libre: "1500 super galicia") ---------- */
var PARSE_SYSTEM = [
  'Sos el asistente de una app de finanzas personales de Argentina. Convertís un mensaje corto de texto en un movimiento.',
  'Usá SOLO cuentas, categorías y subcategorías de las listas que te paso (coincidencia flexible por nombre: "galicia" => "Bco Galicia", "visa" => la tarjeta Visa). Si no hay coincidencia razonable dejá el campo vacío y agregalo a missing.',
  'type: "expense" salvo que el texto diga cobré/ingreso/sueldo/me pagaron (income) o transferí/pasé de X a Y (transfer).',
  'amount: número positivo; "1.500,50" = 1500.5; "15k" = 15000; "20 usd" => currency USD. Si no hay importe, amount null y agregá "amount" a missing.',
  'date: hoy salvo que diga ayer/anteayer/una fecha; devolvé YYYY-MM-DD. note: lo que describe la compra (ej: "super", "nafta"), corto, sin la cuenta ni el importe.',
  'confidence 0 a 1. missing: lista de campos que no pudiste completar entre ["amount","account","category","sub"].',
  'Devolvé SOLO el JSON.'
].join('\n');

var PARSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['type', 'amount', 'currency', 'account', 'category', 'sub', 'note', 'date', 'confidence', 'missing'],
  properties: {
    type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
    amount: { type: ['number', 'null'] },
    currency: { type: 'string', enum: ['ARS', 'USD'] },
    account: { type: 'string' },
    category: { type: 'string' },
    sub: { type: 'string' },
    note: { type: 'string' },
    date: { type: 'string' },
    confidence: { type: 'number' },
    missing: { type: 'array', items: { type: 'string' } }
  }
};
