(() => {
'use strict';
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
let original = typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS) ? clone(PRODUCTS) : [];
let products = clone(original);
let selected = new Set();
let imageFiles = new Map();
let dirtyFields = new Set();
let deletedImagePaths = new Set();

const moneyFmt = n => new Intl.NumberFormat('es-CU',{maximumFractionDigits:2}).format(Number(n)||0);
const categoryName = c => ({'reposteria-panaderia':'Repostería y Panadería',aseo:'Aseo y Limpieza',ferreteria:'Ferretería',otros:'Otros'}[c]||c);
const escapeHtml = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markDirty = (id,field) => dirtyFields.add(`${id}:${field}`);
function notify(message,error=false){const box=$('messageBox');box.textContent=message;box.hidden=false;box.classList.toggle('error',error);box.scrollIntoView({behavior:'smooth',block:'nearest'});}
function visibleProducts(){const q=$('searchProducts').value.trim().toLowerCase(),cat=$('categoryFilter').value,av=$('availabilityFilter').value;return products.filter(p=>(!q||`${p.name} ${p.id}`.toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!av||p.availability===av));}
function render(){
 $('productCount').textContent=products.length;
 $('selectedCount').textContent=selected.size;
 $('changeSummary').textContent=(dirtyFields.size||imageFiles.size||deletedImagePaths.size)?`${dirtyFields.size} cambio(s) de datos · ${imageFiles.size} imagen(es) · ${deletedImagePaths.size} archivo(s) de imagen por eliminar`:'Sin cambios pendientes.';
 $('publishBtn').disabled=!dirtyFields.size&&!imageFiles.size&&!deletedImagePaths.size;
 $('productsBody').innerHTML=visibleProducts().map(p=>`<tr data-id="${escapeHtml(p.id)}">
 <td><input type="checkbox" data-select="${escapeHtml(p.id)}" ${selected.has(p.id)?'checked':''}></td>
 <td><div class="cm-product"><img src="../${escapeHtml(p.image)}?v=${Date.now()}" alt="" onerror="this.style.opacity='.25'"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(categoryName(p.category))} · ${escapeHtml(p.presentation)}<br>ID: ${escapeHtml(p.id)}</small></div></div></td>
 <td><input type="number" min="0" step="any" data-field="price" value="${Number(p.price)||0}" aria-label="Precio de ${escapeHtml(p.name)}"></td>
 <td><select data-field="currency"><option value="CUP" ${p.currency==='CUP'?'selected':''}>CUP</option><option value="USD" ${p.currency==='USD'?'selected':''}>USD</option></select></td>
 <td><select data-field="availability"><option value="unlimited" ${p.availability==='unlimited'?'selected':''}>Disponible</option><option value="limited" ${p.availability==='limited'?'selected':''}>Limitado</option><option value="out" ${p.availability==='out'?'selected':''}>Agotado</option></select></td>
 <td class="cm-image-cell"><label>📷 Reemplazar imagen<input type="file" accept="image/jpeg,image/png,image/webp" data-image="${escapeHtml(p.id)}"></label><small>${escapeHtml(imageFiles.has(p.id)?imageFiles.get(p.id).name:p.image)}</small></td>
 <td><button type="button" class="cm-delete-btn" data-delete="${escapeHtml(p.id)}">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="7" class="cm-loading">No hay productos que coincidan.</td></tr>';
}
function updateField(id,field,value){const p=products.find(x=>x.id===id);if(!p)return;p[field]=field==='price'?Math.max(0,Number(value)||0):value;if(field==='availability'&&value==='out')p.stock=0;if(field==='availability'&&value==='unlimited')p.stock=null;markDirty(id,field);renderSummaryOnly();}
function renderSummaryOnly(){$('selectedCount').textContent=selected.size;$('changeSummary').textContent=`${dirtyFields.size} cambio(s) de datos · ${imageFiles.size} imagen(es) · ${deletedImagePaths.size} imagen(es) por eliminar`;$('publishBtn').disabled=!dirtyFields.size&&!imageFiles.size&&!deletedImagePaths.size;}
$('productsBody').addEventListener('click',e=>{const btn=e.target.closest('[data-delete]');if(!btn)return;const id=btn.dataset.delete,p=products.find(x=>x.id===id);if(!p)return;if(!confirm(`¿Eliminar "${p.name}" del catálogo? Esta acción se aplicará a la página cuando publiques los cambios.`))return;products=products.filter(x=>x.id!==id);selected.delete(id);imageFiles.delete(id);if(p.image)deletedImagePaths.add(p.image);dirtyFields.add(`${id}:deleted`);render();notify(`Producto "${p.name}" marcado para eliminar. Publica los cambios para retirarlo de la tienda.`);});
$('productsBody').addEventListener('change',async e=>{
 const select=e.target.closest('[data-select]');if(select){select.checked?selected.add(select.dataset.select):selected.delete(select.dataset.select);renderSummaryOnly();return;}
 const field=e.target.dataset.field;if(field){const row=e.target.closest('tr');updateField(row.dataset.id,field,e.target.value);return;}
 const fileInput=e.target.closest('[data-image]');if(fileInput&&fileInput.files[0]){const id=fileInput.dataset.image,file=fileInput.files[0];if(!/^image\/(jpeg|png|webp)$/.test(file.type)){notify('Formato no permitido. Usa JPG, PNG o WEBP.',true);return;}if(file.size>8*1024*1024){notify('La imagen supera 8 MB. Reduce su tamaño antes de subirla.',true);return;}imageFiles.set(id,file);const p=products.find(x=>x.id===id),ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';p.image=`assets/products/${p.category}/${p.id}.${ext}`;markDirty(id,'image');render();notify(`Imagen preparada para ${p.name}. Recuerda publicar los cambios.`);}
});
$('productsBody').addEventListener('input',e=>{const field=e.target.dataset.field;if(field==='price'){const row=e.target.closest('tr');updateField(row.dataset.id,'price',e.target.value);}});
$('searchProducts').addEventListener('input',render);$('categoryFilter').addEventListener('change',render);$('availabilityFilter').addEventListener('change',render);
$('selectAll').addEventListener('change',e=>{visibleProducts().forEach(p=>e.target.checked?selected.add(p.id):selected.delete(p.id));render();});
$('clearSelectionBtn').addEventListener('click',()=>{selected.clear();$('selectAll').checked=false;render();});
$('applyBulkBtn').addEventListener('click',()=>{const amount=Number($('bulkAmount').value);if(!selected.size)return notify('Selecciona primero los productos que deseas modificar.',true);if(!Number.isFinite(amount))return notify('Introduce un valor válido.',true);const op=$('bulkOperation').value;products.forEach(p=>{if(!selected.has(p.id))return;p.price=op==='percent'?Math.max(0,Math.round(p.price*(1+amount/100)*100)/100):Math.max(0,Math.round((p.price+amount)*100)/100);markDirty(p.id,'price');});render();notify(`Se ajustaron los precios de ${selected.size} productos. Revisa los importes antes de publicar.`);});
function slugify(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);}
function imageExtension(file){return file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';}
$('addProductBtn').addEventListener('click',()=>{
 const name=$('newName').value.trim(),idRaw=$('newId').value.trim(),category=$('newCategory').value,presentation=$('newPresentation').value.trim(),price=Number($('newPrice').value),currency=$('newCurrency').value,priceLabel=$('newPriceLabel').value.trim(),availability=$('newAvailability').value,description=$('newDescription').value.trim(),file=$('newImage').files[0];
 if(!name||!presentation||$('newPrice').value===''||!Number.isFinite(price)||price<0)return notify('Completa el nombre, la presentación y un precio válido (puede ser 0).',true);
 if(!file)return notify('Selecciona una fotografía para el nuevo producto.',true);
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))return notify('Formato no permitido. Usa JPG, PNG o WEBP.',true);
 if(file.size>8*1024*1024)return notify('La imagen supera 8 MB. Reduce su tamaño antes de añadirla.',true);
 const id=slugify(idRaw||name);if(!id)return notify('No se pudo generar un ID válido. Introduce uno manualmente.',true);
 if(products.some(p=>p.id.toLowerCase()===id.toLowerCase()))return notify(`Ya existe un producto con el ID \"${id}\". Usa otro identificador.`,true);
 const ext=imageExtension(file),imagePath=`assets/products/${category}/${id}.${ext}`;
 products.push({id,name,category,presentation,price,currency,priceLabel:priceLabel||'por unidad',availability,stock:availability==='out'?0:null,image:imagePath,description});
 imageFiles.set(id,file);dirtyFields.add(`${id}:new`);render();
 ['newName','newId','newPresentation','newPrice','newPriceLabel','newDescription'].forEach(k=>$(k).value='');$('newAvailability').value='unlimited';$('newCurrency').value='CUP';$('newImage').value='';
 notify(`Producto \"${name}\" añadido al catálogo. Recuerda publicar para que aparezca en la tienda.`);
});

function csvCell(v){const s=String(v??'');return /[",\n;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
$('exportCsvBtn').addEventListener('click',()=>{const headers=['id','name','category','presentation','price','currency','priceLabel','availability','stock','image','description'];const csv=[headers.join(';'),...products.map(p=>headers.map(h=>csvCell(p[h])).join(';'))].join('\r\n');download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'panacea_catalogo.csv');});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(quoted){if(c==='"'&&next==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===';'||c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell.length||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(x=>x.trim()));}
$('importCsvInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const text=await file.text(),rows=parseCsv(text),headers=rows.shift().map(x=>x.trim().replace(/^\ufeff/,'')),idx=headers.indexOf('id');if(idx<0)throw Error('El CSV debe incluir una columna id.');let updated=0;for(const row of rows){const id=row[idx],p=products.find(x=>x.id===id);if(!p)continue;headers.forEach((h,i)=>{if(!['price','currency','availability','stock','name','presentation','priceLabel','description'].includes(h)||row[i]===undefined||row[i]==='')return;if(h==='price'||h==='stock')p[h]=row[i]==='null'?null:Number(row[i]);else p[h]=row[i];markDirty(id,h);});if(p.availability==='out')p.stock=0;updated++;}render();notify(`Importación terminada: ${updated} producto(s) actualizados. Revisa la tabla.`);}catch(err){notify(`No se pudo importar el CSV: ${err.message}`,true);}e.target.value='';});
function b64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});}
async function api(url,token,options={}){const res=await fetch(`https://api.github.com${url}`,{...options,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})}});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.message||`GitHub respondió ${res.status}`);return data;}
function serializeProducts(){return 'const PRODUCTS = '+JSON.stringify(products,null,2)+';\n';}
$('publishBtn').addEventListener('click',async()=>{
 const token=$('githubToken').value.trim(),repo=$('repoName').value.trim(),branch=$('branchName').value.trim();
 if(!dirtyFields.size&&!imageFiles.size&&!deletedImagePaths.size)return;
 if(!token)return notify('Introduce tu token de GitHub para publicar. El token no se guardará.',true);
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!branch)return notify('Comprueba el nombre del repositorio y la rama.',true);
 const changes=[...dirtyFields].map(x=>{const [id,field]=x.split(':');return {id,field};});
 const deleted=[...dirtyFields].filter(x=>x.endsWith(':deleted')).length;
 const summary=`Se publicará el catálogo con ${products.length} productos.\nCambios de datos: ${dirtyFields.size}.\nProductos nuevos: ${[...dirtyFields].filter(x=>x.endsWith(':new')).length}.\nProductos eliminados: ${deleted}.\nImágenes nuevas/reemplazadas: ${imageFiles.size}.\nImágenes que se eliminarán del repositorio: ${deletedImagePaths.size}.\n\n¿Deseas continuar?`;
 if(!confirm(summary))return;
 const btn=$('publishBtn');btn.disabled=true;btn.textContent='Publicando…';$('connectionStatus').textContent='Conectando…';
 try{
   const [owner,name]=repo.split('/');
   const ref=await api(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`,token);
   const parentSha=ref.object.sha;
   const commit=await api(`/repos/${owner}/${name}/git/commits/${parentSha}`,token);
   const treeItems=[];
   const productBlob=await api(`/repos/${owner}/${name}/git/blobs`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:serializeProducts(),encoding:'utf-8'})});
   treeItems.push({path:'products.js',mode:'100644',type:'blob',sha:productBlob.sha});
   for(const [id,file] of imageFiles){const p=products.find(x=>x.id===id);if(!p)continue;const blob=await api(`/repos/${owner}/${name}/git/blobs`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:await b64(file),encoding:'base64'})});treeItems.push({path:p.image,mode:'100644',type:'blob',sha:blob.sha});}
   for(const path of deletedImagePaths){if(!treeItems.some(item=>item.path===path))treeItems.push({path,mode:'100644',type:'blob',sha:null});}
   const tree=await api(`/repos/${owner}/${name}/git/trees`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree:treeItems})});
   const newCommit=await api(`/repos/${owner}/${name}/git/commits`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Actualización del catálogo PANACEA (${new Date().toLocaleDateString('es-ES')})`,tree:tree.sha,parents:[parentSha]})});
   await api(`/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`,token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:newCommit.sha,force:false})});
   original=clone(products);dirtyFields.clear();imageFiles.clear();deletedImagePaths.clear();selected.clear();$('githubToken').value='';$('connectionStatus').textContent='Publicado ✓';notify('¡Publicación completada! GitHub recibió los cambios. La página se desplegará automáticamente cuando termine GitHub Actions.');render();
 }catch(err){$('connectionStatus').textContent='Error';notify(`No se pudo publicar: ${err.message}. Comprueba el token, los permisos Contents (read/write), el nombre de la rama y que GitHub Actions esté habilitado.`,true);}
 finally{btn.disabled=!dirtyFields.size&&!imageFiles.size&&!deletedImagePaths.size;btn.textContent='✓ Revisar y publicar cambios';}
});
if(!original.length){$('productsBody').innerHTML='<tr><td colspan="6">No se pudo cargar PRODUCTS. Abre esta página desde GitHub Pages o desde un servidor web.</td></tr>';notify('No se pudo leer products.js. Comprueba la ruta o abre esta página desde el sitio publicado.',true);}else render();
})();