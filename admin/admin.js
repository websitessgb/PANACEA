const ADMIN_STORAGE_KEY='panacea-admin-orders';
const BACKUP_META_KEY='panacea-admin-backup-meta';
const BACKUP_SNAPSHOT_KEY='panacea-admin-backup-snapshot';

let orders=loadOrders(),activeStatus='all',searchTerm='',pendingParsedOrder=null;


/* =========================================================
   CARGA Y GUARDADO
   ========================================================= */

function loadOrders(){
  try{
    const raw=localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw?JSON.parse(raw):[];
  }catch(e){
    return [];
  }
}

function saveOrders(){
  localStorage.setItem(ADMIN_STORAGE_KEY,JSON.stringify(orders));

  localStorage.setItem(
    BACKUP_SNAPSHOT_KEY,
    JSON.stringify({
      updatedAt:new Date().toISOString(),
      orders
    })
  );

  updateBackupUI();
}


/* =========================================================
   UTILIDADES
   ========================================================= */

function escapeHTML(value){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function stamp(){
  const d=new Date();

  return [
    d.getFullYear(),
    String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0'),
    '-',
    String(d.getHours()).padStart(2,'0'),
    String(d.getMinutes()).padStart(2,'0')
  ].join('');
}

function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');

  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function showToast(message){
  const toast=document.getElementById('adminToast');

  if(!toast)return;

  toast.textContent=message;
  toast.classList.add('show');

  clearTimeout(showToast.timer);

  showToast.timer=setTimeout(()=>{
    toast.classList.remove('show');
  },3200);
}


/* =========================================================
   ESTADOS
   ========================================================= */

function statusLabel(status){
  const map={
    pending:'Pendiente',
    confirmed:'Confirmado',
    invoiced:'Facturado',
    delivered:'Entregado',
    cancelled:'Cancelado'
  };

  return map[status]||status||'Pendiente';
}


/* =========================================================
   FORMATO
   ========================================================= */

function formatDate(value){
  if(!value)return 'Sin fecha';

  const d=new Date(value);

  if(Number.isNaN(d.getTime()))return value;

  return d.toLocaleString('es-ES',{
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit'
  });
}

function formatMoney(value){
  if(value===undefined||value===null||value==='')return '—';

  const n=Number(value);

  if(Number.isNaN(n))return escapeHTML(value);

  return n.toLocaleString('es-ES',{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

function getTotal(order){
  if(!order)return null;

  if(order.totals){
    if(typeof order.totals==='number')return order.totals;

    if(order.totals.total!==undefined)return order.totals.total;
    if(order.totals.grandTotal!==undefined)return order.totals.grandTotal;
    if(order.totals.amount!==undefined)return order.totals.amount;
  }

  if(order.total!==undefined)return order.total;

  return null;
}

function productsText(order){
  if(!order?.products)return 'Sin productos';

  if(Array.isArray(order.products)){
    return order.products.map(p=>{
      if(typeof p==='string')return p;

      const name=p.name||p.product||p.title||'Producto';
      const qty=p.quantity??p.qty??p.cantidad??1;

      return `${qty} × ${name}`;
    }).join(', ')||'Sin productos';
  }

  return String(order.products);
}


/* =========================================================
   PEDIDOS
   ========================================================= */

function renderAll(){
  renderStats();
  renderOrders();
  updateBackupUI();
}

function renderStats(){
  const total=document.getElementById('ordersCount');
  const pending=document.getElementById('pendingCount');
  const invoiced=document.getElementById('invoicedCount');
  const cancelled=document.getElementById('cancelledCount');

  if(total)total.textContent=orders.length;

  if(pending){
    pending.textContent=orders.filter(o=>o.status==='pending').length;
  }

  if(invoiced){
    invoiced.textContent=orders.filter(o=>o.status==='invoiced').length;
  }

  if(cancelled){
    cancelled.textContent=orders.filter(o=>o.status==='cancelled').length;
  }
}

function matchesSearch(order){
  if(!searchTerm)return true;

  const text=[
    order.orderNumber,
    order.customer,
    order.phone,
    productsText(order)
  ].join(' ').toLowerCase();

  return text.includes(searchTerm.toLowerCase());
}

function renderOrders(){
  const list=document.getElementById('ordersList');
  const empty=document.getElementById('emptyOrders');

  if(!list)return;

  const filtered=orders.filter(order=>{
    const statusOk=
      activeStatus==='all' ||
      order.status===activeStatus;

    return statusOk&&matchesSearch(order);
  });

  list.innerHTML='';

  if(!filtered.length){
    if(empty)empty.hidden=false;
    return;
  }

  if(empty)empty.hidden=true;

  filtered.forEach(order=>{
    const box=document.createElement('article');

    box.className='order-card';

    const total=getTotal(order);

    box.innerHTML=`
      <div>
        <div class="order-number">#${escapeHTML(order.orderNumber)}</div>
        <div class="order-date">${escapeHTML(formatDate(order.createdAt))}</div>
      </div>

      <div>
        <div class="order-customer">${escapeHTML(order.customer||'Sin nombre')}</div>
        <div class="order-phone">${escapeHTML(order.phone||'Sin teléfono')}</div>
        <div class="order-summary">${escapeHTML(productsText(order))}</div>
      </div>

      <div class="order-right">
        <div class="order-total">
          ${total===null?'—':escapeHTML(formatMoney(total))}
        </div>

        <span class="status-badge status-${escapeHTML(order.status||'pending')}">
          ${escapeHTML(statusLabel(order.status))}
        </span>

        <br>

        <button type="button" class="order-open-btn">
          Ver pedido
        </button>
      </div>
    `;

    box.querySelector('.order-open-btn').onclick=()=>{
      openOrderDialog(order);
    };

    list.appendChild(box);
  });
}


/* =========================================================
   DETALLE DEL PEDIDO
   ========================================================= */

function openOrderDialog(order){
  const dialog=document.getElementById('orderDialog');

  if(!dialog)return;

  const detail=dialog.querySelector('[data-order-detail]');

  if(!detail)return;

  const total=getTotal(order);

  const products=Array.isArray(order.products)
    ?order.products
    :[];

  detail.innerHTML=`
    <div class="order-detail">

      <div class="detail-top">

        <div>
          <div class="detail-number">
            #${escapeHTML(order.orderNumber)}
          </div>

          <div class="detail-date">
            ${escapeHTML(formatDate(order.createdAt))}
          </div>
        </div>

        <span class="status-badge status-${escapeHTML(order.status||'pending')}">
          ${escapeHTML(statusLabel(order.status))}
        </span>

      </div>

      <div class="detail-customer">

        <div class="detail-box">
          <small>Cliente</small>
          <strong>${escapeHTML(order.customer||'Sin nombre')}</strong>
        </div>

        <div class="detail-box">
          <small>Teléfono</small>
          <strong>${escapeHTML(order.phone||'Sin teléfono')}</strong>
        </div>

      </div>

      <div class="detail-products">

        <h3>Productos</h3>

        ${
          products.length
          ?products.map(p=>{
            const name=p.name||p.product||p.title||'Producto';
            const qty=p.quantity??p.qty??p.cantidad??1;
            const price=p.price??p.unitPrice??p.precio;

            return `
              <div class="detail-product">
                <span>${escapeHTML(name)}</span>
                <strong>×${escapeHTML(qty)}</strong>
                <small>
                  ${price===undefined?'':escapeHTML(formatMoney(price))}
                </small>
              </div>
            `;
          }).join('')
          :'<p>Sin productos registrados.</p>'
        }

      </div>

      <div class="detail-totals">
        <div class="detail-total">
          Total: ${total===null?'—':escapeHTML(formatMoney(total))}
        </div>
      </div>

      <div data-status-editor></div>

      <div class="detail-actions">

        <button type="button" data-copy-order>
          📋 Copiar pedido
        </button>

        <button type="button" data-delete-order class="danger">
          🗑️ Eliminar
        </button>

      </div>

    </div>
  `;

  renderStatusEditor(detail,order);

  detail.querySelector('[data-copy-order]').onclick=()=>{
    copyOrder(order);
  };

  detail.querySelector('[data-delete-order]').onclick=()=>{
    deleteOrder(order);
  };

  dialog.showModal();
}

function renderStatusEditor(detail,order){
  const editor=detail.querySelector('[data-status-editor]');

  if(!editor)return;

  editor.innerHTML=`
    <label>
      Estado del pedido
    </label>

    <select data-status-select>
      <option value="pending">Pendiente</option>
      <option value="invoiced">Facturado</option>
      <option value="cancelled">Cancelado</option>
    </select>

    <button type="button" data-save-status>
      Guardar estado
    </button>
  `;

  const select=editor.querySelector('[data-status-select]');

  select.value=
    ['pending','invoiced','cancelled'].includes(order.status)
    ?order.status
    :'pending';

  editor.querySelector('[data-save-status]').onclick=()=>{
    order.status=select.value;

    saveOrders();
    renderAll();

    const dialog=document.getElementById('orderDialog');

    if(dialog?.open)dialog.close();

    showToast('✅ Estado del pedido actualizado.');
  };
}

function copyOrder(order){
  const text=[
    `Pedido #${order.orderNumber}`,
    `Cliente: ${order.customer||''}`,
    `Teléfono: ${order.phone||''}`,
    '',
    productsText(order),
    '',
    `Total: ${getTotal(order)===null?'':formatMoney(getTotal(order))}`
  ].join('\n');

  navigator.clipboard?.writeText(text)
    .then(()=>{
      showToast('📋 Pedido copiado.');
    })
    .catch(()=>{
      showToast('⚠️ No se pudo copiar el pedido.');
    });
}

function deleteOrder(order){
  if(!confirm(`¿Eliminar el pedido #${order.orderNumber}?`))return;

  orders=orders.filter(o=>o!==order);

  saveOrders();
  renderAll();

  const dialog=document.getElementById('orderDialog');

  if(dialog?.open)dialog.close();

  showToast('🗑️ Pedido eliminado.');
}


/* =========================================================
   EXPORTAR PEDIDOS JSON
   ========================================================= */

function exportOrdersJSON(){
  const d=new Date().toISOString();

  downloadBlob(
    new Blob([
      JSON.stringify({
        app:'PANACEA',
        type:'orders-backup',
        version:1,
        exportedAt:d,
        totalOrders:orders.length,
        orders
      },null,2)
    ],{type:'application/json'}),
    `panacea_respaldo_${stamp()}.json`
  );

  localStorage.setItem(
    BACKUP_META_KEY,
    JSON.stringify({
      lastBackupDate:d,
      lastBackupOrderCount:orders.length
    })
  );

  updateBackupUI();

  showToast(
    `✅ Respaldo creado correctamente. ${orders.length} pedidos guardados.`
  );
}


/* =========================================================
   EXPORTAR EXCEL
   ========================================================= */

function exportOrdersExcel(){
  const rows=orders.map(o=>({
    Pedido:o.orderNumber,
    Fecha:o.createdAt,
    Cliente:o.customer,
    Telefono:o.phone,
    Productos:productsText(o),
    Total:getTotal(o),
    Estado:statusLabel(o.status)
  }));

  if(!rows.length){
    showToast('No hay pedidos para exportar.');
    return;
  }

  const headers=Object.keys(rows[0]);

  const csv=[
    headers.join(';'),
    ...rows.map(row=>
      headers.map(h=>
        `"${String(row[h]??'').replace(/"/g,'""')}"`
      ).join(';')
    )
  ].join('\n');

  downloadBlob(
    new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),
    `panacea_pedidos_${stamp()}.csv`
  );

  showToast('📊 Archivo exportado correctamente.');
}


/* =========================================================
   INFORMACIÓN DEL RESPALDO
   ========================================================= */

function updateBackupUI(){
  const dateEl=document.getElementById('lastBackupDate');
  const countEl=document.getElementById('ordersSinceBackup');
  const statusEl=document.getElementById('backupStatus');

  let meta=null;

  try{
    const raw=localStorage.getItem(BACKUP_META_KEY);
    meta=raw?JSON.parse(raw):null;
  }catch(e){}

  if(dateEl){
    dateEl.textContent=
      meta?.lastBackupDate
      ?formatDate(meta.lastBackupDate)
      :'Nunca';
  }

  if(countEl){
    if(meta?.lastBackupOrderCount!==undefined){
      countEl.textContent=
        Math.max(0,orders.length-Number(meta.lastBackupOrderCount));
    }else{
      countEl.textContent=orders.length;
    }
  }

  if(statusEl){
    statusEl.textContent=
      meta?.lastBackupDate
      ?'Respaldo disponible'
      :'Aún no se ha creado un respaldo';
  }
}


/* =========================================================
   COMPARACIÓN DE PEDIDOS
   ========================================================= */

/*
 * El orderNumber identifica el pedido.
 * El resto de los datos relevantes se comparan para saber
 * si el pedido del respaldo realmente cambió.
 */

function orderComparisonData(order){
  if(!order)return null;

  return {
    createdAt:order.createdAt??null,
    customer:order.customer??null,
    phone:order.phone??null,
    products:order.products??null,
    totals:order.totals??null,
    total:order.total??null,
    status:order.status??null,
    cancellation:order.cancellation??null,
    week:order.week??null,
    year:order.year??null
  };
}

function sameOrder(a,b){
  return JSON.stringify(orderComparisonData(a))
    ===JSON.stringify(orderComparisonData(b));
}


/* =========================================================
   DETECTAR CAMBIOS
   ========================================================= */

function getOrderChanges(current,backup){
  const changes=[];

  const fields=[
    ['createdAt','Fecha'],
    ['customer','Cliente'],
    ['phone','Teléfono'],
    ['products','Productos'],
    ['totals','Totales'],
    ['total','Total'],
    ['status','Estado'],
    ['cancellation','Cancelación'],
    ['week','Semana'],
    ['year','Año']
  ];

  fields.forEach(([key,label])=>{
    const a=JSON.stringify(current?.[key]??null);
    const b=JSON.stringify(backup?.[key]??null);

    if(a!==b){
      changes.push({
        key,
        label,
        current:current?.[key],
        backup:backup?.[key]
      });
    }
  });

  return changes;
}

function displayComparisonValue(key,value){
  if(value===undefined||value===null||value===''){
    return '—';
  }

  if(key==='createdAt'){
    return escapeHTML(formatDate(value));
  }

  if(key==='status'){
    return escapeHTML(statusLabel(value));
  }

  if(key==='products'){
    return escapeHTML(productsText({products:value}));
  }

  if(key==='totals'){
    if(typeof value==='object'){
      return escapeHTML(
        Object.entries(value)
          .map(([k,v])=>`${k}: ${v}`)
          .join(' · ')
      );
    }

    return escapeHTML(value);
  }

  if(key==='cancellation'){
    if(typeof value==='object'){
      return escapeHTML(
        Object.entries(value)
          .map(([k,v])=>`${k}: ${v}`)
          .join(' · ')
      );
    }

    return escapeHTML(value);
  }

  if(typeof value==='object'){
    return escapeHTML(JSON.stringify(value));
  }

  return escapeHTML(value);
}


/* =========================================================
   ESTADO DE DECISIONES DE RESTAURACIÓN
   ========================================================= */

let pendingRestoreAnalysis=null;


/* =========================================================
   RENDERIZAR ANÁLISIS DEL RESPALDO
   ========================================================= */

function renderRestoreAnalysis(a){
  const box=document.getElementById('restoreAnalysis');

  if(!box)return;

  pendingRestoreAnalysis={
    ...a,
    decisions:new Map()
  };

  box.hidden=false;

  const ids=x=>
    x.map(o=>`#${escapeHTML(o.orderNumber)}`).join(', ')
    ||'Ninguno';

  box.innerHTML=`
    <div class="restore-summary">

      <strong>📥 RESPALDO ANALIZADO</strong>

      <p>
        🟢 Pedidos nuevos:
        <b>${a.newOrders.length}</b>
      </p>

      <p>
        🟡 Ya existentes e iguales:
        <b>${a.equalOrders.length}</b>
      </p>

      <p>
        🟠 Existentes con cambios:
        <b>${a.changedOrders.length}</b>
      </p>

    </div>

    <div class="restore-groups">

      <p>
        <b>🟢 Nuevos:</b>
        ${ids(a.newOrders)}
      </p>

      <p>
        <b>🟡 Iguales:</b>
        ${ids(a.equalOrders)}
      </p>

      <p>
        <b>🟠 Con cambios:</b>
        ${
          a.changedOrders
            .map(x=>`#${escapeHTML(x.backup.orderNumber)}`)
            .join(', ')
          ||'Ninguno'
        }
      </p>

    </div>

    ${
      a.changedOrders.length
      ?`
        <div class="restore-modified-section">

          <h3>
            🟠 Pedidos modificados
          </h3>

          <p class="restore-note">
            Estos pedidos ya existen en la página, pero el respaldo
            contiene información diferente. Decide individualmente
            cuál versión quieres conservar.
          </p>

          <div class="restore-changed-list">
            ${a.changedOrders.map((item,index)=>
              renderChangedOrderCard(item,index)
            ).join('')}
          </div>

        </div>
      `
      :''
    }

    <p class="restore-note">
      Los pedidos iguales se ignoran.
      Los nuevos se pueden agregar.
      Los pedidos modificados no se reemplazarán automáticamente.
    </p>

    <div class="dialog-actions">

      <button
        type="button"
        class="admin-secondary-btn"
        id="cancelRestoreAnalysisBtn">
        Cancelar
      </button>

      ${
        a.newOrders.length
        ?`
          <button
            type="button"
            class="admin-secondary-btn"
            id="addNewOrdersBtn">
            Agregar solo los nuevos
          </button>
        `
        :''
      }

      ${
        a.changedOrders.length
        ?`
          <button
            type="button"
            class="admin-primary-btn"
            id="applyRestoreDecisionsBtn"
            disabled>
            Aplicar decisiones
          </button>
        `
        :''
      }

    </div>
  `;

  document.getElementById('cancelRestoreAnalysisBtn').onclick=
    closeRestoreDialog;

  const addNew=document.getElementById('addNewOrdersBtn');

  if(addNew){
    addNew.onclick=()=>{
      if(!a.newOrders.length){
        return showToast('No hay pedidos nuevos para agregar.');
      }

      orders.push(...a.newOrders);

      saveOrders();
      renderAll();
      closeRestoreDialog();

      showToast(
        `✅ Se agregaron ${a.newOrders.length} pedidos nuevos sin duplicar.`
      );
    };
  }

  const apply=document.getElementById('applyRestoreDecisionsBtn');

  if(apply){
    apply.onclick=applyRestoreDecisions;
  }

  updateRestoreDecisionUI();
}


/* =========================================================
   TARJETA DE PEDIDO MODIFICADO
   ========================================================= */

function renderChangedOrderCard(item,index){
  const current=item.current;
  const backup=item.backup;
  const changes=getOrderChanges(current,backup);

  return `
    <article
      class="restore-changed-card"
      data-restore-index="${index}">

      <div class="restore-changed-header">

        <div>
          <strong>
            Pedido #${escapeHTML(backup.orderNumber)}
          </strong>

          <small>
            ${changes.length} cambio${changes.length===1?'':'s'}
          </small>
        </div>

        <span
          class="restore-decision-badge"
          data-decision-badge>
          Sin decidir
        </span>

      </div>

      <div class="restore-version-grid">

        <div class="restore-version restore-current">

          <div class="restore-version-title">
            <span>📌 ACTUAL</span>
          </div>

          <div class="restore-version-content">

            <p>
              <small>Cliente</small>
              <strong>
                ${escapeHTML(current.customer||'—')}
              </strong>
            </p>

            <p>
              <small>Teléfono</small>
              <strong>
                ${escapeHTML(current.phone||'—')}
              </strong>
            </p>

            <p>
              <small>Productos</small>
              <strong>
                ${escapeHTML(productsText(current))}
              </strong>
            </p>

            <p>
              <small>Total</small>
              <strong>
                ${
                  getTotal(current)===null
                  ?'—'
                  :escapeHTML(formatMoney(getTotal(current)))
                }
              </strong>
            </p>

            <p>
              <small>Estado</small>
              <strong>
                ${escapeHTML(statusLabel(current.status))}
              </strong>
            </p>

          </div>

        </div>


        <div class="restore-version restore-backup">

          <div class="restore-version-title">
            <span>💾 RESPALDO</span>
          </div>

          <div class="restore-version-content">

            <p>
              <small>Cliente</small>
              <strong>
                ${escapeHTML(backup.customer||'—')}
              </strong>
            </p>

            <p>
              <small>Teléfono</small>
              <strong>
                ${escapeHTML(backup.phone||'—')}
              </strong>
            </p>

            <p>
              <small>Productos</small>
              <strong>
                ${escapeHTML(productsText(backup))}
              </strong>
            </p>

            <p>
              <small>Total</small>
              <strong>
                ${
                  getTotal(backup)===null
                  ?'—'
                  :escapeHTML(formatMoney(getTotal(backup)))
                }
              </strong>
            </p>

            <p>
              <small>Estado</small>
              <strong>
                ${escapeHTML(statusLabel(backup.status))}
              </strong>
            </p>

          </div>

        </div>

      </div>


      <div class="restore-differences">

        <strong>🔎 Datos diferentes</strong>

        <div>
          ${
            changes.map(change=>`
              <span>
                ${escapeHTML(change.label)}
              </span>
            `).join('')
          }
        </div>

      </div>


      <div class="restore-choice-actions">

        <button
          type="button"
          class="admin-secondary-btn"
          data-keep-current>
          Mantener actual
        </button>

        <button
          type="button"
          class="admin-primary-btn"
          data-use-backup>
          Usar respaldo
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   DECISIÓN INDIVIDUAL
   ========================================================= */

function setRestoreDecision(index,decision){
  if(!pendingRestoreAnalysis)return;

  pendingRestoreAnalysis.decisions.set(index,decision);

  const card=document.querySelector(
    `[data-restore-index="${index}"]`
  );

  if(!card)return;

  const badge=card.querySelector('[data-decision-badge]');
  const currentBtn=card.querySelector('[data-keep-current]');
  const backupBtn=card.querySelector('[data-use-backup]');

  card.classList.remove(
    'decision-current',
    'decision-backup'
  );

  currentBtn.classList.remove('selected');
  backupBtn.classList.remove('selected');

  if(decision==='current'){
    card.classList.add('decision-current');
    currentBtn.classList.add('selected');

    badge.textContent='Mantener actual';
  }

  if(decision==='backup'){
    card.classList.add('decision-backup');
    backupBtn.classList.add('selected');

    badge.textContent='Usar respaldo';
  }

  updateRestoreDecisionUI();
}

function updateRestoreDecisionUI(){
  if(!pendingRestoreAnalysis)return;

  const total=pendingRestoreAnalysis.changedOrders.length;
  const decided=pendingRestoreAnalysis.decisions.size;

  const button=document.getElementById(
    'applyRestoreDecisionsBtn'
  );

  if(button){
    button.disabled=decided!==total;

    button.textContent=
      decided===total
      ?'Aplicar decisiones'
      :`Decidir ${total-decided} pedido${total-decided===1?'':'s'}`;
  }

  pendingRestoreAnalysis.changedOrders.forEach((_,index)=>{
    const card=document.querySelector(
      `[data-restore-index="${index}"]`
    );

    if(!card)return;

    const currentBtn=card.querySelector('[data-keep-current]');
    const backupBtn=card.querySelector('[data-use-backup]');

    if(currentBtn){
      currentBtn.onclick=()=>{
        setRestoreDecision(index,'current');
      };
    }

    if(backupBtn){
      backupBtn.onclick=()=>{
        setRestoreDecision(index,'backup');
      };
    }
  });
}


/* =========================================================
   APLICAR DECISIONES
   ========================================================= */

function applyRestoreDecisions(){
  if(!pendingRestoreAnalysis)return;

  const {
    changedOrders,
    decisions
  }=pendingRestoreAnalysis;

  if(decisions.size!==changedOrders.length){
    return showToast(
      '⚠️ Debes decidir qué hacer con cada pedido modificado.'
    );
  }

  let restored=0;
  let kept=0;

  changedOrders.forEach((item,index)=>{
    const decision=decisions.get(index);

    if(decision==='backup'){
      const position=orders.findIndex(
        o=>String(o.orderNumber)
          ===String(item.backup.orderNumber)
      );

      if(position!==-1){
        orders[position]=item.backup;
        restored++;
      }
    }

    if(decision==='current'){
      kept++;
    }
  });

  saveOrders();
  renderAll();

  closeRestoreDialog();

  showToast(
    `✅ Restauración completada. ${restored} restaurado${restored===1?'':'s'} y ${kept} mantenido${kept===1?'':'s'}.`
  );
}


/* =========================================================
   RESTAURAR RESPALDO
   ========================================================= */

function openRestoreDialog(){
  const d=document.getElementById('restoreDialog');

  if(!d)return;

  pendingRestoreAnalysis=null;

  document.getElementById('restoreAnalysis').hidden=true;
  document.getElementById('restoreAnalysis').innerHTML='';

  document.getElementById('restoreFileInput').value='';

  d.showModal();
}

function closeRestoreDialog(){
  const d=document.getElementById('restoreDialog');

  if(d?.open)d.close();

  pendingRestoreAnalysis=null;
}

function handleRestoreFile(f){
  if(!f)return;

  const reader=new FileReader();

  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);

      const backupOrders=
        Array.isArray(data)
        ?data
        :data.orders;

      if(!Array.isArray(backupOrders)){
        throw Error('Formato inválido');
      }

      const map=new Map(
        orders.map(o=>[
          String(o.orderNumber),
          o
        ])
      );

      const analysis={
        newOrders:[],
        equalOrders:[],
        changedOrders:[]
      };

      backupOrders.forEach(backupOrder=>{
        const number=String(
          backupOrder.orderNumber??''
        );

        const current=map.get(number);

        if(!current){
          analysis.newOrders.push(backupOrder);

        }else if(sameOrder(current,backupOrder)){
          analysis.equalOrders.push(backupOrder);

        }else{
          analysis.changedOrders.push({
            current,
            backup:backupOrder
          });
        }
      });

      renderRestoreAnalysis(analysis);

    }catch(error){
      console.error(error);

      showToast(
        '⚠️ No se pudo analizar el archivo de respaldo.'
      );
    }
  };

  reader.readAsText(f);
}


/* =========================================================
   EVENTOS
   ========================================================= */

const searchInput=document.getElementById('searchOrders');

if(searchInput){
  searchInput.addEventListener('input',e=>{
    searchTerm=e.target.value.trim();
    renderOrders();
  });
}

document.querySelectorAll('.order-filter').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.order-filter')
      .forEach(b=>b.classList.remove('active'));

    button.classList.add('active');

    activeStatus=button.dataset.status||'all';

    renderOrders();
  });
});


/* =========================================================
   CERRAR DIALOG PEDIDO
   ========================================================= */

const orderDialog=document.getElementById('orderDialog');

if(orderDialog){
  const closeOrderBtn=
    orderDialog.querySelector('[data-close-order]');

  if(closeOrderBtn){
    closeOrderBtn.onclick=()=>{
      orderDialog.close();
    };
  }
}


/* =========================================================
   BOTONES DE RESPALDO
   ========================================================= */

document.getElementById('exportOrdersBtn')
  ?.addEventListener('click',exportOrdersJSON);

document.getElementById('exportExcelBtn')
  ?.addEventListener('click',exportOrdersExcel);

document.getElementById('restoreOrdersBtn')
  ?.addEventListener('click',openRestoreDialog);

document.getElementById('closeRestoreBtn')
  ?.addEventListener('click',closeRestoreDialog);

document.getElementById('cancelRestoreBtn')
  ?.addEventListener('click',closeRestoreDialog);

document.getElementById('selectRestoreFileBtn')
  ?.addEventListener('click',()=>{
    document.getElementById('restoreFileInput').click();
  });

document.getElementById('restoreFileInput')
  ?.addEventListener('change',e=>{
    handleRestoreFile(e.target.files?.[0]);
  });


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

renderAll();
