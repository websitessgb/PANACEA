const WHATSAPP = '5358051138';
let cart = JSON.parse(localStorage.getItem('panacea-cart') || '{}');
let activeCategory = 'all';
let activeAvailability = 'all';
let searchTerm = '';

const money = (n, currency='CUP') => `${new Intl.NumberFormat('es-CU').format(n)} ${currency}`;
const productById = id => PRODUCTS.find(p => p.id === id);
const saveCart = () => { localStorage.setItem('panacea-cart', JSON.stringify(cart)); renderCart(); };
const isAvailable = p => p.availability !== 'out';
const maxQty = p => p.availability === 'limited' ? p.stock : Infinity;

function availabilityLabel(p){
  if(p.availability === 'out') return ['Agotado','out'];
  if(p.availability === 'limited') return [`${p.stock} disponibles`,'limited'];
  return ['Disponible',''];
}

function filteredProducts(){
  return PRODUCTS.filter(p => {
    const catOk = activeCategory === 'all' || p.category === activeCategory;
    const avOk = activeAvailability === 'all' || (activeAvailability === 'out' ? p.availability === 'out' : isAvailable(p));
    const q = searchTerm.toLowerCase();
    const text = `${p.name} ${p.presentation} ${p.description}`.toLowerCase();
    return catOk && avOk && (!q || text.includes(q));
  });
}

function renderProducts(){
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const list = filteredProducts();
  grid.innerHTML = list.map(p => {
    const [label, cls] = availabilityLabel(p);
    const disabled = p.availability === 'out' ? 'disabled' : '';
    const low = p.availability === 'limited' && p.stock <= 3 ? ' · últimas unidades' : '';
    return `<article class="product-card">
      <div class="product-image"><img src="${p.image}" alt="${p.name}" loading="lazy"><span class="badge ${cls}">${label}${low}</span></div>
      <div class="product-body">
        <h3>${p.name}</h3>
        <p class="presentation">${p.presentation}</p>
        <p class="description">${p.description}</p>
        <div class="price">${money(p.price,p.currency)} <small>${p.priceLabel || 'por presentación'}</small></div>
        <div class="product-actions"><button class="add-btn" data-add="${p.id}" ${disabled}>${p.availability === 'out' ? 'Agotado' : '🛒 Agregar al carrito'}</button></div>
      </div>
    </article>`;
  }).join('');
  empty.hidden = list.length !== 0;
  grid.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.add, 1)));
}

function addToCart(id, qty){
  const p = productById(id); if(!p || p.availability === 'out') return;
  const current = cart[id] || 0;
  const next = current + qty;
  if(next > maxQty(p)){
    alert(`Solo quedan ${p.stock} unidades disponibles de ${p.name}.`);
    return;
  }
  cart[id] = next; saveCart(); openCart();
}

function removeFromCart(id){
  if(cart[id] !== undefined){
    delete cart[id];
    saveCart();
  }
}

function setQty(id, qty){
  const p = productById(id);
  if(!p) return;

  qty = Number(qty);

  if(qty <= 0){
    delete cart[id];
    saveCart();
    return;
  }

  if(qty > maxQty(p)){
    alert(`Solo quedan ${p.stock} unidades disponibles de ${p.name}.`);
    qty = maxQty(p);
  }

  cart[id] = Math.floor(qty);
  saveCart();
}

function cartEntries(){
  return Object.entries(cart)
    .map(([id,qty]) => ({
      p: productById(id),
      qty: Number(qty)
    }))
    .filter(x => x.p && x.qty > 0);
}

function renderCart(){
  const entries = cartEntries();

  const count = entries.reduce((a,x) => a + x.qty, 0);

  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartCountMobile').textContent = count;
  document.getElementById('cartEmpty').hidden = entries.length > 0;
  document.getElementById('cartFooter').hidden = entries.length === 0;

  document.getElementById('cartItems').innerHTML =
    entries.map(({p,qty}) => {

      const canIncrease =
        p.availability !== 'limited' ||
        qty < Number(p.stock);

      return `<div class="cart-line">
        <img src="${p.image}" alt="${p.name}">

        <div class="cart-line-info">
          <h4>${p.name}</h4>
          <p>${p.presentation}</p>

          <div class="cart-line-controls">
            <button
              type="button"
              class="qty-btn"
              data-dec="${p.id}"
              aria-label="Disminuir cantidad">
              −
            </button>

            <input
              type="number"
              class="qty-input"
              data-qty="${p.id}"
              min="1"
              ${p.availability === 'limited' ? `max="${Number(p.stock)}"` : ''}
              step="1"
              value="${qty}"
              inputmode="numeric"
              aria-label="Cantidad de ${p.name}"
            >

            <button
              type="button"
              class="qty-btn"
              data-inc="${p.id}"
              aria-label="Aumentar cantidad"
              ${canIncrease ? '' : 'disabled'}>
              +
            </button>

            <button
              type="button"
              class="remove-btn"
              data-remove="${p.id}"
              aria-label="Eliminar ${p.name} del carrito">
              🗑️
            </button>
          </div>
        </div>

        <div class="line-price">
          ${money(p.price * qty,p.currency)}
        </div>
      </div>`;
    }).join('');

  document.querySelectorAll('[data-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.dec;
      const currentQty = Number(cart[id] || 0);
      setQty(id, currentQty - 1);
    });
  });

  document.querySelectorAll('[data-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart(btn.dataset.inc, 1);
    });
  });

  document.querySelectorAll('[data-qty]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.qty;
      let qty = Number(input.value);

      if(!Number.isFinite(qty) || qty < 1){
        qty = 1;
      }

      qty = Math.floor(qty);

      const p = productById(id);
      if(p && p.availability === 'limited' && qty > Number(p.stock)){
        alert(`Solo quedan ${p.stock} unidades disponibles de ${p.name}.`);
        qty = Number(p.stock);
      }

      input.value = qty;
      setQty(id, qty);
    });

    input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        input.blur();
      }
    });
  });

  document.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(btn.dataset.remove);
    });
  });

  const total = entries.reduce(
    (sum,{p,qty}) => sum + p.price * qty,
    0
  );

  document.getElementById('cartTotal').textContent = money(total);
}

function openCart(){document.getElementById('cartDrawer').classList.add('open');document.getElementById('cartDrawer').setAttribute('aria-hidden','false');document.getElementById('overlay').classList.add('show');}
function closeCart(){document.getElementById('cartDrawer').classList.remove('open');document.getElementById('cartDrawer').setAttribute('aria-hidden','true');document.getElementById('overlay').classList.remove('show');}
function checkout(){
  const entries=cartEntries(); if(!entries.length) return;
  const total=entries.reduce((s,{p,qty})=>s+p.price*qty,0);
  document.getElementById('checkoutSummary').textContent=`${entries.reduce((s,x)=>s+x.qty,0)} unidades · ${money(total)}`;
  document.getElementById('checkoutDialog').showModal();
}

document.querySelectorAll('.category-card').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.category-card').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); activeCategory=btn.dataset.category; renderProducts(); document.getElementById('catalogo').scrollIntoView({behavior:'smooth'});
}));
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');activeAvailability=btn.dataset.availability;renderProducts();}));
document.getElementById('searchInput').addEventListener('input',e=>{searchTerm=e.target.value.trim();renderProducts();});
['openCart','openCartMobile'].forEach(id=>document.getElementById(id).addEventListener('click',openCart));
document.getElementById('closeCart').addEventListener('click',closeCart);document.getElementById('overlay').addEventListener('click',closeCart);document.getElementById('checkoutBtn').addEventListener('click',checkout);
document.getElementById('closeCheckout').addEventListener('click',()=>{
  document.getElementById('checkoutDialog').close();
});

document.getElementById('checkoutForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.getElementById('customerName').value.trim(); const phone=document.getElementById('customerPhone').value.trim();
  if(!name||!phone) return;
  const entries=cartEntries(); const total=entries.reduce((s,{p,qty})=>s+p.price*qty,0);
  const lines=entries.map(({p,qty})=>`• ${p.name} — ${qty} × ${money(p.price,p.currency)} = ${money(p.price*qty,p.currency)}`);
  const msg=`🛍️ PEDIDO PANACEA\n\n👤 Cliente: ${name}\n📞 Teléfono: ${phone}\n\n📦 PRODUCTOS\n${lines.join('\n')}\n\n💰 TOTAL: ${money(total)}\n\n❗️Esta solicitud generada no reserva su producto. La compra solo esta asegurada una vez obtenga la factura del producto en nuestra oficina (ver en google maps en el final de la página)❗️\n\n✅Usted ha sido atendido por: Alejandro - Gestor de Ventas.`;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`,'_blank');
  document.getElementById('checkoutDialog').close();
});

renderProducts(); renderCart();
