const ADMIN_STORAGE_KEY='panacea-admin-orders';

let orders=loadOrders(),
    activeStatus='all',
    searchTerm='',
    pendingParsedOrder=null;

/* ==========================================
   FILTRO DE FECHA / CALENDARIO
========================================== */

let dateFilter={
  type:'all',
  date:null,
  week:null,
  year:null
};

/* Mes que se está mostrando en el calendario */
let calendarDate=new Date();

/* ==========================================
   ELEMENTOS
========================================== */

const ordersList=document.getElementById('ordersList'),
      emptyOrders=document.getElementById('emptyOrders'),
      ordersCount=document.getElementById('ordersCount'),
      searchOrders=document.getElementById('searchOrders'),
      importDialog=document.getElementById('importDialog'),
      orderDialog=document.getElementById('orderDialog'),
      whatsappMessage=document.getElementById('whatsappMessage'),
      importPreview=document.getElementById('importPreview'),
      parseError=document.getElementById('parseError'),
      saveImportBtn=document.getElementById('saveImportBtn'),
      previewImportBtn=document.getElementById('previewImportBtn'),
      orderDetail=document.getElementById('orderDetail'),
      adminToast=document.getElementById('adminToast');


/* ==========================================
   ELEMENTOS DEL CALENDARIO
========================================== */

const calendarToggle=document.getElementById('calendarToggle');
const calendarPopover=document.getElementById('calendarPopover');
const calendarMonthTitle=document.getElementById('calendarMonthTitle');
const calendarGrid=document.getElementById('calendarGrid');
const calendarPrev=document.getElementById('calendarPrev');
const calendarNext=document.getElementById('calendarNext');
const calendarClear=document.getElementById('calendarClear');
const calendarActiveText=document.getElementById('calendarActiveText');
const dateFilterSummary=document.getElementById('dateFilterSummary');


/* ==========================================
   FUNCIONES BÁSICAS
========================================== */

function money(v,c='CUP'){
  return`${new Intl.NumberFormat('es-CU').format(Number(v)||0)} ${c}`
}

function formatDate(v){
  const d=new Date(v);

  return Number.isNaN(d.getTime())
    ?v||''
    :new Intl.DateTimeFormat('es-CU',{
        day:'2-digit',
        month:'2-digit',
        year:'numeric',
        hour:'2-digit',
        minute:'2-digit'
      }).format(d)
}

function getISOWeek(d=new Date()){
  d=new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    )
  );

  const day=d.getUTCDay()||7;

  d.setUTCDate(
    d.getUTCDate()+4-day
  );

  const y=new Date(
    Date.UTC(
      d.getUTCFullYear(),
      0,
      1
    )
  );

  return Math.ceil(
    (((d-y)/86400000)+1)/7
  )
}

function getISOYear(d=new Date()){
  d=new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    )
  );

  const day=d.getUTCDay()||7;

  d.setUTCDate(
    d.getUTCDate()+4-day
  );

  return d.getUTCFullYear()
}

function loadOrders(){
  try{
    const x=JSON.parse(
      localStorage.getItem(ADMIN_STORAGE_KEY)||'[]'
    );

    return Array.isArray(x)?x:[]
  }catch(e){
    return[]
  }
}

function saveOrders(){
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify(orders)
  )
}

function escapeHTML(v){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;')
}

function statusLabel(s){
  return{
    pending:'Pendiente',
    confirmed:'Confirmado',
    invoiced:'Facturado',
    delivered:'Entregado',
    cancelled:'Cancelado'
  }[s]||'Pendiente'
}

function statusClass(s){
  return`status-${s||'pending'}`
}


/* ==========================================
   FUNCIONES DEL CALENDARIO
========================================== */

/* Comparar dos fechas ignorando hora */

function sameLocalDay(a,b){

  if(!a||!b)return false;

  const da=new Date(a);
  const db=new Date(b);

  return(
    da.getFullYear()===db.getFullYear() &&
    da.getMonth()===db.getMonth() &&
    da.getDate()===db.getDate()
  );
}


/* Obtener lunes de la semana */

function getMonday(date){

  const d=new Date(date);

  d.setHours(0,0,0,0);

  const day=d.getDay()||7;

  d.setDate(
    d.getDate()-(day-1)
  );

  return d;
}


/* Obtener domingo de la semana */

function getSunday(date){

  const d=getMonday(date);

  d.setDate(
    d.getDate()+6
  );

  return d;
}


/* Clave YYYY-MM-DD */

function dateKey(date){

  const d=new Date(date);

  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');

  return`${y}-${m}-${day}`;
}


/* Fecha corta */

function shortDate(date){

  return new Intl.DateTimeFormat(
    'es-CU',
    {
      day:'2-digit',
      month:'2-digit'
    }
  ).format(new Date(date));
}


/* Inicio de una semana ISO */

function getISOWeekStart(year,week){

  const jan4=new Date(
    year,
    0,
    4
  );

  const monday=getMonday(jan4);

  monday.setDate(
    monday.getDate()+
    (week-1)*7
  );

  return monday;
}


/* Texto del rango semanal */

function weekRangeText(year,week){

  const start=getISOWeekStart(
    year,
    week
  );

  const end=new Date(start);

  end.setDate(
    end.getDate()+6
  );

  return`${shortDate(start)} – ${shortDate(end)}`;
}


/* ==========================================
   ACTUALIZAR TEXTO DEL CALENDARIO
========================================== */

function updateCalendarActiveText(){

  if(!calendarActiveText)return;

  if(dateFilter.type==='day'){

    const d=new Date(
      dateFilter.date
    );

    calendarActiveText.textContent=
      `Día: ${shortDate(d)}`;

    return;
  }

  if(dateFilter.type==='week'){

    calendarActiveText.textContent=
      `Semana S${String(dateFilter.week).padStart(2,'0')} · ${weekRangeText(dateFilter.year,dateFilter.week)}`;

    return;
  }

  calendarActiveText.textContent=
    'Todos los pedidos';
}


/* ==========================================
   FILTRAR POR DÍA
========================================== */

function filterByDay(date){

  const d=new Date(date);

  dateFilter={
    type:'day',
    date:dateKey(d),
    week:null,
    year:null
  };

  renderAll();
  renderCalendar();
}


/* ==========================================
   FILTRAR POR SEMANA
========================================== */

function filterByWeek(year,week){

  dateFilter={
    type:'week',
    date:null,
    week:Number(week),
    year:Number(year)
  };

  renderAll();
  renderCalendar();
}


/* ==========================================
   QUITAR FILTRO DE FECHA
========================================== */

function clearDateFilter(){

  dateFilter={
    type:'all',
    date:null,
    week:null,
    year:null
  };

  renderAll();
  renderCalendar();
}


/* ==========================================
   FILTROS RÁPIDOS
========================================== */

function applyQuickDateFilter(type){

  const today=new Date();

  today.setHours(
    0,0,0,0
  );

  /* TODOS */

  if(type==='all'){

    clearDateFilter();
    return;
  }


  /* HOY */

  if(type==='today'){

    filterByDay(today);
    return;
  }


  /* AYER */

  if(type==='yesterday'){

    const yesterday=new Date(today);

    yesterday.setDate(
      yesterday.getDate()-1
    );

    filterByDay(yesterday);
    return;
  }


  /* ESTA SEMANA */

  if(type==='currentWeek'){

    filterByWeek(
      getISOYear(today),
      getISOWeek(today)
    );

    return;
  }


  /* SEMANA ANTERIOR */

  if(type==='previousWeek'){

    const previous=new Date(today);

    previous.setDate(
      previous.getDate()-7
    );

    filterByWeek(
      getISOYear(previous),
      getISOWeek(previous)
    );

    return;
  }
}


/* ==========================================
   RENDERIZAR CALENDARIO
========================================== */

function renderCalendar(){

  if(!calendarGrid)return;

  const year=calendarDate.getFullYear();
  const month=calendarDate.getMonth();

  const monthName=new Intl.DateTimeFormat(
    'es-ES',
    {
      month:'long',
      year:'numeric'
    }
  ).format(calendarDate);

  if(calendarMonthTitle){

    calendarMonthTitle.textContent=
      monthName.charAt(0).toUpperCase()+
      monthName.slice(1);
  }


  /* Primer día del mes */

  const firstDay=new Date(
    year,
    month,
    1
  );

  const lastDay=new Date(
    year,
    month+1,
    0
  );

  /*
    Convertimos domingo=0
    a lunes=0
  */

  const startOffset=
    (firstDay.getDay()+6)%7;

  const daysInMonth=
    lastDay.getDate();


  let html='';


  /* Cabecera de días */

  const weekdays=[
    'L',
    'M',
    'X',
    'J',
    'V',
    'S',
    'D'
  ];

  weekdays.forEach(day=>{

    html+=`
      <div class="calendar-weekday">
        ${day}
      </div>
    `;
  });


  /* Semanas ISO */

  /*
    Determinamos la primera fecha
    que aparecerá en la cuadrícula.
  */

  const firstCalendarDate=new Date(
    year,
    month,
    1-startOffset
  );


  /*
    42 casillas = 6 semanas
  */

  for(let i=0;i<42;i++){

    const d=new Date(
      firstCalendarDate
    );

    d.setDate(
      firstCalendarDate.getDate()+i
    );

    const currentMonth=
      d.getMonth()===month;

    const today=
      sameLocalDay(
        d,
        new Date()
      );

    const selectedDay=
      dateFilter.type==='day' &&
      dateFilter.date===dateKey(d);

    const currentWeek=
      getISOWeek(d)===getISOWeek(new Date()) &&
      getISOYear(d)===getISOYear(new Date());

    const selectedWeek=
      dateFilter.type==='week' &&
      dateFilter.week===getISOWeek(d) &&
      dateFilter.year===getISOYear(d);


    /*
      Solo dibujamos el número del día.
      La semana ISO se coloca en la
      primera casilla de cada fila.
    */

    const dayOfWeek=d.getDay()||7;

    let classes=[
      'calendar-day'
    ];

    if(!currentMonth)
      classes.push('outside-month');

    if(today)
      classes.push('today');

    if(selectedDay)
      classes.push('selected');

    if(selectedWeek)
      classes.push('selected-week');

    if(currentWeek)
      classes.push('current-week');


    /*
      Si es lunes, mostramos
      también el número de semana.
    */

    let weekNumber='';

    if(dayOfWeek===1){

      weekNumber=`
        <span
          class="calendar-week-number"
          data-calendar-week="${getISOWeek(d)}"
          data-calendar-year="${getISOYear(d)}"
          title="Filtrar por esta semana"
        >
          S${String(getISOWeek(d)).padStart(2,'0')}
        </span>
      `;
    }


    html+=`
      <div
        class="${classes.join(' ')}"
        data-calendar-day="${dateKey(d)}"
        title="Filtrar pedidos del ${shortDate(d)}"
      >
        ${weekNumber}
        <span class="calendar-day-number">
          ${d.getDate()}
        </span>
      </div>
    `;
  }


  calendarGrid.innerHTML=html;


  /* Click en día */

  calendarGrid
    .querySelectorAll('[data-calendar-day]')
    .forEach(day=>{

      day.addEventListener(
        'click',
        e=>{

          /*
            Si tocaron el número
            de semana no filtramos día.
          */

          if(
            e.target.closest(
              '[data-calendar-week]'
            )
          )return;

          filterByDay(
            day.dataset.calendarDay
          );
        }
      );
    });


  /* Click en semana */

  calendarGrid
    .querySelectorAll('[data-calendar-week]')
    .forEach(week=>{

      week.addEventListener(
        'click',
        e=>{

          e.stopPropagation();

          filterByWeek(
            Number(week.dataset.calendarYear),
            Number(week.dataset.calendarWeek)
          );
        }
      );
    });


  updateCalendarActiveText();
}


/* ==========================================
   RESUMEN DEL FILTRO
========================================== */

function renderDateFilterSummary(list){

  if(!dateFilterSummary)return;

  if(dateFilter.type==='all'){

    dateFilterSummary.innerHTML='';
    dateFilterSummary.hidden=true;

    return;
  }


  const pending=list.filter(
    o=>o.status==='pending'
  ).length;

  const invoiced=list.filter(
    o=>o.status==='invoiced'
  ).length;

  const cancelled=list.filter(
    o=>o.status==='cancelled'
  ).length;


  const total=list.length;

  let filterText='';


  if(dateFilter.type==='day'){

    filterText=
      `📅 ${shortDate(dateFilter.date)}`;
  }

  else if(dateFilter.type==='week'){

    filterText=
      `📅 S${String(dateFilter.week).padStart(2,'0')} · ${weekRangeText(dateFilter.year,dateFilter.week)}`;
  }


  dateFilterSummary.innerHTML=`
    <strong>${filterText}</strong>
    <span class="date-summary-count">
      ${total} ${total===1?'pedido':'pedidos'}
    </span>
    <span class="date-summary-status pending">
      🟠 ${pending} Pendiente${pending===1?'':'s'}
    </span>
    <span class="date-summary-status invoiced">
      🟢 ${invoiced} Facturado${invoiced===1?'':'s'}
    </span>
    <span class="date-summary-status cancelled">
      🔴 ${cancelled} Cancelado${cancelled===1?'':'s'}
    </span>
  `;

  dateFilterSummary.hidden=false;
}


/* ==========================================
   CALENDARIO: ABRIR / CERRAR
========================================== */

function openCalendar(){

  if(!calendarPopover)return;

  calendarPopover.hidden=false;

  renderCalendar();
}


function closeCalendar(){

  if(!calendarPopover)return;

  calendarPopover.hidden=true;
}


if(calendarToggle){

  calendarToggle.addEventListener(
    'click',
    e=>{

      e.stopPropagation();

      if(calendarPopover?.hidden){
        openCalendar();
      }else{
        closeCalendar();
      }
    }
  );
}


if(calendarPrev){

  calendarPrev.addEventListener(
    'click',
    e=>{

      e.stopPropagation();

      calendarDate.setMonth(
        calendarDate.getMonth()-1
      );

      renderCalendar();
    }
  );
}


if(calendarNext){

  calendarNext.addEventListener(
    'click',
    e=>{

      e.stopPropagation();

      calendarDate.setMonth(
        calendarDate.getMonth()+1
      );

      renderCalendar();
    }
  );
}


if(calendarClear){

  calendarClear.addEventListener(
    'click',
    e=>{

      e.stopPropagation();

      clearDateFilter();
    }
  );
}


/* Cerrar al tocar fuera */

document.addEventListener(
  'click',
  e=>{

    if(!calendarPopover||calendarPopover.hidden)
      return;

    if(
      !calendarPopover.contains(e.target) &&
      e.target!==calendarToggle &&
      !calendarToggle?.contains(e.target)
    ){
      closeCalendar();
    }
  }
);


/* ==========================================
   FILTROS RÁPIDOS
========================================== */

document
  .querySelectorAll('[data-date-filter]')
  .forEach(button=>{

    button.addEventListener(
      'click',
      ()=>{

        document
          .querySelectorAll('[data-date-filter]')
          .forEach(x=>
            x.classList.remove('active')
          );

        button.classList.add('active');

        applyQuickDateFilter(
          button.dataset.dateFilter
        );
      }
    );
  });


/* ==========================================
   IMPORTAR PEDIDO
========================================== */

function openImport(){

  whatsappMessage.value='';

  importPreview.hidden=true;

  parseError.hidden=true;

  saveImportBtn.hidden=true;

  previewImportBtn.hidden=false;

  pendingParsedOrder=null;

  importDialog.showModal();

  setTimeout(
    ()=>whatsappMessage.focus(),
    100
  );
}

function closeImport(){

  if(importDialog.open)
    importDialog.close()
}

function parseCustomer(t){

  const m=t.match(
    /(?:👤\s*)?Cliente\s*:\s*(.+)/i
  );

  return m?m[1].trim():'';
}

function parsePhone(t){

  const m=t.match(
    /(?:📞\s*)?Teléfono\s*:\s*([0-9+\-\s()]+)/i
  );

  return m
    ?m[1].trim().replace(/[^\d+]/g,'')
    :'';
}

function getProductsSection(t){

  const s=t.search(
    /📦\s*PRODUCTOS/i
  );

  if(s===-1)return'';

  const a=t.slice(s);

  const x=a.indexOf(
    '━━━━━━━━━━━━━━'
  );

  return x!==-1
    ?a.slice(0,x)
    :a;
}

function parseNumber(v){

  return Number(
    String(v??'')
      .replace(/\./g,'')
      .replace(/,/g,'')
      .replace(/[^\d.-]/g,'')
  )||0
}

function parseProducts(t){

  const s=getProductsSection(t);

  if(!s)return[];

  return s.split('\n')
    .map(x=>x.trim())
    .filter(x=>x.startsWith('•'))
    .map(line=>{

      const c=line
        .replace(/^•\s*/,'')
        .trim();

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
      }
    })
    .filter(Boolean)
}

function parseTotals(t){

  const cup=t.match(
    /TOTAL\s+CUP\s*:\s*([\d.,]+)\s*CUP/i
  );

  const usd=t.match(
    /TOTAL\s+USD\s*:\s*([\d.,]+)\s*USD/i
  );

  return{
    CUP:cup?parseNumber(cup[1]):0,
    USD:usd?parseNumber(usd[1]):0
  }
}

function nextOrderNumber(d=new Date()){

  const prefix=
    `PAN-${getISOYear(d)}-S${String(getISOWeek(d)).padStart(2,'0')}-`;

  let n=0;

  orders
    .filter(o=>
      String(o.orderNumber||'')
        .startsWith(prefix)
    )
    .forEach(o=>{

      const m=String(o.orderNumber)
        .match(/-(\d+)$/);

      if(m)
        n=Math.max(
          n,
          Number(m[1])
        );
    });

  return prefix+
    String(n+1).padStart(3,'0')
}

function parseWhatsAppOrder(text){

  const t=String(text||'')
    .replace(/\r/g,'');

  if(!t.trim())
    throw new Error(
      'Pega primero el mensaje completo de WhatsApp.'
    );

  if(!/PEDIDO\s+PANACEA/i.test(t))
    throw new Error(
      'No parece ser un pedido generado por PANACEA.'
    );

  const customer=parseCustomer(t);

  if(!customer)
    throw new Error(
      'No pude encontrar el nombre del cliente.'
    );

  const phone=parsePhone(t);

  if(!phone)
    throw new Error(
      'No pude encontrar el teléfono del cliente.'
    );

  const products=parseProducts(t);

  if(!products.length)
    throw new Error(
      'No pude interpretar los productos. Asegúrate de pegar el mensaje completo.'
    );

  const totals=parseTotals(t);

  if(!totals.CUP&&!totals.USD){

    totals.CUP=
      products
        .filter(p=>p.currency==='CUP')
        .reduce(
          (s,p)=>s+p.total,
          0
        );

    totals.USD=
      products
        .filter(p=>p.currency==='USD')
        .reduce(
          (s,p)=>s+p.total,
          0
        );
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
  }
}

function showParseError(m){

  parseError.textContent=m;

  parseError.hidden=false
}

function formatTotals(t){

  const r=[];

  if(Number(t?.CUP)>0)
    r.push(money(t.CUP,'CUP'));

  if(Number(t?.USD)>0)
    r.push(money(t.USD,'USD'));

  return r.join(' · ')||'0'
}

function previewImport(){

  parseError.hidden=true;

  try{

    pendingParsedOrder=
      parseWhatsAppOrder(
        whatsappMessage.value
      );

    importPreview.hidden=false;

    saveImportBtn.hidden=false;

    previewImportBtn.hidden=true;

    document.getElementById(
      'previewOrderNumber'
    ).textContent=
      pendingParsedOrder.orderNumber;

    document.getElementById(
      'previewCustomer'
    ).textContent=
      pendingParsedOrder.customer;

    document.getElementById(
      'previewPhone'
    ).textContent=
      pendingParsedOrder.phone;

    document.getElementById(
      'previewProducts'
    ).textContent=
      `${pendingParsedOrder.products.length} producto(s)`;

    document.getElementById(
      'previewTotal'
    ).textContent=
      formatTotals(
        pendingParsedOrder.totals
      );

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
    return showParseError(
      'Primero debes revisar el pedido.'
    );

  const d=orders.find(
    o=>o.rawMessage===
      pendingParsedOrder.rawMessage
  );

  if(d)
    return showParseError(
      `Este pedido ya fue importado como ${d.orderNumber}.`
    );

  orders.unshift(
    pendingParsedOrder
  );

  saveOrders();

  closeImport();

  renderAll();

  showToast(
    `Pedido ${pendingParsedOrder.orderNumber} creado correctamente.`
  );

  pendingParsedOrder=null
}


/* ==========================================
   LISTADO
========================================== */

function filteredOrders(){

  const q=searchTerm
    .toLowerCase()
    .trim();

  return orders.filter(o=>{

    /* FILTRO DE ESTADO */

    if(
      activeStatus!=='all' &&
      o.status!==activeStatus
    )
      return false;


    /* FILTRO DE FECHA */

    if(dateFilter.type==='day'){

      if(
        dateKey(o.createdAt)!==
        dateFilter.date
      )
        return false;
    }


    /* FILTRO DE SEMANA */

    if(dateFilter.type==='week'){

      const d=new Date(
        o.createdAt
      );

      if(
        getISOWeek(d)!==
        Number(dateFilter.week) ||
        getISOYear(d)!==
        Number(dateFilter.year)
      )
        return false;
    }


    /* BÚSQUEDA */

    if(!q)return true;

    const s=[
      o.orderNumber,
      o.customer,
      o.phone,
      ...(o.products||[])
        .map(p=>p.name)
    ]
      .join(' ')
      .toLowerCase();

    return s.includes(q)
  })
}


/* ==========================================
   RENDERIZAR PEDIDOS
========================================== */

function renderOrders(){

  const list=filteredOrders();

  ordersCount.textContent=
    `${list.length} ${list.length===1?'pedido':'pedidos'}`;


  ordersList.innerHTML=
    list.map(o=>{

      const products=(o.products||[])
        .map(p=>
          `${p.quantity} ${p.name}`
        )
        .join(' · ');

      return`
        <article class="order-card">

          <div>

            <div class="order-number">
              ${escapeHTML(o.orderNumber)}
            </div>

            <div class="order-date">
              ${escapeHTML(
                formatDate(o.createdAt)
              )}
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
              ${escapeHTML(
                formatTotals(o.totals)
              )}
            </div>

            <span
              class="status-badge ${statusClass(o.status)}"
            >
              ${escapeHTML(
                statusLabel(o.status)
              )}
            </span>

            <br>

            <button
              type="button"
              class="order-open-btn"
              data-open-order="${escapeHTML(o.orderNumber)}"
            >
              Ver pedido →
            </button>

          </div>

        </article>
      `
    })
    .join('');


  emptyOrders.hidden=
    list.length!==0;

  ordersList.hidden=
    list.length===0;


  document
    .querySelectorAll('[data-open-order]')
    .forEach(b=>
      b.addEventListener(
        'click',
        ()=>openOrder(
          b.dataset.openOrder
        )
      )
    );


  /* NUEVO:
     resumen del filtro */

  renderDateFilterSummary(list);
}


/* ==========================================
   ESTADÍSTICAS
========================================== */

function renderStats(){

  document.getElementById(
    'statTotal'
  ).textContent=
    orders.length;

  document.getElementById(
    'statPending'
  ).textContent=
    orders.filter(
      o=>o.status==='pending'
    ).length;

  document.getElementById(
    'statInvoiced'
  ).textContent=
    orders.filter(
      o=>o.status==='invoiced'
    ).length;

  document.getElementById(
    'statCancelled'
  ).textContent=
    orders.filter(
      o=>o.status==='cancelled'
    ).length
}


/* ==========================================
   RENDER GENERAL
========================================== */

function renderAll(){

  renderStats();

  renderOrders();

  updateCalendarActiveText();
}


/* ==========================================
   VER PEDIDO
========================================== */

function openOrder(orderNumber){

  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;


  const products=(o.products||[])
    .map(p=>`

      <div class="detail-product">

        <div>

          <strong>
            ${escapeHTML(p.name)}
          </strong>

          <br>

          <small>
            ${escapeHTML(p.presentation)}
          </small>

        </div>

        <div>
          ${p.quantity}
        </div>

        <div>
          ${escapeHTML(
            money(p.total,p.currency)
          )}
        </div>

      </div>

    `)
    .join('');


  const cancellation=o.cancellation?`

    <div
      style="
        margin-top:15px;
        padding:14px;
        background:#fff7f7;
        border:1px solid #e5caca;
        border-radius:14px
      "
    >

      <strong>
        ❌ Información de cancelación
      </strong>

      <p style="margin:8px 0">

        <b>Estado:</b>

        ${
          o.cancellation.type==='partial'
            ?'Cancelación parcial'
            :'Cancelación total'
        }

      </p>

      <p style="margin:8px 0">

        <b>Motivo:</b>

        ${escapeHTML(
          o.cancellation.reason
        )}

      </p>

      <p style="margin:8px 0">

        <b>Productos cancelados:</b><br>

        ${
          (o.cancellation.products||[])
            .map(p=>
              `• ${escapeHTML(p.name)} — ${p.quantity} ${escapeHTML(p.presentation)}`
            )
            .join('<br>')
        }

      </p>

      <small>
        ${escapeHTML(
          formatDate(
            o.cancellation.cancelledAt
          )
        )}
      </small>

    </div>

  `:'';


  const cancellationButton=
    o.status==='cancelled'

      ?`

        <button
          type="button"
          data-send-cancellation="${o.orderNumber}"
        >
          👤 Enviar cancelación al cliente
        </button>

      `

      :`

        <button
          type="button"
          class="danger"
          data-cancel-order="${o.orderNumber}"
        >
          ❌ Cancelar pedido
        </button>

      `;


  orderDetail.innerHTML=`

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
            ${escapeHTML(
              o.orderNumber
            )}
          </div>

          <div class="detail-date">

            ${escapeHTML(
              formatDate(o.createdAt)
            )}

            · Semana ${o.week}

          </div>

        </div>


        <span
          class="status-badge ${statusClass(o.status)}"
        >
          ${escapeHTML(
            statusLabel(o.status)
          )}
        </span>

      </div>


      <div class="detail-customer">

        <div class="detail-box">

          <small>CLIENTE</small>

          <strong>
            ${escapeHTML(o.customer)}
          </strong>

        </div>


        <div class="detail-box">

          <small>TELÉFONO</small>

          <strong>
            ${escapeHTML(o.phone)}
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
            formatTotals(o.totals)
          )}
        </div>

      </div>


      ${cancellation}


      <div class="detail-actions">

        <button
          type="button"
          data-status="${o.orderNumber}"
          ${o.status==='cancelled'?'disabled':''}
        >
          🔄 Cambiar estado
        </button>


        <button
          type="button"
          data-send-client="${o.orderNumber}"
        >
          👤 Enviar al cliente
        </button>


        <button
          type="button"
          data-send-info="${o.orderNumber}"
        >
          ‼️ Informaciones importantes
        </button>


        <button
          type="button"
          data-send-biller="${o.orderNumber}"
        >
          🧾 Enviar a la facturadora
        </button>


        <button
          type="button"
          data-copy-order="${o.orderNumber}"
        >
          📋 Copiar pedido
        </button>


        ${cancellationButton}


        <button
          type="button"
          class="danger"
          data-delete-order="${o.orderNumber}"
        >
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
    .querySelector('[data-send-client]')
    ?.addEventListener(
      'click',
      ()=>sendToClient(orderNumber)
    );


  orderDetail
    .querySelector('[data-send-info]')
    ?.addEventListener(
      'click',
      ()=>sendImportantInfo(orderNumber)
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
    .querySelector('[data-cancel-order]')
    ?.addEventListener(
      'click',
      ()=>cancelOrder(orderNumber)
    );


  orderDetail
    .querySelector('[data-send-cancellation]')
    ?.addEventListener(
      'click',
      ()=>sendCancellationToClient(
        orderNumber
      )
    );


  orderDetail
    .querySelector('[data-delete-order]')
    ?.addEventListener(
      'click',
      ()=>deleteOrder(orderNumber)
    );
}


/* ==========================================
   CAMBIAR ESTADO
========================================== */

function changeStatus(orderNumber){

  const order=orders.find(
    o=>o.orderNumber===orderNumber
  );

  if(!order)return;

  if(order.status==='cancelled')
    return showToast(
      'Este pedido ya está cancelado.'
    );


  const detail=
    document.getElementById(
      'orderDetail'
    );

  const button=
    detail.querySelector(
      '[data-status]'
    );


  if(
    !button||
    detail.querySelector(
      '[data-status-editor]'
    )
  )
    return;


  const box=document.createElement('div');

  box.dataset.statusEditor='';


  box.innerHTML=`

    <div
      style="
        margin-top:15px;
        padding:15px;
        background:#f6f4ef;
        border:1px solid #ddd;
        border-radius:14px
      "
    >

      <label
        style="
          display:block;
          font-weight:700;
          margin-bottom:8px
        "
      >
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
          background:#fff
        "
      >

        <option
          value="pending"
          ${order.status==='pending'?'selected':''}
        >
          Pendiente
        </option>


        <option
          value="invoiced"
          ${order.status==='invoiced'?'selected':''}
        >
          Facturado
        </option>

      </select>


      <div
        style="
          display:flex;
          gap:8px;
          margin-top:10px
        "
      >

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
            font-weight:700
          "
        >
          ✓ Guardar
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
            font-weight:600
          "
        >
          Cancelar
        </button>

      </div>

    </div>

  `;


  button.insertAdjacentElement(
    'afterend',
    box
  );

  button.hidden=true;


  const select=
    box.querySelector(
      '[data-status-select]'
    );


  box.querySelector(
    '[data-save-status]'
  ).onclick=()=>{

    order.status=select.value;

    saveOrders();

    box.remove();

    button.hidden=false;

    renderAll();


    const badge=
      detail.querySelector(
        '.detail-top .status-badge'
      );


    if(badge){

      badge.className=
        `status-badge ${statusClass(order.status)}`;

      badge.textContent=
        statusLabel(order.status);
    }


    showToast(
      `Estado cambiado a: ${statusLabel(order.status)}`
    );
  };


  box.querySelector(
    '[data-cancel-status]'
  ).onclick=()=>{

    box.remove();

    button.hidden=false;
  };


  select.focus();
}


/* ==========================================
   CANCELAR PEDIDO
========================================== */

function cancelOrder(orderNumber){

  const order=orders.find(
    o=>o.orderNumber===orderNumber
  );

  if(!order)return;

  if(order.status==='cancelled')
    return showToast(
      'Este pedido ya está cancelado.'
    );


  const detail=
    document.getElementById(
      'orderDetail'
    );


  if(
    detail.querySelector(
      '[data-cancellation-editor]'
    )
  )
    return;


  const button=
    detail.querySelector(
      '[data-cancel-order]'
    );

  if(!button)return;


  const box=document.createElement('div');

  box.dataset.cancellationEditor='';


  box.innerHTML=`

    <div
      style="
        margin-top:15px;
        padding:15px;
        background:#fff7f7;
        border:1px solid #e5caca;
        border-radius:14px
      "
    >

      <strong
        style="
          display:block;
          margin-bottom:12px
        "
      >
        ❌ Cancelar pedido
      </strong>


      <label
        style="
          display:block;
          font-weight:700;
          margin-bottom:8px
        "
      >
        Tipo de cancelación
      </label>


      <div
        style="
          display:flex;
          gap:15px;
          flex-wrap:wrap;
          margin-bottom:14px
        "
      >

        <label>

          <input
            type="radio"
            name="cancelType"
            value="total"
            checked
          >

          Cancelación total

        </label>


        <label>

          <input
            type="radio"
            name="cancelType"
            value="partial"
          >

          Cancelación parcial

        </label>

      </div>


      <div
        data-cancel-products
        hidden
      >

        <label
          style="
            display:block;
            font-weight:700;
            margin-bottom:8px
          "
        >
          Cantidades a cancelar
        </label>


        ${(order.products||[])
          .map((p,i)=>`

            <div
              style="
                display:flex;
                align-items:center;
                gap:8px;
                margin-bottom:9px
              "
            >

              <div style="flex:1">

                <strong>
                  ${escapeHTML(p.name)}
                </strong>

                <small
                  style="display:block"
                >
                  Pedidas:
                  ${p.quantity}
                  ${escapeHTML(p.presentation)}
                </small>

              </div>


              <input
                type="number"
                min="0"
                max="${p.quantity}"
                value="0"
                data-cancel-qty="${i}"
                style="
                  width:75px;
                  padding:9px;
                  border:1px solid #ccc;
                  border-radius:8px
                "
              >

            </div>

          `)
          .join('')}

      </div>


      <label
        style="
          display:block;
          font-weight:700;
          margin:12px 0 6px
        "
      >
        Motivo de la cancelación
      </label>


      <textarea
        data-cancel-reason
        rows="4"
        placeholder="Escribe el motivo..."
        style="
          width:100%;
          padding:10px;
          border:1px solid #ccc;
          border-radius:10px;
          resize:vertical
        "
      ></textarea>


      <div
        style="
          display:flex;
          gap:8px;
          margin-top:10px
        "
      >

        <button
          type="button"
          data-save-cancellation
          style="
            flex:1;
            padding:11px;
            border:0;
            border-radius:10px;
            background:#9b3030;
            color:#fff;
            font-weight:700
          "
        >
          ✓ Guardar cancelación
        </button>


        <button
          type="button"
          data-cancel-cancellation
          style="
            flex:1;
            padding:11px;
            border:1px solid #ccc;
            border-radius:10px;
            background:#fff;
            font-weight:600
          "
        >
          Cancelar
        </button>

      </div>

    </div>

  `;


  button.insertAdjacentElement(
    'afterend',
    box
  );

  button.hidden=true;


  const productsBox=
    box.querySelector(
      '[data-cancel-products]'
    );


  box.querySelectorAll(
    '[name="cancelType"]'
  ).forEach(radio=>{

    radio.addEventListener(
      'change',
      ()=>{
        productsBox.hidden=
          radio.value!=='partial';
      }
    );
  });


  box.querySelector(
    '[data-save-cancellation]'
  )
  .addEventListener(
    'click',
    ()=>saveCancellation(
      orderNumber
    )
  );


  box.querySelector(
    '[data-cancel-cancellation]'
  )
  .addEventListener(
    'click',
    ()=>{
      box.remove();
      button.hidden=false;
    }
  );


  box.querySelector(
    '[data-cancel-reason]'
  ).focus();
}


/* ==========================================
   GUARDAR CANCELACIÓN
========================================== */

function saveCancellation(orderNumber){

  const order=orders.find(
    o=>o.orderNumber===orderNumber
  );

  if(!order)return;


  const box=document.querySelector(
    '[data-cancellation-editor]'
  );

  if(!box)return;


  const type=
    box.querySelector(
      '[name="cancelType"]:checked'
    )?.value;


  const reason=
    box.querySelector(
      '[data-cancel-reason]'
    )?.value.trim();


  if(!reason)
    return showToast(
      'Debes escribir el motivo de la cancelación.'
    );


  let cancelledProducts=[];


  /* CANCELACIÓN TOTAL */

  if(type==='total'){

    cancelledProducts=
      (order.products||[])
        .map(p=>({
          name:p.name,
          quantity:p.quantity,
          presentation:p.presentation
        }));
  }


  /* CANCELACIÓN PARCIAL */

  else{

    box.querySelectorAll(
      '[data-cancel-qty]'
    )
    .forEach(input=>{

      const index=
        Number(
          input.dataset.cancelQty
        );

      const product=
        order.products[index];

      if(!product)return;


      const max=
        Number(product.quantity)||0;


      const qty=Math.min(
        Math.max(
          Number(input.value)||0,
          0
        ),
        max
      );


      if(qty>0){

        cancelledProducts.push({
          name:product.name,
          quantity:qty,
          presentation:product.presentation
        });

      }

    });


    if(!cancelledProducts.length)
      return showToast(
        'Selecciona al menos una cantidad para cancelar.'
      );
  }


  /* GUARDAR */

  order.status='cancelled';


  order.cancellation={

    type:type,

    reason:reason,

    products:cancelledProducts,

    cancelledAt:
      new Date().toISOString(),

    clientNotified:false
  };


  saveOrders();


  /*
    NO abre WhatsApp automáticamente.
  */

  orderDialog.close();

  renderAll();

  openOrder(orderNumber);


  showToast(
    `Pedido ${order.orderNumber} cancelado correctamente.`
  );
}


/* ==========================================
   ELIMINAR
========================================== */

function deleteOrder(orderNumber){

  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;


  if(
    !confirm(
      `¿Eliminar el pedido ${o.orderNumber}?`
    )
  )
    return;


  orders=orders.filter(
    x=>x.orderNumber!==orderNumber
  );


  saveOrders();

  orderDialog.close();

  renderAll();


  showToast(
    'Pedido eliminado.'
  );
}


/* ==========================================
   WHATSAPP
========================================== */

function buildOrderMessage(o){

  const lines=(o.products||[])
    .map(p=>
      `• ${p.name} — ${p.quantity} ${p.presentation} × ${money(p.unitPrice,p.currency)} = ${money(p.total,p.currency)}`
    );


  let totals='';


  if(Number(o.totals?.CUP)>0)
    totals+=
      `💰 TOTAL CUP: ${money(o.totals.CUP,'CUP')}\n`;


  if(Number(o.totals?.USD)>0)
    totals+=
      `💵 TOTAL USD: ${money(o.totals.USD,'USD')}\n`;


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


function buildClientMessage(o){

  const lines=(o.products||[])
    .map(p=>
      `• ${p.name} - ${p.quantity} - ${p.presentation}`
    );


  const state={

    pending:
      'Pendiente de Facturación',

    confirmed:
      'Confirmado',

    invoiced:
      'Facturado',

    delivered:
      'Entregado',

    cancelled:
      'Cancelado'

  }[o.status]||
    'Pendiente de Facturación';


  return`Estimado cliente su # de preorden es: *${o.orderNumber}*

👤 *Nombre:* ${o.customer}

📦 *Productos:*
${lines.join('\n')}

📌 Estado: ${state}.

❗️Esta preorden no reserva su producto. La compra solo está asegurada una vez obtenga la factura del producto en nuestra oficina❗️
✅ Usted fue atendido por: *Alejandro* - Gestor de Ventas. Información que debe comunicar a la facturadora que lo atienda.

Disfrute su producto🔖`;
}


function buildCancellationMessage(o){

  const c=o.cancellation||{};


  const type=
    c.type==='partial'
      ?'Cancelación parcial'
      :'Cancelación total';


  const lines=(c.products||[])
    .map(p=>
      `• ${p.name} - ${p.quantity} - ${p.presentation}`
    );


  return`Estimado cliente su preorden *${o.orderNumber}* ha sido cancelada:

👤 *Nombre:* ${o.customer}

📦 *Productos:*
${lines.join('\n')}

📌 Estado: ${type}
🖇 *Motivos:* ${c.reason||''}

Disculpe las molestias ocasionadas.

Gestor de Ventas - Alejandro.`;
}


function normalizeCubanPhone(phone){

  let v=String(phone||'')
    .replace(/[^\d]/g,'');


  if(v.startsWith('00'))
    v=v.slice(2);


  if(v.startsWith('53'))
    return v;


  return v.length===8
    ?`53${v}`
    :v;
}


function sendToClient(orderNumber){

  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;


  const phone=
    normalizeCubanPhone(o.phone);


  if(!phone)
    return showToast(
      'El teléfono del cliente no es válido.'
    );


  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(
      buildClientMessage(o)
    )}`,
    '_blank'
  );


  showToast(
    'Abriendo WhatsApp del cliente.'
  );
}


/* ==========================================
   ENVIAR CANCELACIÓN
========================================== */

function sendCancellationToClient(orderNumber){

  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;


  if(!o.cancellation)
    return showToast(
      'Este pedido no tiene una cancelación guardada.'
    );


  const phone=
    normalizeCubanPhone(o.phone);


  if(!phone)
    return showToast(
      'El teléfono del cliente no es válido.'
    );


  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(
      buildCancellationMessage(o)
    )}`,
    '_blank'
  );


  o.cancellation.clientNotified=true;

  o.cancellation.clientNotifiedAt=
    new Date().toISOString();


  saveOrders();


  showToast(
    'WhatsApp abierto con la cancelación preparada.'
  );
}


/* ==========================================
   INFORMACIONES IMPORTANTES
========================================== */

function buildImportantInfoMessage(){

  return`‼️Informaciones importantes:‼️

🧾 *Facturación:*
Callejón de los Prorestante esq. Colón, Nuevo Vedado.
▪︎ https://www.google.com/maps/search/?api=1&query=23.1195366%2C-82.3967783

📍 *Retiro en almacén:*
Agro de la EJT. Ubicado cerca de la Ciudad Deportiva. Al lado de los cajeros y la TRD.
▪︎ https://www.google.com/maps/search/?api=1&query=23.103866%2C-82.390748

⏰ *Horario:* Lunes a Viernes 10:00 a.m - 4:00 p.m | Sábados 9:30 a.m - 2:00 p.m.

💰 *Método de pago:* Efectivo (solo se recibe 20% en billetes de 50 CUP y 30% en billetes de 100 CUP por compra).`;
}


function sendImportantInfo(orderNumber){

  const o=orders.find(
    x=>x.orderNumber===orderNumber
  );

  if(!o)return;


  const phone=
    normalizeCubanPhone(o.phone);


  if(!phone)
    return showToast(
      'El teléfono del cliente no es válido.'
    );


  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(
      buildImportantInfoMessage()
    )}`,
    '_blank'
  );


  showToast(
    'Abriendo WhatsApp con las informaciones importantes.'
  );
}


/* ==========================================
   COPIAR PEDIDO
========================================== */

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


/* ==========================================
   MENSAJES
========================================== */

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


/* ==========================================
   EVENTOS
========================================== */

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


previewImportBtn
  .addEventListener(
    'click',
    previewImport
  );


document
  .getElementById('importForm')
  .addEventListener(
    'submit',
    e=>{
      e.preventDefault();
      createOrder();
    }
  );


/* BÚSQUEDA */

searchOrders.addEventListener(
  'input',
  e=>{

    searchTerm=e.target.value;

    renderOrders();
  }
);


/* FILTROS DE ESTADO */

document
  .querySelectorAll('.order-filter')
  .forEach(button=>{

    button.addEventListener(
      'click',
      ()=>{

        document
          .querySelectorAll(
            '.order-filter'
          )
          .forEach(x=>
            x.classList.remove(
              'active'
            )
          );


        button.classList.add(
          'active'
        );


        activeStatus=
          button.dataset.status;


        renderOrders();
      }
    );

  });


/* CERRAR DETALLE */

orderDialog.addEventListener(
  'click',
  e=>{

    if(e.target===orderDialog)
      orderDialog.close();
  }
);


/* ==========================================
   INICIALIZAR CALENDARIO
========================================== */

renderCalendar();

renderAll();
