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

/* ---------- products (descripciones de ítems → producto del catálogo o nuevo) ---------- */
var PRODUCTS_SYSTEM = [
  'Sos un clasificador de ítems de tickets de supermercado de Argentina. Recibís descripciones abreviadas tal como las imprime el comercio y un catálogo; devolvés SOLO el JSON pedido.',
  'Dos niveles: kind = producto genérico independiente de la marca ("queso cremoso", "leche", "cafe"); variety = variante que cambia el producto ("instantaneo" vs "para filtro", "entera" vs "descremada"); brand = marca. "queso cremoso" de cualquier marca es el mismo kind.',
  'Reusá un kind de la lista si corresponde, con la misma redacción. Kinds nuevos: minúsculas, sin acentos, singular, sin marca.',
  'Elegí productId cuando el ítem es el mismo producto Y la misma presentación/tamaño que uno del catálogo (mirá también sus aliases). Tamaños distintos ("1 l" vs "500 ml") o packs ("x6") son productos distintos del mismo kind.',
  'Expandí abreviaturas típicas: QSO/QUES = queso, CREM = cremoso, P. DE AGUA/PDA = Punta del Agua, LS = La Serenisima, LECH = leche, MANT = manteca, GALL = galletitas, DESC = descremada, INST = instantaneo, FDEO = fideos, ACTE = aceite. Marcas usuales: La Serenisima, Sancor, Punta del Agua, Ilolay, Arcor, Bagley, Marolio, Ciudad del Lago, Coto, Dia, Carrefour, Quilmes, Coca Cola. brand "" si no se puede saber.',
  'name = "kind variety Marca tamaño" en castellano natural ("Queso cremoso Punta del Agua", "Cafe instantaneo Dolca 170 g"). unit: "kg" si es pesable, "l" si se vende por litro, si no "u". size: tamaño canónico ("1 l", "500 g", "473 ml x6") o "".',
  'Si dos descripciones del lote son el mismo producto nuevo, usá exactamente el mismo name. Ítems que no son productos (bolsa, envío, descuento, redondeo, propina): productId y new en null.',
  'confidence 0 a 1; menos de 0.5 si estás adivinando la marca o el kind.'
].join('\n');

var PRODUCTS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: { results: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['i', 'productId', 'confidence', 'new'],
    properties: {
      i: { type: 'integer' },
      productId: { type: ['string', 'null'] },
      confidence: { type: 'number' },
      new: { type: ['object', 'null'], additionalProperties: false, required: ['name', 'kind', 'variety', 'brand', 'size', 'unit'],
        properties: { name: { type: 'string' }, kind: { type: 'string' }, variety: { type: 'string' }, brand: { type: 'string' }, size: { type: 'string' }, unit: { type: 'string', enum: ['u', 'kg', 'l', 'm'] } } }
    } } } }
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
