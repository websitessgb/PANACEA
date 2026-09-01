/* =========================================================
   PANACEA ADMIN
   Primera versión sin base de datos
   Los pedidos se guardan en localStorage.
   ========================================================= */


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const ADMIN_STORAGE_KEY = 'panacea-admin-orders';

const PANACEA_WHATSAPP = '5358051138';

let orders = loadOrders();

let activeStatus = 'all';

let searchTerm = '';

let pendingParsedOrder = null;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const ordersList =
  document.getElementById('ordersList');

const emptyOrders =
  document.getElementById('emptyOrders');

const ordersCount =
  document.getElementById('ordersCount');

const searchOrders =
  document.getElementById('searchOrders');

const importDialog =
  document.getElementById('importDialog');

const orderDialog =
  document.getElementById('orderDialog');

const whatsappMessage =
  document.getElementById('whatsappMessage');

const importPreview =
  document.getElementById('importPreview');

const parseError =
  document.getElementById('parseError');

const saveImportBtn =
  document.getElementById('saveImportBtn');

const previewImportBtn =
  document.getElementById('previewImportBtn');

const orderDetail =
  document.getElementById('orderDetail');

const adminToast =
  document.getElementById('adminToast');


/* =========================================================
   FORMATO DE DINERO
   ========================================================= */

function money(value, currency = 'CUP'){

  const number = Number(value) || 0;

  return `${new Intl.NumberFormat('es-CU').format(number)} ${currency}`;

}


/* =========================================================
   FECHA
   ========================================================= */

function formatDate(dateString){

  const date = new Date(dateString);

  if(Number.isNaN(date.getTime())){
    return dateString || '';
  }

  return new Intl.DateTimeFormat(
    'es-CU',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    }
  ).format(date);

}


/* =========================================================
   SEMANA ISO
   ========================================================= */

function getISOWeek(date = new Date()){

  const d =
    new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );

  const day =
    d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() + 4 - day
  );

  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  return Math.ceil(
    (
      (
        (d - yearStart) / 86400000
      ) + 1
    ) / 7
  );

}


/* =========================================================
   AÑO ISO
   ========================================================= */

function getISOYear(date = new Date()){

  const d =
    new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );

  const day =
    d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() + 4 - day
  );

  return d.getUTCFullYear();

}


/* =========================================================
   CARGAR PEDIDOS
   ========================================================= */

function loadOrders(){

  try{

    const saved =
      localStorage.getItem(
        ADMIN_STORAGE_KEY
      );

    if(!saved){
      return [];
    }

    const parsed =
      JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];

  }catch(error){

    console.error(
      'No se pudieron cargar los pedidos:',
      error
    );

    return [];

  }

}


/* =========================================================
   GUARDAR PEDIDOS
   ========================================================= */

function saveOrders(){

  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify(orders)
  );

}


/* =========================================================
   ESCAPAR HTML
   Evita que nombres pegados desde WhatsApp
   puedan romper la interfaz.
   ========================================================= */

function escapeHTML(value){

  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

}


/* =========================================================
   ETIQUETAS DE ESTADO
   ========================================================= */

function statusLabel(status){

  const labels = {

    pending:'Pendiente',

    confirmed:'Confirmado',

    invoiced:'Facturado',

    delivered:'Entregado',

    cancelled:'Cancelado'

  };

  return labels[status] || 'Pendiente';

}


function statusClass(status){

  return `status-${status || 'pending'}`;

}


/* =========================================================
   ABRIR MODAL IMPORTAR
   ========================================================= */

function openImport(){

  whatsappMessage.value = '';

  importPreview.hidden = true;

  parseError.hidden = true;

  saveImportBtn.hidden = true;

  previewImportBtn.hidden = false;

  pendingParsedOrder = null;

  importDialog.showModal();

  setTimeout(
    () => whatsappMessage.focus(),
    100
  );

}


/* =========================================================
   CERRAR MODAL IMPORTAR
   ========================================================= */

function closeImport(){

  if(importDialog.open){
    importDialog.close();
  }

}


/* =========================================================
   EXTRAER CLIENTE
   ========================================================= */

function parseCustomer(text){

  const match =
    text.match(
      /(?:👤\s*)?Cliente\s*:\s*(.+)/i
    );

  return match
    ? match[1].trim()
    : '';

}


/* =========================================================
   EXTRAER TELÉFONO
   ========================================================= */

function parsePhone(text){

  const match =
    text.match(
      /(?:📞\s*)?Teléfono\s*:\s*([0-9+\-\s()]+)/i
    );

  if(!match){
    return '';
  }

  return match[1]
    .trim()
    .replace(/[^\d+]/g,'');

}


/* =========================================================
   EXTRAER SECCIÓN PRODUCTOS
   ========================================================= */

function getProductsSection(text){

  const start =
    text.search(
      /📦\s*PRODUCTOS/i
    );

  if(start === -1){
    return '';
  }

  const after =
    text.slice(start);

  const separator =
    after.indexOf(
      '━━━━━━━━━━━━━━'
    );

  if(separator !== -1){
    return after.slice(0,separator);
  }

  return after;

}


/* =========================================================
   EXTRAER PRODUCTOS
   Formato esperado:

   • Nombre — 2 pack × 2,660 CUP = 5,320 CUP

   También acepta:

   • Nombre — 2 saco × 30,000 CUP = 60,000 CUP

   ========================================================= */

function parseProducts(text){

  const section =
    getProductsSection(text);

  if(!section){
    return [];
  }

  const lines =
    section
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('•'));

  const products = [];

  lines.forEach(line => {

    const clean =
      line.replace(/^•\s*/,'').trim();

    const match =
      clean.match(
        /^(.+?)\s+—\s+(\d+)\s+(.+?)\s+×\s+([\d.,]+)\s+(CUP|USD)\s+=\s+([\d.,]+)\s+(CUP|USD)$/i
      );

    if(!match){
      return;
    }

    const name =
      match[1].trim();

    const quantity =
      Number(match[2]);

    const presentation =
      match[3].trim();

    const unitPrice =
      parseNumber(match[4]);

    const currency =
      match[5].toUpperCase();

    const lineTotal =
      parseNumber(match[6]);

    products.push({

      name,

      quantity,

      presentation,

      unitPrice,

      currency,

      total:lineTotal

    });

  });

  return products;

}


/* =========================================================
   CONVERTIR NÚMEROS
   ========================================================= */

function parseNumber(value){

  if(value === undefined || value === null){
    return 0;
  }

  return Number(
    String(value)
      .replace(/\./g,'')
      .replace(/,/g,'')
      .replace(/[^\d.-]/g,'')
  ) || 0;

}


/* =========================================================
   EXTRAER TOTALES
   ========================================================= */

function parseTotals(text){

  const cupMatch =
    text.match(
      /TOTAL\s+CUP\s*:\s*([\d.,]+)\s*CUP/i
    );

  const usdMatch =
    text.match(
      /TOTAL\s+USD\s*:\s*([\d.,]+)\s*USD/i
    );

  return {

    CUP:
      cupMatch
        ? parseNumber(cupMatch[1])
        : 0,

    USD:
      usdMatch
        ? parseNumber(usdMatch[1])
        : 0

  };

}


/* =========================================================
   CREAR NÚMERO CONSECUTIVO
   Ejemplo:

   PAN-2026-S36-001

   El consecutivo se reinicia cada semana.
   ========================================================= */

function nextOrderNumber(date = new Date()){

  const year =
    getISOYear(date);

  const week =
    String(
      getISOWeek(date)
    ).padStart(2,'0');

  const prefix =
    `PAN-${year}-S${week}-`;

  const sameWeek =
    orders.filter(order =>
      String(order.orderNumber || '')
        .startsWith(prefix)
    );

  let highest = 0;

  sameWeek.forEach(order => {

    const match =
      String(order.orderNumber)
        .match(
          /-(\d+)$/
        );

    if(match){

      highest =
        Math.max(
          highest,
          Number(match[1])
        );

    }

  });

  return (
    prefix +
    String(highest + 1)
      .padStart(3,'0')
  );

}


/* =========================================================
   PARSEAR PEDIDO COMPLETO
   ========================================================= */

function parseWhatsAppOrder(text){

  const cleanText =
    String(text || '')
      .replace(/\r/g,'');

  if(!cleanText.trim()){

    throw new Error(
      'Pega primero el mensaje completo de WhatsApp.'
    );

  }


  if(!/PEDIDO\s+PANACEA/i.test(cleanText)){

    throw new Error(
      'No parece ser un pedido generado por PANACEA.'
    );

  }


  const customer =
    parseCustomer(cleanText);

  if(!customer){

    throw new Error(
      'No pude encontrar el nombre del cliente.'
    );

  }


  const phone =
    parsePhone(cleanText);

  if(!phone){

    throw new Error(
      'No pude encontrar el teléfono del cliente.'
    );

  }


  const products =
    parseProducts(cleanText);

  if(!products.length){

    throw new Error(
      'No pude interpretar los productos. Asegúrate de pegar el mensaje completo de WhatsApp.'
    );

  }


  const totals =
    parseTotals(cleanText);


  /*
   * Si por alguna razón no aparece el total,
   * lo calculamos desde las líneas.
   */

  if(
    totals.CUP === 0 &&
    totals.USD === 0
  ){

    totals.CUP =
      products
        .filter(p => p.currency === 'CUP')
        .reduce(
          (sum,p) => sum + p.total,
          0
        );

    totals.USD =
      products
        .filter(p => p.currency === 'USD')
        .reduce(
          (sum,p) => sum + p.total,
          0
        );

  }


  const now =
    new Date();

  return {

    orderNumber:
      nextOrderNumber(now),

    createdAt:
      now.toISOString(),

    week:
      getISOWeek(now),

    year:
      getISOYear(now),

    customer,

    phone,

    products,

    totals,

    status:'pending',

    source:'whatsapp',

    rawMessage:cleanText

  };

}


/* =========================================================
   MOSTRAR ERROR
   ========================================================= */

function showParseError(message){

  parseError.textContent =
    message;

  parseError.hidden = false;

}


/* =========================================================
   REVISAR IMPORTACIÓN
   ========================================================= */

function previewImport(){

  parseError.hidden = true;

  try{

    pendingParsedOrder =
      parseWhatsAppOrder(
        whatsappMessage.value
      );


    importPreview.hidden = false;

    saveImportBtn.hidden = false;

    previewImportBtn.hidden = true;


    document.getElementById(
      'previewOrderNumber'
    ).textContent =
      pendingParsedOrder.orderNumber;


    document.getElementById(
      'previewCustomer'
    ).textContent =
      pendingParsedOrder.customer;


    document.getElementById(
      'previewPhone'
    ).textContent =
      pendingParsedOrder.phone;


    document.getElementById(
      'previewProducts'
    ).textContent =
      `${pendingParsedOrder.products.length} producto(s)`;


    document.getElementById(
      'previewTotal'
    ).textContent =
      formatTotals(
        pendingParsedOrder.totals
      );

  }catch(error){

    pendingParsedOrder = null;

    importPreview.hidden = true;

    saveImportBtn.hidden = true;

    previewImportBtn.hidden = false;

    showParseError(
      error.message
    );

  }

}


/* =========================================================
   CREAR PEDIDO
   ========================================================= */

function createOrder(){

  if(!pendingParsedOrder){

    showParseError(
      'Primero debes revisar el pedido.'
    );

    return;

  }


  const duplicate =
    orders.find(order =>
      order.rawMessage ===
      pendingParsedOrder.rawMessage
    );


  if(duplicate){

    showParseError(
      `Este pedido ya fue importado como ${duplicate.orderNumber}.`
    );

    return;

  }


  orders.unshift(
    pendingParsedOrder
  );

  saveOrders();

  closeImport();

  renderAll();

  showToast(
    `Pedido ${pendingParsedOrder.orderNumber} creado correctamente.`
  );

  pendingParsedOrder = null;

}


/* =========================================================
   FORMATEAR TOTALES
   ========================================================= */

function formatTotals(totals){

  const result = [];

  if(Number(totals.CUP) > 0){

    result.push(
      money(totals.CUP,'CUP')
    );

  }

  if(Number(totals.USD) > 0){

    result.push(
      money(totals.USD,'USD')
    );

  }

  return result.join(' · ') || '0';

}


/* =========================================================
   FILTRAR PEDIDOS
   ========================================================= */

function filteredOrders(){

  const query =
    searchTerm
      .toLowerCase()
      .trim();


  return orders.filter(order => {

    const statusOk =
      activeStatus === 'all' ||
      order.status === activeStatus;


    if(!statusOk){
      return false;
    }


    if(!query){
      return true;
    }


    const searchable = [

      order.orderNumber,

      order.customer,

      order.phone,

      ...(order.products || [])
        .map(product => product.name)

    ]
      .join(' ')
      .toLowerCase();


    return searchable.includes(query);

  });

}


/* =========================================================
   RENDER LISTADO
   ========================================================= */

function renderOrders(){

  const list =
    filteredOrders();


  ordersCount.textContent =
    `${list.length} ${
      list.length === 1
        ? 'pedido'
        : 'pedidos'
    }`;


  ordersList.innerHTML =
    list.map(order => {

      const total =
        formatTotals(
          order.totals
        );


      const productNames =
        (order.products || [])
          .map(product =>
            `${product.quantity} ${product.name}`
          )
          .join(' · ');


      return `

        <article
          class="order-card"
          data-order-id="${escapeHTML(order.orderNumber)}"
        >

          <div>

            <div class="order-number">
              ${escapeHTML(order.orderNumber)}
            </div>

            <div class="order-date">
              ${escapeHTML(formatDate(order.createdAt))}
            </div>

          </div>


          <div>

            <div class="order-customer">
              ${escapeHTML(order.customer)}
            </div>

            <div class="order-phone">
              ${escapeHTML(order.phone)}
            </div>

            <div class="order-summary">
              ${escapeHTML(productNames)}
            </div>

          </div>


          <div class="order-right">

            <div class="order-total">
              ${escapeHTML(total)}
            </div>

            <span
              class="status-badge ${statusClass(order.status)}"
            >
              ${escapeHTML(statusLabel(order.status))}
            </span>

            <br>

            <button
              type="button"
              class="order-open-btn"
              data-open-order="${escapeHTML(order.orderNumber)}"
            >
              Ver pedido →
            </button>

          </div>

        </article>

      `;

    }).join('');


  emptyOrders.hidden =
    list.length !== 0;


  ordersList.hidden =
    list.length === 0;


  document
    .querySelectorAll('[data-open-order]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          openOrder(
            button.dataset.openOrder
          )
      );

    });

}


/* =========================================================
   RENDER ESTADÍSTICAS
   ========================================================= */

function renderStats(){

  document.getElementById(
    'statTotal'
  ).textContent =
    orders.length;


  document.getElementById(
    'statPending'
  ).textContent =
    orders.filter(
      order =>
        order.status === 'pending'
    ).length;


  document.getElementById(
    'statInvoiced'
  ).textContent =
    orders.filter(
      order =>
        order.status === 'invoiced'
    ).length;


  const cup =
    orders.reduce(
      (sum,order) =>
        sum +
        Number(
          order.totals?.CUP || 0
        ),
      0
    );


  document.getElementById(
    'statCup'
  ).textContent =
    money(cup,'CUP');

}


/* =========================================================
   RENDER TODO
   ========================================================= */

function renderAll(){

  renderStats();

  renderOrders();

}


/* =========================================================
   ABRIR DETALLE
   ========================================================= */

function openOrder(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const products =
    (order.products || [])
      .map(product => `

        <div class="detail-product">

          <div>
            <strong>
              ${escapeHTML(product.name)}
            </strong>

            <br>

            <small>
              ${escapeHTML(product.presentation)}
            </small>
          </div>

          <div>
            ${escapeHTML(String(product.quantity))}
          </div>

          <div>
            ${escapeHTML(
              money(
                product.total,
                product.currency
              )
            )}
          </div>

        </div>

      `)
      .join('');


  orderDetail.innerHTML = `

    <div class="order-detail">

      <button
        type="button"
        class="dialog-x"
        data-close-order
        aria-label="Cerrar"
      >
        ×
      </button>


      <div class="detail-top">

        <div>

          <div class="detail-number">
            ${escapeHTML(order.orderNumber)}
          </div>

          <div class="detail-date">
            ${escapeHTML(formatDate(order.createdAt))}
            · Semana ${escapeHTML(String(order.week))}
          </div>

        </div>


        <span
          class="status-badge ${statusClass(order.status)}"
        >
          ${escapeHTML(statusLabel(order.status))}
        </span>

      </div>


      <div class="detail-customer">

        <div class="detail-box">

          <small>CLIENTE</small>

          <strong>
            ${escapeHTML(order.customer)}
          </strong>

        </div>


        <div class="detail-box">

          <small>TELÉFONO</small>

          <strong>
            ${escapeHTML(order.phone)}
          </strong>

        </div>

      </div>


      <div class="detail-products">

        <h3>Productos</h3>

        ${products}

      </div>


      <div class="detail-totals">

        <div class="detail-total">
          ${escapeHTML(
            formatTotals(order.totals)
          )}
        </div>

      </div>


      <div class="detail-actions">

        <button
          type="button"
          data-send-self="${escapeHTML(order.orderNumber)}"
        >
          📱 Enviar a mi WhatsApp
        </button>


        <button
          type="button"
          data-send-client="${escapeHTML(order.orderNumber)}"
        >
          👤 Enviar al cliente
        </button>


        <button
          type="button"
          data-copy-order="${escapeHTML(order.orderNumber)}"
        >
          📋 Copiar pedido
        </button>


        <button
          type="button"
          data-status="${escapeHTML(order.orderNumber)}"
        >
          🔄 Cambiar estado
        </button>


        <button
          type="button"
          class="danger"
          data-delete-order="${escapeHTML(order.orderNumber)}"
        >
          🗑️ Eliminar
        </button>

      </div>

    </div>

  `;


  orderDialog.showModal();


  document
    .querySelector('[data-close-order]')
    ?.addEventListener(
      'click',
      () => orderDialog.close()
    );


  document
    .querySelector('[data-send-self]')
    ?.addEventListener(
      'click',
      () =>
        sendToSelf(
          order.orderNumber
        )
    );


  document
    .querySelector('[data-send-client]')
    ?.addEventListener(
      'click',
      () =>
        sendToClient(
          order.orderNumber
        )
    );


  document
    .querySelector('[data-copy-order]')
    ?.addEventListener(
      'click',
      () =>
        copyOrder(
          order.orderNumber
        )
    );


  document
    .querySelector('[data-status]')
    ?.addEventListener(
      'click',
      () =>
        changeStatus(
          order.orderNumber
        )
    );


  document
    .querySelector('[data-delete-order]')
    ?.addEventListener(
      'click',
      () =>
        deleteOrder(
          order.orderNumber
        )
    );

}


/* =========================================================
   CAMBIAR ESTADO
   ========================================================= */

function changeStatus(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const statuses = [

    'pending',

    'confirmed',

    'invoiced',

    'delivered',

    'cancelled'

  ];


  const current =
    statuses.indexOf(
      order.status
    );


  const next =
    statuses[
      (current + 1) %
      statuses.length
    ];


  order.status =
    next;


  saveOrders();

  renderAll();

  openOrder(orderNumber);

  showToast(
    `Estado: ${statusLabel(next)}`
  );

}


/* =========================================================
   ELIMINAR
   ========================================================= */

function deleteOrder(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const confirmed =
    window.confirm(
      `¿Eliminar el pedido ${order.orderNumber}?`
    );


  if(!confirmed){
    return;
  }


  orders =
    orders.filter(
      item =>
        item.orderNumber !==
        orderNumber
    );


  saveOrders();

  orderDialog.close();

  renderAll();

  showToast(
    'Pedido eliminado.'
  );

}


/* =========================================================
   CREAR TEXTO PARA WHATSAPP
   ========================================================= */

function buildOrderMessage(order){

  const lines =
    (order.products || [])
      .map(product =>
        `• ${product.name} — ${product.quantity} ${product.presentation} × ${money(product.unitPrice,product.currency)} = ${money(product.total,product.currency)}`
      );


  let totals = '';


  if(Number(order.totals?.CUP) > 0){

    totals +=
      `💰 TOTAL CUP: ${money(order.totals.CUP,'CUP')}\n`;

  }


  if(Number(order.totals?.USD) > 0){

    totals +=
      `💵 TOTAL USD: ${money(order.totals.USD,'USD')}\n`;

  }


  return `🛍️ PEDIDO PANACEA

🔢 Pedido: ${order.orderNumber}

👤 Cliente: ${order.customer}
📞 Teléfono: ${order.phone}

📦 PRODUCTOS
${lines.join('\n')}

━━━━━━━━━━━━━━
${totals}
📌 Estado: ${statusLabel(order.status)}`;

}


/* =========================================================
   NORMALIZAR TELÉFONO CUBA
   ========================================================= */

function normalizeCubanPhone(phone){

  let value =
    String(phone || '')
      .replace(/[^\d]/g,'');


  if(value.startsWith('00')){
    value = value.slice(2);
  }


  if(value.startsWith('53')){
    return value;
  }


  /*
   * Si el cliente dio un número cubano
   * de 8 dígitos, añadimos +53.
   */

  if(value.length === 8){
    return `53${value}`;
  }


  return value;

}


/* =========================================================
   ENVIAR A MI WHATSAPP
   ========================================================= */

function sendToSelf(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const message =
    buildOrderMessage(order);


  const url =
    `https://wa.me/${PANACEA_WHATSAPP}?text=${encodeURIComponent(message)}`;


  window.open(
    url,
    '_blank'
  );


  showToast(
    'Abriendo WhatsApp.'
  );

}


/* =========================================================
   ENVIAR AL CLIENTE
   ========================================================= */

function sendToClient(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const phone =
    normalizeCubanPhone(
      order.phone
    );


  if(!phone){

    showToast(
      'El teléfono del cliente no es válido.'
    );

    return;

  }


  const message =
`Hola ${order.customer} 👋

Le escribimos de PANACEA en relación con su pedido ${order.orderNumber}.

${buildOrderMessage(order)}

Si necesita alguna aclaración, estamos a su disposición.`;


  const url =
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;


  window.open(
    url,
    '_blank'
  );


  showToast(
    'Abriendo WhatsApp del cliente.'
  );

}


/* =========================================================
   COPIAR PEDIDO
   ========================================================= */

async function copyOrder(orderNumber){

  const order =
    orders.find(
      item =>
        item.orderNumber ===
        orderNumber
    );


  if(!order){
    return;
  }


  const message =
    buildOrderMessage(order);


  try{

    await navigator.clipboard.writeText(
      message
    );

    showToast(
      'Pedido copiado al portapapeles.'
    );

  }catch(error){

    showToast(
      'No se pudo copiar automáticamente.'
    );

  }

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(message){

  adminToast.textContent =
    message;

  adminToast.classList.add('show');


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(
      () =>
        adminToast.classList.remove('show'),
      2800
    );

}


/* =========================================================
   EVENTOS
   ========================================================= */


/* Nuevo pedido */

document
  .getElementById('openImportBtn')
  .addEventListener(
    'click',
    openImport
  );


document
  .getElementById('emptyImportBtn')
  .addEventListener(
    'click',
    openImport
  );


/* Cerrar */

document
  .getElementById('closeImportBtn')
  .addEventListener(
    'click',
    closeImport
  );


document
  .getElementById('cancelImportBtn')
  .addEventListener(
    'click',
    closeImport
  );


/* Revisar */

previewImportBtn
  .addEventListener(
    'click',
    previewImport
  );


/* Crear */

document
  .getElementById('importForm')
  .addEventListener(
    'submit',
    event => {

      event.preventDefault();

      createOrder();

    }
  );


/* Buscar */

searchOrders
  .addEventListener(
    'input',
    event => {

      searchTerm =
        event.target.value;

      renderOrders();

    }
  );


/* Filtros */

document
  .querySelectorAll('.order-filter')
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {

        document
          .querySelectorAll('.order-filter')
          .forEach(item =>
            item.classList.remove(
              'active'
            )
          );


        button.classList.add(
          'active'
        );


        activeStatus =
          button.dataset.status;


        renderOrders();

      }
    );

  });


/* Cerrar dialogs */

orderDialog.addEventListener(
  'click',
  event => {

    if(
      event.target ===
      orderDialog
    ){

      orderDialog.close();

    }

  }
);


/* =========================================================
   INICIO
   ========================================================= */

renderAll();
