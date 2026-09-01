const ADMIN_STORAGE_KEY='panacea-admin-orders',PANACEA_WHATSAPP='5358051138';
let orders=loadOrders(),activeStatus='all',searchTerm='',pendingParsedOrder=null;
const ordersList=document.getElementById('ordersList'),emptyOrders=document.getElementById('emptyOrders'),ordersCount=document.getElementById('ordersCount'),searchOrders=document.getElementById('searchOrders'),importDialog=document.getElementById('importDialog'),orderDialog=document.getElementById('orderDialog'),whatsappMessage=document.getElementById('whatsappMessage'),importPreview=document.getElementById('importPreview'),parseError=document.getElementById('parseError'),saveImportBtn=document.getElementById('saveImportBtn'),previewImportBtn=document.getElementById('previewImportBtn'),orderDetail=document.getElementById('orderDetail'),adminToast=document.getElementById('adminToast');

function money(value,currency='CUP'){return `${new Intl.NumberFormat('es-CU').format(Number(value)||0)} ${currency}`;}
function formatDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return value||'';return new Intl.DateTimeFormat('es-CU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
function getISOWeek(date=new Date()){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y)/86400000)+1)/7);}
function getISOYear(date=new Date()){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);return d.getUTCFullYear();}
function loadOrders(){try{const saved=localStorage.getItem(ADMIN_STORAGE_KEY),parsed=saved?JSON.parse(saved):[];return Array.isArray(parsed)?parsed:[];}catch(e){return [];}}
function saveOrders(){localStorage.setItem(ADMIN_STORAGE_KEY,JSON.stringify(orders));}
function escapeHTML(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function statusLabel(status){return {pending:'Pendiente',confirmed:'Confirmado',invoiced:'Facturado',delivered:'Entregado',cancelled:'Cancelado'}[status]||'Pendiente';}
function statusClass(status){return `status-${status||'pending'}`;}

function openImport(){whatsappMessage.value='';importPreview.hidden=true;parseError.hidden=true;saveImportBtn.hidden=true;previewImportBtn.hidden=false;pendingParsedOrder=null;importDialog.showModal();setTimeout(()=>whatsappMessage.focus(),100);}
function closeImport(){if(importDialog.open)importDialog.close();}
function parseCustomer(text){const m=text.match(/(?:👤\s*)?Cliente\s*:\s*(.+)/i);return m?m[1].trim():'';}
function parsePhone(text){const m=text.match(/(?:📞\s*)?Teléfono\s*:\s*([0-9+\-\s()]+)/i);return m?m[1].trim().replace(/[^\d+]/g,''):'';}
function getProductsSection(text){const start=text.search(/📦\s*PRODUCTOS/i);if(start===-1)return '';const after=text.slice(start),separator=after.indexOf('━━━━━━━━━━━━━━');return separator!==-1?after.slice(0,separator):after;}
function parseNumber(value){return Number(String(value??'').replace(/\./g,'').replace(/,/g,'').replace(/[^\d.-]/g,''))||0;}

function parseProducts(text){
 const section=getProductsSection(text);if(!section)return [];
 return section.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('•')).map(line=>{
  const clean=line.replace(/^•\s*/,'').trim(),m=clean.match(/^(.+?)\s+—\s+(\d+)\s+(.+?)\s+×\s+([\d.,]+)\s+(CUP|USD)\s+=\s+([\d.,]+)\s+(CUP|USD)$/i);
  if(!m)return null;
  return {name:m[1].trim(),quantity:Number(m[2]),presentation:m[3].trim(),unitPrice:parseNumber(m[4]),currency:m[5].toUpperCase(),total:parseNumber(m[6])};
 }).filter(Boolean);
}

function parseTotals(text){
 const cup=text.match(/TOTAL\s+CUP\s*:\s*([\d.,]+)\s*CUP/i),usd=text.match(/TOTAL\s+USD\s*:\s*([\d.,]+)\s*USD/i);
 return {CUP:cup?parseNumber(cup[1]):0,USD:usd?parseNumber(usd[1]):0};
}

function nextOrderNumber(date=new Date()){
 const prefix=`PAN-${getISOYear(date)}-S${String(getISOWeek(date)).padStart(2,'0')}-`;
 let highest=0;
 orders.filter(o=>String(o.orderNumber||'').startsWith(prefix)).forEach(o=>{const m=String(o.orderNumber).match(/-(\d+)$/);if(m)highest=Math.max(highest,Number(m[1]));});
 return prefix+String(highest+1).padStart(3,'0');
}

function parseWhatsAppOrder(text){
 const cleanText=String(text||'').replace(/\r/g,'');
 if(!cleanText.trim())throw new Error('Pega primero el mensaje completo de WhatsApp.');
 if(!/PEDIDO\s+PANACEA/i.test(cleanText))throw new Error('No parece ser un pedido generado por PANACEA.');
 const customer=parseCustomer(cleanText);if(!customer)throw new Error('No pude encontrar el nombre del cliente.');
 const phone=parsePhone(cleanText);if(!phone)throw new Error('No pude encontrar el teléfono del cliente.');
 const products=parseProducts(cleanText);if(!products.length)throw new Error('No pude interpretar los productos. Asegúrate de pegar el mensaje completo de WhatsApp.');
 const totals=parseTotals(cleanText);
 if(!totals.CUP&&!totals.USD){totals.CUP=products.filter(p=>p.currency==='CUP').reduce((s,p)=>s+p.total,0);totals.USD=products.filter(p=>p.currency==='USD').reduce((s,p)=>s+p.total,0);}
 const now=new Date();
 return {orderNumber:nextOrderNumber(now),createdAt:now.toISOString(),week:getISOWeek(now),year:getISOYear(now),customer,phone,products,totals,status:'pending',source:'whatsapp',rawMessage:cleanText};
}

function showParseError(message){parseError.textContent=message;parseError.hidden=false;}

function previewImport(){
 parseError.hidden=true;
 try{
  pendingParsedOrder=parseWhatsAppOrder(whatsappMessage.value);
  importPreview.hidden=false;saveImportBtn.hidden=false;previewImportBtn.hidden=true;
  document.getElementById('previewOrderNumber').textContent=pendingParsedOrder.orderNumber;
  document.getElementById('previewCustomer').textContent=pendingParsedOrder.customer;
  document.getElementById('previewPhone').textContent=pendingParsedOrder.phone;
  document.getElementById('previewProducts').textContent=`${pendingParsedOrder.products.length} producto(s)`;
  document.getElementById('previewTotal').textContent=formatTotals(pendingParsedOrder.totals);
 }catch(e){pendingParsedOrder=null;importPreview.hidden=true;saveImportBtn.hidden=true;previewImportBtn.hidden=false;showParseError(e.message);}
}

function createOrder(){
 if(!pendingParsedOrder)return showParseError('Primero debes revisar el pedido.');
 const duplicate=orders.find(o=>o.rawMessage===pendingParsedOrder.rawMessage);
 if(duplicate)return showParseError(`Este pedido ya fue importado como ${duplicate.orderNumber}.`);
 orders.unshift(pendingParsedOrder);saveOrders();closeImport();renderAll();showToast(`Pedido ${pendingParsedOrder.orderNumber} creado correctamente.`);pendingParsedOrder=null;
}

function formatTotals(totals){
 const result=[];if(Number(totals?.CUP)>0)result.push(money(totals.CUP,'CUP'));if(Number(totals?.USD)>0)result.push(money(totals.USD,'USD'));return result.join(' · ')||'0';
}

function filteredOrders(){
 const q=searchTerm.toLowerCase().trim();
 return orders.filter(o=>{
  if(activeStatus!=='all'&&o.status!==activeStatus)return false;
  if(!q)return true;
  return [o.orderNumber,o.customer,o.phone,...(o.products||[]).map(p=>p.name)].join(' ').toLowerCase().includes(q);
 });
}

function renderOrders(){
 const list=filteredOrders();
 ordersCount.textContent=`${list.length} ${list.length===1?'pedido':'pedidos'}`;
 ordersList.innerHTML=list.map(order=>{
  const total=formatTotals(order.totals),productNames=(order.products||[]).map(p=>`${p.quantity} ${p.name}`).join(' · ');
  return `<article class="order-card" data-order-id="${escapeHTML(order.orderNumber)}"><div><div class="order-number">${escapeHTML(order.orderNumber)}</div><div class="order-date">${escapeHTML(formatDate(order.createdAt))}</div></div><div><div class="order-customer">${escapeHTML(order.customer)}</div><div class="order-phone">${escapeHTML(order.phone)}</div><div class="order-summary">${escapeHTML(productNames)}</div></div><div class="order-right"><div class="order-total">${escapeHTML(total)}</div><span class="status-badge ${statusClass(order.status)}">${escapeHTML(statusLabel(order.status))}</span><br><button type="button" class="order-open-btn" data-open-order="${escapeHTML(order.orderNumber)}">Ver pedido →</button></div></article>`;
 }).join('');
 emptyOrders.hidden=list.length!==0;ordersList.hidden=list.length===0;
 document.querySelectorAll('[data-open-order]').forEach(btn=>btn.addEventListener('click',()=>openOrder(btn.dataset.openOrder)));
}

function renderStats(){
 document.getElementById('statTotal').textContent=orders.length;
 document.getElementById('statPending').textContent=orders.filter(o=>o.status==='pending').length;
 document.getElementById('statInvoiced').textContent=orders.filter(o=>o.status==='invoiced').length;
 document.getElementById('statCup').textContent=money(orders.reduce((s,o)=>s+Number(o.totals?.CUP||0),0),'CUP');
}

function renderAll(){renderStats();renderOrders();}

function openOrder(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 const products=(order.products||[]).map(p=>`<div class="detail-product"><div><strong>${escapeHTML(p.name)}</strong><br><small>${escapeHTML(p.presentation)}</small></div><div>${escapeHTML(String(p.quantity))}</div><div>${escapeHTML(money(p.total,p.currency))}</div></div>`).join('');
 orderDetail.innerHTML=`<div class="order-detail"><button type="button" class="dialog-x" data-close-order aria-label="Cerrar">×</button><div class="detail-top"><div><div class="detail-number">${escapeHTML(order.orderNumber)}</div><div class="detail-date">${escapeHTML(formatDate(order.createdAt))} · Semana ${escapeHTML(String(order.week))}</div></div><span class="status-badge ${statusClass(order.status)}">${escapeHTML(statusLabel(order.status))}</span></div><div class="detail-customer"><div class="detail-box"><small>CLIENTE</small><strong>${escapeHTML(order.customer)}</strong></div><div class="detail-box"><small>TELÉFONO</small><strong>${escapeHTML(order.phone)}</strong></div></div><div class="detail-products"><h3>Productos</h3>${products}</div><div class="detail-totals"><div class="detail-total">${escapeHTML(formatTotals(order.totals))}</div></div><div class="detail-actions"><button type="button" data-send-self="${escapeHTML(order.orderNumber)}">📱 Enviar a mi WhatsApp</button><button type="button" data-send-client="${escapeHTML(order.orderNumber)}">👤 Enviar al cliente</button><button type="button" data-copy-order="${escapeHTML(order.orderNumber)}">📋 Copiar pedido</button><button type="button" data-status="${escapeHTML(order.orderNumber)}">🔄 Cambiar estado</button><button type="button" class="danger" data-delete-order="${escapeHTML(order.orderNumber)}">🗑️ Eliminar</button></div></div>`;
 orderDialog.showModal();
 document.querySelector('[data-close-order]')?.addEventListener('click',()=>orderDialog.close());
 document.querySelector('[data-send-self]')?.addEventListener('click',()=>sendToSelf(orderNumber));
 document.querySelector('[data-send-client]')?.addEventListener('click',()=>sendToClient(orderNumber));
 document.querySelector('[data-copy-order]')?.addEventListener('click',()=>copyOrder(orderNumber));
 document.querySelector('[data-status]')?.addEventListener('click',()=>changeStatus(orderNumber));
 document.querySelector('[data-delete-order]')?.addEventListener('click',()=>deleteOrder(orderNumber));
}

/* ÚNICO CAMBIO: el estado se selecciona dentro de Ver pedido */
function changeStatus(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 const options=[['pending','Pendiente'],['confirmed','Confirmado'],['invoiced','Facturado'],['delivered','Entregado'],['cancelled','Cancelado']];
 const box=document.createElement('div');
 box.innerHTML=`<label style="display:block;margin-top:12px;font-weight:600;">Estado del pedido</label><select style="margin-top:6px;padding:10px;width:100%;font-size:16px;">${options.map(([v,l])=>`<option value="${v}" ${order.status===v?'selected':''}>${l}</option>`).join('')}</select>`;
 const button=document.querySelector('[data-status]');
 if(!button)return;
 button.insertAdjacentElement('afterend',box);
 button.hidden=true;
 const select=box.querySelector('select');
 select.focus();
 select.addEventListener('change',()=>{
  order.status=select.value;
  saveOrders();
  renderAll();
  orderDialog.close();
  showToast(`Estado cambiado a: ${statusLabel(order.status)}`);
 });
}

function deleteOrder(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 if(!window.confirm(`¿Eliminar el pedido ${order.orderNumber}?`))return;
 orders=orders.filter(o=>o.orderNumber!==orderNumber);saveOrders();orderDialog.close();renderAll();showToast('Pedido eliminado.');
}

function buildOrderMessage(order){
 const lines=(order.products||[]).map(p=>`• ${p.name} — ${p.quantity} ${p.presentation} × ${money(p.unitPrice,p.currency)} = ${money(p.total,p.currency)}`);
 let totals='';if(Number(order.totals?.CUP)>0)totals+=`💰 TOTAL CUP: ${money(order.totals.CUP,'CUP')}\n`;if(Number(order.totals?.USD)>0)totals+=`💵 TOTAL USD: ${money(order.totals.USD,'USD')}\n`;
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

function normalizeCubanPhone(phone){let value=String(phone||'').replace(/[^\d]/g,'');if(value.startsWith('00'))value=value.slice(2);if(value.startsWith('53'))return value;return value.length===8?`53${value}`:value;}

function sendToSelf(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 window.open(`https://wa.me/${PANACEA_WHATSAPP}?text=${encodeURIComponent(buildOrderMessage(order))}`,'_blank');showToast('Abriendo WhatsApp.');
}

function sendToClient(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 const phone=normalizeCubanPhone(order.phone);if(!phone)return showToast('El teléfono del cliente no es válido.');
 const message=`Hola ${order.customer} 👋

Le escribimos de PANACEA en relación con su pedido ${order.orderNumber}.

${buildOrderMessage(order)}

Si necesita alguna aclaración, estamos a su disposición.`;
 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank');showToast('Abriendo WhatsApp del cliente.');
}

async function copyOrder(orderNumber){
 const order=orders.find(o=>o.orderNumber===orderNumber);if(!order)return;
 try{await navigator.clipboard.writeText(buildOrderMessage(order));showToast('Pedido copiado al portapapeles.');}
 catch(e){showToast('No se pudo copiar automáticamente.');}
}

let toastTimer=null;
function showToast(message){adminToast.textContent=message;adminToast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>adminToast.classList.remove('show'),2800);}

document.getElementById('openImportBtn').addEventListener('click',openImport);
document.getElementById('emptyImportBtn').addEventListener('click',openImport);
document.getElementById('closeImportBtn').addEventListener('click',closeImport);
document.getElementById('cancelImportBtn').addEventListener('click',closeImport);
previewImportBtn.addEventListener('click',previewImport);

document.getElementById('importForm').addEventListener('submit',e=>{e.preventDefault();createOrder();});
searchOrders.addEventListener('input',e=>{searchTerm=e.target.value;renderOrders();});

document.querySelectorAll('.order-filter').forEach(button=>{
 button.addEventListener('click',()=>{
  document.querySelectorAll('.order-filter').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  activeStatus=button.dataset.status;
  renderOrders();
 });
});

orderDialog.addEventListener('click',e=>{if(e.target===orderDialog)orderDialog.close();});
renderAll();
