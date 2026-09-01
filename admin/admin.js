const ADMIN_STORAGE_KEY='panacea-admin-orders';
const PANACEA_WHATSAPP='5358051138';

let orders=loadOrders(),activeStatus='all',searchTerm='',pendingParsedOrder=null;

const ordersList=document.getElementById('ordersList');
const emptyOrders=document.getElementById('emptyOrders');
const ordersCount=document.getElementById('ordersCount');
const searchOrders=document.getElementById('searchOrders');
const importDialog=document.getElementById('importDialog');
const orderDialog=document.getElementById('orderDialog');
const whatsappMessage=document.getElementById('whatsappMessage');
const importPreview=document.getElementById('importPreview');
const parseError=document.getElementById('parseError');
const saveImportBtn=document.getElementById('saveImportBtn');
const previewImportBtn=document.getElementById('previewImportBtn');
const orderDetail=document.getElementById('orderDetail');
const adminToast=document.getElementById('adminToast');

function money(v,c='CUP'){
  return `${new Intl.NumberFormat('es-CU').format(Number(v)||0)} ${c}`;
}

function formatDate(v){
  const d=new Date(v);
  return Number.isNaN(d.getTime())?v||'':new Intl.DateTimeFormat('es-CU',{
    day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit'
  }).format(d);
}

function getISOWeek(d=new Date()){
  d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-y)/86400000)+1)/7);
}

function getISOYear(d=new Date()){
  d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  return d.getUTCFullYear();
}

function loadOrders(){
  try{
    const x=JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)||'[]');
    return Array.isArray(x)?x:[];
  }catch(e){return []}
}

function saveOrders(){
  localStorage.setItem(ADMIN_STORAGE_KEY,JSON.stringify(orders));
}

function escapeHTML(v){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function statusLabel(s){
  return{
    pending:'Pendiente',
    confirmed:'Confirmado',
    invoiced:'Facturado',
    delivered:'Entregado',
    cancelled:'Cancelado'
  }[s]||'Pendiente';
}

function statusClass(s){
  return `status-${s||'pending'}`;
}

/* =========================
   IMPORTAR PEDIDO
========================= */

function openImport(){
  whatsappMessage.value='';
  importPreview.hidden=true;
  parseError.hidden=true;
  saveImportBtn.hidden=true;
  previewImportBtn.hidden=false;
  pendingParsedOrder=null;
  importDialog.showModal();
  setTimeout(()=>whatsappMessage.focus(),100);
}

function closeImport(){
  if(importDialog.open)importDialog.close();
}

function parseCustomer(t){
  const m=t.match(/(?:👤\s*)?Cliente\s*:\s*(.+)/i);
  return m?m[1].trim():'';
}

function parsePhone(t){
  const m=t.match(/(?:📞\s*)?Teléfono\s*:\s*([0-9+\-\s()]+)/i);
  return m?m[1].trim().replace(/[^\d+]/g,''):'';
}

function getProductsSection(t){
  const s=t.search(/📦\s*PRODUCTOS/i);
  if(s===-1)return '';
  const a=t.slice(s),x=a.indexOf('━━━━━━━━━━━━━━');
  return x!==-1?a.slice(0,x):a;
}

function parseNumber(v){
  return Number(
    String(v??'')
      .replace(/\./g,'')
      .replace(/,/g,'')
      .replace(/[^\d.-]/g,'')
  )||0;
}

function parseProducts(t){
  const s=getProductsSection(t);
  if(!s)return [];

  return s.split('\n')
    .map(x=>x.trim())
    .filter(x=>x.startsWith('•'))
    .map(line=>{
      const c=line.replace(/^•\s*/,'').trim();
      const m=c.match(
        /^(.+?)\s+—\s+(\d+)\s+(.+?)\s+×\s+([\d.,]+)\s+(CUP|USD)\s+=\s+([\d.,]+)\s+(CUP|USD)$/i
      );

      if(!m)return null;

      return{
        name:m[1].trim(),
        quantity:Number(m[2]),
        presentation:m[3].trim(),
        unitPrice:parseNumber(m[4]),
        currency:m[5].toUpperCase(),
        total:parseNumber(m[6])
      };
    })
    .filter(Boolean);
}

function parseTotals(t){
  const cup=t.match(/TOTAL\s+CUP\s*:\s*([\d.,]+)\s*CUP/i);
  const usd=t.match(/TOTAL\s+USD\s*:\s*([\d.,]+)\s*USD/i);

  return{
    CUP:cup?parseNumber(cup[1]):0,
    USD:usd?parseNumber(usd[1]):0
  };
}

function nextOrderNumber(d=new Date()){
  const prefix=
    `PAN-${getISOYear(d)}-S${String(getISOWeek(d)).padStart(2,'0')}-`;

  let n=0;

  orders
    .filter(o=>String(o.orderNumber||'').startsWith(prefix))
    .forEach(o=>{
      const m=String(o.orderNumber).match(/-(\d+)$/);
      if(m)n=Math.max(n,Number(m[1]));
    });

  return prefix+String(n+1).padStart(3,'0');
}

function parseWhatsAppOrder(text){
  const t=String(text||'').replace(/\r/g,'');

  if(!t.trim())
    throw new Error('Pega primero el mensaje completo de WhatsApp.');

  if(!/PEDIDO\s+PANACEA/i.test(t))
    throw new Error('No parece ser un pedido generado por PANACEA.');

  const customer=parseCustomer(t);
  if(!customer)
    throw new Error('No pude encontrar el nombre del cliente.');

  const phone=parsePhone(t);
  if(!phone)
    throw new Error('No pude encontrar el teléfono del cliente.');

  const products=parseProducts(t);
  if(!products.length)
    throw new Error('No pude interpretar los productos. Asegúrate de pegar el mensaje completo.');

  const totals=parseTotals(t);

  if(!totals.CUP&&!totals.USD){
    totals.CUP=products
      .filter(p=>p.currency==='CUP')
      .reduce((s,p)=>s+p.total,0);

    totals.USD=products
      .filter(p=>p.currency==='USD')
      .reduce((s,p)=>s+p.total,0);
  }

  const now=new Date();

  return{
    orderNumber:nextOrderNumber(now),
    createdAt:now.toISOString(),
    week:getISOWeek(now),
    year:getISOYear(now),
    customer,
    phone,
    products,
    totals,
    status:'pending',
    source:'whatsapp',
    rawMessage:t
  };
}

function showParseError(m){
  parseError.textContent=m;
  parseError.hidden=false;
}

function formatTotals(t){
  const r=[];

  if(Number(t?.CUP)>0)
    r.push(money(t.CUP,'CUP'));

  if(Number(t?.USD)>0)
    r.push(money(t.USD,'USD'));

  return r.join(' · ')||'0';
}

function previewImport(){
  parseError.hidden=true;

  try{
    pendingParsedOrder=parseWhatsAppOrder(whatsappMessage.value);

    importPreview.hidden=false;
    saveImportBtn.hidden=false;
    previewImportBtn.hidden=true;

    document.getElementById('previewOrderNumber').textContent=
      pendingParsedOrder.orderNumber;

    document.getElementById('previewCustomer').textContent=
      pendingParsedOrder.customer;

    document.getElementById('previewPhone').textContent=
      pendingParsedOrder.phone;

    document.getElementById('previewProducts').textContent=
      `${pendingParsedOrder.products.length} producto(s)`;

    document.getElementById('previewTotal').textContent=
      formatTotals(pendingParsedOrder.totals);

  }catch(e){
    pendingParsedOrder=null;
    importPreview.hidden=true;
    saveImportBtn.hidden=true;
    previewImportBtn.hidden=false;
    showParseError(e.message);
  }
}

function createOrder(){
  if(!pendingParsedOrder)
    return showParseError('Primero debes revisar el pedido.');

  const d=orders.find(
    o=>o.rawMessage===pendingParsedOrder.rawMessage
  );

  if(d)
    return showParseError(
      `Este pedido ya fue importado como ${d.orderNumber}.`
    );

  orders.unshift(pendingParsedOrder);
  saveOrders();
  closeImport();
  renderAll();

  showToast(
    `Pedido ${pendingParsedOrder.orderNumber} creado correctamente.`
  );

  pendingParsedOrder=null;
}

/* =========================
   LISTADO Y FILTROS
   SOLO FILTRAN
========================= */

function filteredOrders(){
  const q=searchTerm.toLowerCase().trim();

  return orders.filter(o=>{
    if(activeStatus!=='all'&&o.status!==activeStatus)
      return false;

    if(!q)return true;

    const s=[
      o.orderNumber,
      o.customer,
      o.phone,
      ...(o.products||[]).map(p=>p.name)
    ].join(' ').toLowerCase();

    return s.includes(q);
  });
}

function renderOrders(){
  const list=filteredOrders();

  ordersCount.textContent=
    `${list.length} ${list.length===1?'pedido':'pedidos'}`;

  ordersList.innerHTML=list.map(o=>{
    const products=(o.products||[])
      .map(p=>`${p.quantity} ${p.name}`)
      .join(' · ');

    return`
      <article class="order-card">

        <div>
          <div class="order-number">
            ${escapeHTML(o.orderNumber)}
          </div>

          <div class="order-date">
            ${escapeHTML(formatDate(o.createdAt))}
          </div>
        </div>

        <div>
          <div class="order-customer">
            ${escapeHTML(o.customer)}
          </div>

          <div class="order-phone">
            ${escapeHTML(o.phone)}
          </div>

          <div class="order-summary">
            ${escapeHTML(products)}
          </div>
        </div>

        <div class="order-right">

          <div class="order-total">
            ${escapeHTML(formatTotals(o.totals))}
          </div>

          <!-- ESTADO: SOLO INFORMACIÓN -->
          <span class="status-badge ${statusClass(o.status)}">
            ${escapeHTML(statusLabel(o.status))}
          </span>

          <br>

          <button
            type="button"
            class="order-open-btn"
            data-open-order="${escapeHTML(o.orderNumber)}">
            Ver pedido →
          </button>

        </div>

      </article>`;
  }).join('');

  emptyOrders.hidden=list.length!==0;
  ordersList.hidden=list.length===0;

  document.querySelectorAll('[data-open-order]')
    .forEach(b=>{
      b.addEventListener(
        'click',
        ()=>openOrder(b.dataset.openOrder)
      );
    });
}

function renderStats(){
  document.getElementById('statTotal').textContent=orders.length;

  document.getElementById('statPending').textContent=
    orders.filter(o=>o.status==='pending').length;

  document.getElementById('statInvoiced').textContent=
    orders.filter(o=>o.status==='invoiced').length;

  const cup=orders.reduce(
    (s,o)=>s+Number(o.totals?.CUP||0),0
  );

  document.getElementById('statCup').textContent=
    money(cup,'CUP');
}

function renderAll(){
  renderStats();
  renderOrders();
}

/* =========================
   VER PEDIDO
========================= */

function openOrder(orderNumber){
  const o=orders.find(x=>x.orderNumber===orderNumber);
  if(!o)return;

  const products=(o.products||[]).map(p=>`
    <div class="detail-product">

      <div>
        <strong>${escapeHTML(p.name)}</strong><br>
        <small>${escapeHTML(p.presentation)}</small>
      </div>

      <div>${p.quantity}</div>

      <div>
        ${escapeHTML(money(p.total,p.currency))}
      </div>

    </div>
  `).join('');

  orderDetail.innerHTML=`
    <div class="order-detail">

      <button
        type="button"
        class="dialog-x"
        data-close-order
        aria-label="Cerrar">
        ×
      </button>

      <div class="detail-top">

        <div>
          <div class="detail-number">
            ${escapeHTML(o.orderNumber)}
          </div>

          <div class="detail-date">
            ${escapeHTML(formatDate(o.createdAt))}
            · Semana ${o.week}
          </div>
        </div>

        <span class="status-badge ${statusClass(o.status)}">
          ${escapeHTML(statusLabel(o.status))}
        </span>

      </div>

      <div class="detail-customer">

        <div class="detail-box">
          <small>CLIENTE</small>
          <strong>${escapeHTML(o.customer)}</strong>
        </div>

        <div class="detail-box">
          <small>TELÉFONO</small>
          <strong>${escapeHTML(o.phone)}</strong>
        </div>

      </div>

      <div class="detail-products">
        <h3>Productos</h3>
        ${products}
      </div>

      <div class="detail-totals">
        <div class="detail-total">
          ${escapeHTML(formatTotals(o.totals))}
        </div>
      </div>

      <div class="detail-actions">

        <button
          type="button"
          data-send-self="${escapeHTML(o.orderNumber)}">
          📱 Enviar a mi WhatsApp
        </button>

        <button
          type="button"
          data-send-client="${escapeHTML(o.orderNumber)}">
          👤 Enviar al cliente
        </button>

        <button
          type="button"
          data-copy-order="${escapeHTML(o.orderNumber)}">
          📋 Copiar pedido
        </button>

        <button
          type="button"
          data-status="${escapeHTML(o.orderNumber)}">
          🔄 Cambiar estado
        </button>

        <button
          type="button"
          class="danger"
          data-delete-order="${escapeHTML(o.orderNumber)}">
          🗑️ Eliminar
        </button>

      </div>

    </div>
  `;

  orderDialog.showModal();

  orderDetail
    .querySelector('[data-close-order]')
    ?.addEventListener(
      'click',
      ()=>orderDialog.close()
    );

  orderDetail
    .querySelector('[data-send-self]')
    ?.addEventListener(
      'click',
      ()=>sendToSelf(orderNumber)
    );

  orderDetail
    .querySelector('[data-send-client]')
    ?.addEventListener(
      'click',
      ()=>sendToClient(orderNumber)
    );

  orderDetail
    .querySelector('[data-copy-order]')
    ?.addEventListener(
      'click',
      ()=>copyOrder(orderNumber)
    );

  orderDetail
    .querySelector('[data-status]')
    ?.addEventListener(
      'click',
      ()=>changeStatus(orderNumber)
    );

  orderDetail
    .querySelector('[data-delete-order]')
    ?.addEventListener(
      'click',
      ()=>deleteOrder(orderNumber)
    );
}

/* =========================
   CAMBIAR ESTADO
   SOLO DENTRO DE VER PEDIDO
========================= */

function changeStatus(orderNumber){
  const order=orders.find(
    o=>o.orderNumber===orderNumber
  );

  if(!order)return;

  const detail=document.getElementById('orderDetail');

  /* IMPORTANTE:
     Busca el botón SOLO dentro de Ver pedido */
  const button=detail.querySelector('[data-status]');

  if(!button)return;

  if(detail.querySelector('[data-status-editor]'))
    return;

  const box=document.createElement('div');

  box.dataset.statusEditor='';

  box.innerHTML=`
    <div style="
      margin-top:15px;
      padding:15px;
      background:#f6f4ef;
      border:1px solid #ddd;
      border-radius:14px">

      <label style="
        display:block;
        font-weight:700;
        margin-bottom:8px">
        Cambiar estado del pedido
      </label>

      <select
        data-status-select
        style="
          width:100%;
          padding:12px;
          border:1px solid #ccc;
          border-radius:10px;
          font-size:16px;
          background:#fff">

        <option
          value="pending"
          ${order.status==='pending'?'selected':''}>
          Pendiente
        </option>

        <option
          value="confirmed"
          ${order.status==='confirmed'?'selected':''}>
          Confirmado
        </option>

        <option
          value="invoiced"
          ${order.status==='invoiced'?'selected':''}>
          Facturado
        </option>

        <option
          value="delivered"
          ${order.status==='delivered'?'selected':''}>
          Entregado
        </option>

        <option
          value="cancelled"
          ${order.status==='cancelled'?'selected':''}>
          Cancelado
        </option>

      </select>

      <div style="
        display:flex;
        gap:8px;
        margin-top:10px">

        <button
          type="button"
          data-save-status
          style="
            flex:1;
            padding:11px;
            border:0;
            border-radius:10px;
            background:#263a32;
            color:#fff;
            font-weight:700">

          ✓ Guardar estado

        </button>

        <button
          type="button"
          data-cancel-status
          style="
            flex:1;
            padding:11px;
            border:1px solid #ccc;
            border-radius:10px;
            background:#fff;
            font-weight:600">

          Cancelar

        </button>

      </div>

    </div>
  `;

  button.insertAdjacentElement('afterend',box);
  button.hidden=true;

  const select=box.querySelector('[data-status-select]');

  box.querySelector('[data-save-status]').onclick=()=>{

    order.status=select.value;

    saveOrders();

    orderDialog.close();

    renderAll();

    showToast(
      `Estado cambiado a: ${statusLabel(order.status)}`
    );
  };

  box.querySelector('[data-cancel-status]').onclick=()=>{
    box.remove();
    button.hidden=false;
  };

  select.focus();
}

/* =========================
   ELIMINAR
========================= */

function deleteOrder(orderNumber){
  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;

  if(!confirm(
    `¿Eliminar el pedido ${o.orderNumber}?`
  ))return;

  orders=orders.filter(
    x=>x.orderNumber!==orderNumber
  );

  saveOrders();
  orderDialog.close();
  renderAll();

  showToast('Pedido eliminado.');
}

/* =========================
   WHATSAPP
========================= */

function buildOrderMessage(o){
  const lines=(o.products||[]).map(p=>
    `• ${p.name} — ${p.quantity} ${p.presentation} × ${money(p.unitPrice,p.currency)} = ${money(p.total,p.currency)}`
  );

  let totals='';

  if(Number(o.totals?.CUP)>0)
    totals+=`💰 TOTAL CUP: ${money(o.totals.CUP,'CUP')}\n`;

  if(Number(o.totals?.USD)>0)
    totals+=`💵 TOTAL USD: ${money(o.totals.USD,'USD')}\n`;

  return`🛍️ PEDIDO PANACEA

🔢 Pedido: ${o.orderNumber}

👤 Cliente: ${o.customer}
📞 Teléfono: ${o.phone}

📦 PRODUCTOS
${lines.join('\n')}

━━━━━━━━━━━━━━
${totals}
📌 Estado: ${statusLabel(o.status)}`;
}

function normalizeCubanPhone(phone){
  let v=String(phone||'').replace(/[^\d]/g,'');

  if(v.startsWith('00'))
    v=v.slice(2);

  if(v.startsWith('53'))
    return v;

  return v.length===8?`53${v}`:v;
}

function sendToSelf(orderNumber){
  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;

  window.open(
    `https://wa.me/${PANACEA_WHATSAPP}?text=${encodeURIComponent(buildOrderMessage(o))}`,
    '_blank'
  );

  showToast('Abriendo WhatsApp.');
}

function sendToClient(orderNumber){
  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;

  const phone=normalizeCubanPhone(o.phone);

  if(!phone)
    return showToast(
      'El teléfono del cliente no es válido.'
    );

  const message=`Hola ${o.customer} 👋

Le escribimos de PANACEA en relación con su pedido ${o.orderNumber}.

${buildOrderMessage(o)}

Si necesita alguna aclaración, estamos a su disposición.`;

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    '_blank'
  );

  showToast('Abriendo WhatsApp del cliente.');
}

async function copyOrder(orderNumber){
  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;

  try{
    await navigator.clipboard.writeText(
      buildOrderMessage(o)
    );

    showToast(
      'Pedido copiado al portapapeles.'
    );

  }catch(e){
    showToast(
      'No se pudo copiar automáticamente.'
    );
  }
}

/* =========================
   MENSAJES
========================= */

let toastTimer=null;

function showToast(m){
  adminToast.textContent=m;
  adminToast.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer=setTimeout(
    ()=>adminToast.classList.remove('show'),
    2800
  );
}

/* =========================
   EVENTOS
========================= */

document
  .getElementById('openImportBtn')
  .addEventListener('click',openImport);

document
  .getElementById('emptyImportBtn')
  .addEventListener('click',openImport);

document
  .getElementById('closeImportBtn')
  .addEventListener('click',closeImport);

document
  .getElementById('cancelImportBtn')
  .addEventListener('click',closeImport);

previewImportBtn
  .addEventListener('click',previewImport);

document
  .getElementById('importForm')
  .addEventListener('submit',e=>{
    e.preventDefault();
    createOrder();
  });

searchOrders.addEventListener('input',e=>{
  searchTerm=e.target.value;
  renderOrders();
});

/* =========================
   FILTROS
   SOLO FILTRAN
========================= */

document
  .querySelectorAll('.order-filter')
  .forEach(button=>{

    button.addEventListener('click',()=>{

      document
        .querySelectorAll('.order-filter')
        .forEach(x=>x.classList.remove('active'));

      button.classList.add('active');

      activeStatus=button.dataset.status;

      renderOrders();
    });

  });

orderDialog.addEventListener('click',e=>{
  if(e.target===orderDialog)
    orderDialog.close();
});

renderAll();
