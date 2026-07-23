// ================= CONFIG =================
const SETORES = ['EXTRUSÃO','CORTE','IMPRESSÃO','LAMINAÇÃO','REBOBINADEIRA'];
const DEFAULT_MATERIAIS = ['VIRGEM','PP','PEBD','PET+PE','IMPRESSO VIRGEM','IMPRESSO PP','VALVULADO','OUTRO'];
const TURNOS = ['MANHÃ','TARDE','NOITE'];

const DEFAULT_STATUS_CLICHE = ['','AGUARDANDO CLICHE','AGUARDANDO PAG DE CLICHE','CLICHE EM CASA','CLICHE PRONTO','OUTRO'];
const DEFAULT_STATUS_PRODUCAO = ['AGUARDANDO BOBINAS','AGUARDANDO BOBINAS CEAPA','PRODUÇÃO NO CORTE','FILA DA IMPRESSÃO','FINALIZADO','OUTRO'];
const DEFAULT_RESPONSAVEIS = ['THIAGO','MURILO','CHAGAS','MAURICIO','CHRISTIANE','RAFAEL'];

const DEFAULT_MACHINES = [
 {id:'EF1',name:'EF1 - HGR COEX',setor:'EXTRUSÃO'},
 {id:'EF2',name:'EF2 - FERRETI 1000',setor:'EXTRUSÃO'},
 {id:'CF1',name:'MAQ_01 - HECE 1100',setor:'CORTE'},
 {id:'CF2',name:'CF2 - HECE 1100',setor:'CORTE'},
 {id:'CF3',name:'CF3 - HECE 700',setor:'CORTE'},
 {id:'SANTORO',name:'SANTORO',setor:'CORTE'},
 {id:'VALV',name:'VALVULADO',setor:'CORTE'},
 {id:'G4',name:'G4 8 CORES',setor:'IMPRESSÃO'},
 {id:'COLOFLEX',name:'COLOFLEX',setor:'IMPRESSÃO'},
 {id:'LAM1',name:'LAMINAÇÃO 1',setor:'LAMINAÇÃO'},
 {id:'REB1',name:'REBOBINADEIRA 1',setor:'REBOBINADEIRA'}
];
const DEFAULT_OPERADORES = ['NALDO'];

// ================= STATE =================
let machines = [];
let operadores = [];
let editingKey = null;
let pedidos = [];
let editingPedidoId = null;
let materiais = [];
let statusClicheList = [];
let statusProducaoList = [];
let responsaveis = [];
let clientes = [];
let produtos = [];
let ordensProducao = [];
let editingOpNumber = null;
let proximoNumeroOp = 9536;

// ================= HELPERS =================
function uuid(){ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function novoPedidoId(){ return 'PED-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function parseNum(v){ if(v===undefined||v===null||v==='') return 0; const n=parseFloat(String(v).replace(/\./g,'').replace(',','.')); return isNaN(n)?0:n; }
function fmt(n){ return (n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(n){ return (n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'; }
function pctClass(p){ if(p>=10) return 'bad'; if(p>=5) return 'warn'; return 'good'; }
function brDate(iso){ if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function uniqueNames(list){
  const seen = new Set();
  return list.map(v=>String(v||'').trim()).filter(v=>{
    const key=v.toLocaleUpperCase('pt-BR');
    if(!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function dataOptions(list){ return list.map(v=>`<option value="${esc(v)}"></option>`).join(''); }

// ================= STORAGE: CONFIG =================
async function loadMachines(){
  try{ const r=await window.storage.get('config:maquinas', true); if(r&&r.value) return JSON.parse(r.value); }catch(e){}
  await window.storage.set('config:maquinas', JSON.stringify(DEFAULT_MACHINES), true);
  return DEFAULT_MACHINES.slice();
}
async function saveMachines(){ await window.storage.set('config:maquinas', JSON.stringify(machines), true); }
async function loadOperadores(){
  try{ const r=await window.storage.get('config:operadores', true); if(r&&r.value) return JSON.parse(r.value); }catch(e){}
  await window.storage.set('config:operadores', JSON.stringify(DEFAULT_OPERADORES), true);
  return DEFAULT_OPERADORES.slice();
}
async function saveOperadores(){ await window.storage.set('config:operadores', JSON.stringify(operadores), true); }

// generic simple-list config (materiais, status clichê, status produção, responsáveis)
async function loadSimpleList(key, defaults){
  try{ const r=await window.storage.get(key, true); if(r&&r.value) return JSON.parse(r.value); }catch(e){}
  await window.storage.set(key, JSON.stringify(defaults), true);
  return defaults.slice();
}
async function saveSimpleList(key, arr){ await window.storage.set(key, JSON.stringify(arr), true); }

// ================= STORAGE: RECORDS =================
function recKey(dateStr,id){ return `record:${dateStr}:${id}`; }
async function saveRecord(dateStr, rec){ await window.storage.set(recKey(dateStr, rec.id), JSON.stringify(rec), true); }
async function deleteRecord(dateStr, id){ try{ await window.storage.delete(recKey(dateStr,id), true); }catch(e){} }
async function listRecordsForDate(dateStr){
  const list = await window.storage.list(`record:${dateStr}:`, true);
  if(!list || !list.keys || list.keys.length===0) return [];
  const out = await Promise.all(list.keys.map(async k=>{
    try{ const r=await window.storage.get(k, true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
  }));
  return out.filter(Boolean);
}
async function listRecordsForMonth(monthStr){
  const list = await window.storage.list(`record:${monthStr}`, true);
  if(!list || !list.keys || list.keys.length===0) return [];
  const out = await Promise.all(list.keys.map(async k=>{
    try{ const r=await window.storage.get(k, true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
  }));
  return out.filter(Boolean);
}
async function listAllProductionRecords(){
  const list=await window.storage.list('record:',true);
  if(!list||!list.keys||!list.keys.length)return [];
  const out=await Promise.all(list.keys.map(async key=>{
    try{const r=await window.storage.get(key,true);return r&&r.value?JSON.parse(r.value):null;}catch(e){return null;}
  }));
  return out.filter(Boolean);
}

// ================= STORAGE: PEDIDOS =================
function pedidoKey(id){ return `pedido:${id}`; }
async function savePedido(p){ await window.storage.set(pedidoKey(p.id), JSON.stringify(p), true); }
async function deletePedido(id){ try{ await window.storage.delete(pedidoKey(id), true); }catch(e){} }
async function loadPedidos(){
  const list = await window.storage.list('pedido:', true);
  if(!list || !list.keys || list.keys.length===0) return [];
  const out = await Promise.all(list.keys.map(async k=>{
    try{ const r=await window.storage.get(k, true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
  }));
  return out.filter(Boolean).sort((a,b)=> (b.data||'').localeCompare(a.data||''));
}

// ================= STORAGE: ORDENS DE PRODUÇÃO =================
function opKey(numero){ return `ordemProducao:${numero}`; }
async function saveOrdemProducao(op){ await window.storage.set(opKey(op.numero),JSON.stringify(op),true); }
async function loadOrdensProducao(){
  const list=await window.storage.list('ordemProducao:',true);
  if(!list||!list.keys||!list.keys.length) return [];
  const out=await Promise.all(list.keys.map(async key=>{
    try{ const r=await window.storage.get(key,true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
  }));
  return out.filter(Boolean).sort((a,b)=>Number(b.numero)-Number(a.numero));
}
async function loadProximoNumeroOp(){
  try{ const r=await window.storage.get('config:proximoNumeroOp',true); if(r&&r.value) return Number(JSON.parse(r.value))||9536; }catch(e){}
  await window.storage.set('config:proximoNumeroOp',JSON.stringify(9536),true); return 9536;
}
async function saveProximoNumeroOp(n){ proximoNumeroOp=Number(n); await window.storage.set('config:proximoNumeroOp',JSON.stringify(proximoNumeroOp),true); }
async function loadFichaProduto(produto){
  if(!produto) return null;
  try{ const r=await window.storage.get('fichaProduto:'+encodeURIComponent(produto),true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
}
async function saveFichaProduto(produto,op){
  if(!produto) return;
  const ficha={dimensao:op.dimensao,estrutura:op.estrutura,extrusao:op.extrusao,impressao:op.impressao,corte:op.corte};
  await window.storage.set('fichaProduto:'+encodeURIComponent(produto),JSON.stringify(ficha),true);
}

// ================= PEDIDOS FORM =================
function statusOptions(list, selected){
  return list.map(s=>`<option value="${esc(s)}" ${s===selected?'selected':''}>${s||'—'}</option>`).join('');
}
function renderPedidoForm(p){
  p = p || { id:'', numeroOp:'', data: todayStr(), responsavel: responsaveis[0]||'', cliente:'', descricaoItem:'', material:materiais[0]||'PP', quantidade:'', statusCliche:'', statusProducao: statusProducaoList[0]||'', maquinaId:'', prioridade:0 };
  const numeroOp = p.numeroOp!==undefined ? p.numeroOp : (/^PED-/.test(p.id||'') ? '' : p.id||'');
  document.getElementById('pedidoFormGrid').innerHTML = `
    <div class="field"><label>Número da OP (opcional)</label><input id="p_numeroOp" value="${esc(numeroOp)}" placeholder="Pode adicionar depois"></div>
    <div class="field"><label>Data</label><input type="date" id="p_data" value="${toIso(p.data)||todayStr()}"></div>
    <div class="field"><label>Responsável (do pedido)</label><select id="p_responsavel">${responsavelOptions(p.responsavel)}</select></div>
    <div class="field"><label>Cliente / Empresa</label><input id="p_cliente" value="${esc(p.cliente)}" placeholder="Selecione ou pesquise" list="clientesList"><datalist id="clientesList">${dataOptions(clientes)}</datalist></div>
    <div class="field"><label>Descrição do Item</label><input id="p_descricaoItem" value="${esc(p.descricaoItem)}" placeholder="Selecione ou pesquise" list="produtosList"><datalist id="produtosList">${dataOptions(produtos)}</datalist></div>
    <div class="field"><label>Material</label><select id="p_material">${materialOptions(p.material)}</select></div>
    <div class="field"><label>Quantidade</label><input id="p_quantidade" value="${esc(p.quantidade)}" placeholder="ex: 2000 ou 1000KG"></div>
    <div class="field"><label>Status Clichê</label><select id="p_statusCliche">${statusOptions(statusClicheList,p.statusCliche)}</select></div>
    <div class="field"><label>Status Produção</label><select id="p_statusProducao">${statusOptions(statusProducaoList,p.statusProducao)}</select></div>
    <div class="field"><label>Máquina (programação)</label><select id="p_maquinaId"><option value="">— não definida —</option>${machineOptions(p.maquinaId)}</select></div>
  `;
}
function toIso(d){
  if(!d) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(d)){ const [dd,mm,yyyy]=d.split('/'); return `${yyyy}-${mm}-${dd}`; }
  return '';
}
function readPedidoForm(){
  const existing = editingPedidoId ? pedidos.find(x=>x.id===editingPedidoId) : null;
  return {
    id: existing ? existing.id : novoPedidoId(),
    numeroOp: document.getElementById('p_numeroOp').value.trim(),
    data: document.getElementById('p_data').value,
    responsavel: document.getElementById('p_responsavel').value,
    cliente: document.getElementById('p_cliente').value.trim(),
    descricaoItem: document.getElementById('p_descricaoItem').value.trim(),
    material: document.getElementById('p_material').value,
    quantidade: document.getElementById('p_quantidade').value,
    statusCliche: document.getElementById('p_statusCliche').value,
    statusProducao: document.getElementById('p_statusProducao').value,
    maquinaId: document.getElementById('p_maquinaId').value,
    prioridade: existing ? (existing.prioridade||0) : 0
  };
}
async function handlePedidoSubmit(){
  const p = readPedidoForm();
  if(p.numeroOp && pedidos.some(x=>x.id!==p.id && String(x.numeroOp!==undefined?x.numeroOp:x.id).trim()===p.numeroOp)){
    alert(`Já existe um pedido com a OP ${p.numeroOp}.`); return;
  }
  await savePedido(p);
  let cadastroAlterado = false;
  if(p.cliente && !clientes.some(v=>v.toLocaleUpperCase('pt-BR')===p.cliente.toLocaleUpperCase('pt-BR'))){ clientes=uniqueNames([...clientes,p.cliente]); cadastroAlterado=true; }
  if(p.descricaoItem && !produtos.some(v=>v.toLocaleUpperCase('pt-BR')===p.descricaoItem.toLocaleUpperCase('pt-BR'))){ produtos=uniqueNames([...produtos,p.descricaoItem]); cadastroAlterado=true; }
  if(cadastroAlterado){
    await Promise.all([saveSimpleList('config:clientes',clientes),saveSimpleList('config:produtos',produtos)]);
    renderConfig();
  }
  editingPedidoId = null;
  document.getElementById('pedidoCancelBtn').style.display='none';
  document.getElementById('pedidoSubmitBtn').textContent='Adicionar Pedido';
  document.getElementById('pedidoFormTitle').textContent='Novo Pedido (OP)';
  renderPedidoForm();
  pedidos = await loadPedidos();
  renderPedidosTable();
  refreshPedidoDatalist();
  renderPcpOverview();
  renderPcpQueue();
}

function statusColor(s){
  if(s==='FINALIZADO') return 'good';
  if((s||'').startsWith('AGUARDANDO')) return 'warn';
  return 'good';
}

function renderPedidosTable(){
  const search = (document.getElementById('pedidoSearch').value||'').toLowerCase();
  const filterStatus = document.getElementById('pedidoFilterStatus').value;
  let list = pedidos.filter(p=>{
    if(filterStatus && p.statusProducao!==filterStatus) return false;
    if(search){
      const hay = `${p.id} ${p.numeroOp||''} ${p.cliente} ${p.descricaoItem}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });
  document.getElementById('pedidoStatus').textContent = list.length+' de '+pedidos.length+' pedido(s)';

  if(list.length===0){
    document.getElementById('pedidosTableWrap').innerHTML = `<div class="empty">Nenhum pedido encontrado.</div>`;
  } else {
    const rows = list.map(p=>{ const op = p.numeroOp!==undefined ? p.numeroOp : (/^PED-/.test(p.id||'')?'':p.id); return `<tr>
      <td>${op?esc(op):'<span class="opPending">SEM OP</span>'}<small class="pedidoRef">${esc(p.id)}</small></td>
      <td>${p.data?brDate(toIso(p.data)):'#N/D'}</td>
      <td>${esc(p.responsavel)}</td>
      <td>${esc(p.cliente)||'#N/D'}</td>
      <td>${esc(p.descricaoItem)||'#N/D'}</td>
      <td>${esc(p.material)}</td>
      <td>${esc(p.quantidade)||'#N/D'}</td>
      <td>${esc(p.statusCliche)||'—'}</td>
      <td><select class="quickStatus pct ${statusColor(p.statusProducao)}" data-pedstatus="${esc(p.id)}" data-current="${esc(p.statusProducao)}">${statusOptions(statusProducaoList,p.statusProducao)}</select></td>
      <td class="actions">
        <button class="smallbtn" data-pedop="${esc(p.id)}">emitir OP</button>
        <button class="smallbtn" data-pedver="${esc(p.id)}">produção</button>
        <button class="smallbtn" data-pedfinish="${esc(p.id)}">${p.statusProducao==='FINALIZADO'?'reabrir':'finalizar'}</button>
        <button class="smallbtn" data-pededit="${esc(p.id)}">editar</button>
        <button class="smallbtn" data-peddel="${esc(p.id)}">excluir</button>
      </td>
    </tr>`}).join('');
    document.getElementById('pedidosTableWrap').innerHTML = `
      <table class="recTable">
        <thead><tr><th>ID</th><th>Data</th><th>Resp.</th><th>Cliente</th><th>Descrição</th><th>Material</th><th>Qtd</th><th>Clichê</th><th>Produção</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const counts = {};
  pedidos.forEach(p=>{ counts[p.statusProducao] = (counts[p.statusProducao]||0)+1; });
  document.getElementById('pedidoSummary').innerHTML = statusProducaoList.filter(s=>s).map(s=>
    `<div class="kpi"><div class="label">${s}</div><div class="value">${counts[s]||0}</div></div>`
  ).join('');

  document.querySelectorAll('[data-pededit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = pedidos.find(x=>x.id===btn.dataset.pededit);
      if(!p) return;
      editingPedidoId = p.id;
      renderPedidoForm(p);
      document.getElementById('pedidoCancelBtn').style.display='inline-block';
      document.getElementById('pedidoSubmitBtn').textContent='Salvar Alterações';
      document.getElementById('pedidoFormTitle').textContent='Editando Pedido';
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
  document.querySelectorAll('[data-pedop]').forEach(btn=>{
    btn.addEventListener('click', ()=>abrirOpDoPedido(btn.dataset.pedop));
  });
  document.querySelectorAll('[data-pedstatus]').forEach(sel=>{
    sel.addEventListener('change', async ()=>{
      const p = pedidos.find(x=>x.id===sel.dataset.pedstatus);
      if(!p) return;
      const novoStatus = sel.value;
      if(novoStatus==='FINALIZADO' && !confirm('Finalizar este pedido?')){ sel.value=sel.dataset.current; return; }
      p.statusProducao = novoStatus;
      await savePedido(p);
      pedidos = await loadPedidos();
      renderPedidosTable(); renderPcpOverview(); renderPcpQueue();
    });
  });
  document.querySelectorAll('[data-pedfinish]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const p = pedidos.find(x=>x.id===btn.dataset.pedfinish);
      if(!p) return;
      const finalizado = p.statusProducao==='FINALIZADO';
      const novoStatus = finalizado ? (statusProducaoList.find(s=>s && s!=='FINALIZADO')||'AGUARDANDO') : 'FINALIZADO';
      if(!finalizado && !confirm('Finalizar este pedido?')) return;
      p.statusProducao = novoStatus;
      await savePedido(p);
      pedidos = await loadPedidos();
      renderPedidosTable(); renderPcpOverview(); renderPcpQueue();
    });
  });
  document.querySelectorAll('[data-peddel]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Excluir este pedido?')) return;
      await deletePedido(btn.dataset.peddel);
      pedidos = await loadPedidos();
      renderPedidosTable();
      refreshPedidoDatalist();
    });
  });
  document.querySelectorAll('[data-pedver]').forEach(btn=>{
    btn.addEventListener('click', ()=>verProducaoDoPedido(btn.dataset.pedver));
  });
}

async function verProducaoDoPedido(id){
  const box = document.getElementById('pedidoDetalhe');
  const pedidoAtual = pedidos.find(p=>p.id===id);
  const tituloPedido = pedidoDisplay(pedidoAtual)||id;
  box.innerHTML = `<div class="section"><div class="section-head"><h2>Lançamentos de produção — Pedido ${esc(tituloPedido)}</h2></div><div class="empty">buscando…</div></div>`;
  const list = await window.storage.list('record:', true);
  let matches=[];
  if(list && list.keys && list.keys.length>0){
    const all = await Promise.all(list.keys.map(async k=>{
      try{ const r=await window.storage.get(k, true); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
    }));
    matches = all.filter(r=>r && r.idPedido===id);
  }
  if(matches.length===0){
    box.innerHTML = `<div class="section"><div class="section-head"><h2>Lançamentos de produção — Pedido ${esc(tituloPedido)}</h2></div><div class="empty">Nenhum lançamento de produção encontrado para este pedido ainda.</div></div>`;
    return;
  }
  const totalProd = matches.reduce((s,r)=>s+parseNum(r.qtdProduzido),0);

  let bodyHtml='';
  SETORES.forEach(setor=>{
    const setorMatches = matches.filter(r=>machineSetor(r.maquinaId)===setor);
    if(setorMatches.length===0) return;
    setorMatches.sort((a,b)=>(a.dataProducao||'').localeCompare(b.dataProducao||''));
    const setorTotal = setorMatches.reduce((s,r)=>s+parseNum(r.qtdProduzido),0);
    const setorApara = setorMatches.reduce((s,r)=>s+parseNum(r.aparas),0);
    const rows = setorMatches.map(r=>{
      const pct = parseNum(r.qtdProduzido)>0 ? (parseNum(r.aparas)/parseNum(r.qtdProduzido)*100) : 0;
      return `<tr><td>${brDate(r.dataProducao)}</td><td>${esc(machineName(r.maquinaId))}</td><td>${esc(r.turno)}</td><td>${fmt(parseNum(r.qtdProduzido))}</td><td>${fmt(parseNum(r.aparas))}</td><td class="pct ${pctClass(pct)}">${fmtPct(pct)}</td></tr>`;
    }).join('');
    bodyHtml += `
      <div class="section-head" style="background:none;border:none;padding:12px 12px 4px;">
        <h2 style="font-size:12px;color:var(--text-dim);">${setor}</h2>
        <span class="totalTag" style="font-size:12px;">${fmt(setorTotal)} <span style="color:var(--text-dim);">(apara ${fmt(setorApara)})</span></span>
      </div>
      <table><thead><tr><th>Data</th><th>Máquina</th><th>Turno</th><th>Produzido</th><th>Aparas</th><th>%</th></tr></thead>
      <tbody>${rows}
        <tr class="totalrow"><td colspan="3">Total ${setor}</td><td>${fmt(setorTotal)}</td><td>${fmt(setorApara)}</td><td></td></tr>
      </tbody></table>`;
  });

  box.innerHTML = `<div class="section">
    <div class="section-head"><h2>Lançamentos de produção — Pedido ${esc(tituloPedido)}</h2><span class="totalTag">${fmt(totalProd)}</span></div>
    ${bodyHtml}
  </div>`;
}

function refreshPedidoDatalist(){
  let dl = document.getElementById('pedidoIdsList');
  if(!dl){
    dl = document.createElement('datalist');
    dl.id='pedidoIdsList';
    document.body.appendChild(dl);
  }
  dl.innerHTML = pedidos.map(p=>{
    const op = p.numeroOp!==undefined ? p.numeroOp : (/^PED-/.test(p.id||'')?'':p.id);
    return `<option value="${esc(op||p.id)}" label="${esc(op?'Pedido '+p.id:'Sem OP · '+p.id)}">`;
  }).join('');
}

function pedidoDisplay(p){
  if(!p) return '';
  const op = p.numeroOp!==undefined ? p.numeroOp : (/^PED-/.test(p.id||'')?'':p.id);
  return op || 'SEM OP';
}

// ================= PROGRAMAÇÃO (PCP) =================
function renderPcpOverview(){
  const html = machines.map(m=>{
    const count = pedidos.filter(p=>p.maquinaId===m.id && p.statusProducao!=='FINALIZADO').length;
    return `<div class="kpi"><div class="label">${esc(m.name)}</div><div class="value">${count}</div><div class="sub">${m.setor}</div></div>`;
  }).join('');
  document.getElementById('pcpOverview').innerHTML = html;
}

function pcpQueueFor(machineId){
  return pedidos
    .filter(p=>p.maquinaId===machineId && p.statusProducao!=='FINALIZADO')
    .sort((a,b)=>(a.prioridade||0)-(b.prioridade||0));
}

async function renderPcpQueue(){
  const machineId = document.getElementById('pcpMachineSelect').value;
  const queue = pcpQueueFor(machineId);
  const registros = await listAllProductionRecords();
  const produzidoNaMaquina = p=>registros.filter(r=>r.maquinaId===machineId && (r.idPedido===p.id || String(r.idPedido||'')===String(p.numeroOp||''))).reduce((total,r)=>total+parseNum(r.qtdProduzido),0);
  document.getElementById('pcpStatus').textContent = queue.length+' pedido(s) na fila';

  if(queue.length===0){
    document.getElementById('pcpQueueWrap').innerHTML = `<div class="empty">Nenhum pedido programado para esta máquina ainda.</div>`;
  } else {
    const rows = queue.map((p,idx)=>`<tr>
      <td style="text-align:center;">${idx+1}º</td>
      <td>${esc(pedidoDisplay(p))}<small class="pedidoRef">${esc(p.id)}</small></td>
      <td>${esc(p.cliente)||'#N/D'}</td>
      <td>${esc(p.descricaoItem)||'#N/D'}</td>
      <td>${esc(p.quantidade)||'#N/D'}</td>
      <td class="pct ${produzidoNaMaquina(p)>0?'good':''}">${fmt(produzidoNaMaquina(p))}</td>
      <td class="pct ${statusColor(p.statusProducao)}">${esc(p.statusProducao)}</td>
      <td class="actions">
        <button class="smallbtn" data-pcpup="${esc(p.id)}" ${idx===0?'disabled':''}>▲</button>
        <button class="smallbtn" data-pcpdown="${esc(p.id)}" ${idx===queue.length-1?'disabled':''}>▼</button>
        <button class="smallbtn" data-pcpout="${esc(p.id)}">tirar da fila</button>
      </td>
    </tr>`).join('');
    document.getElementById('pcpQueueWrap').innerHTML = `
      <table class="recTable">
        <thead><tr><th>Ordem</th><th>ID</th><th>Cliente</th><th>Descrição</th><th>Qtd</th><th>Qtd. Produzida</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const unassigned = pedidos.filter(p=>!p.maquinaId && p.statusProducao!=='FINALIZADO');
  if(unassigned.length===0){
    document.getElementById('pcpUnassignedWrap').innerHTML = `<div class="empty">Nenhum pedido aguardando programação.</div>`;
  } else {
    const rows2 = unassigned.map(p=>`<tr>
      <td>${esc(pedidoDisplay(p))}<small class="pedidoRef">${esc(p.id)}</small></td>
      <td>${esc(p.cliente)||'#N/D'}</td>
      <td>${esc(p.descricaoItem)||'#N/D'}</td>
      <td>${esc(p.quantidade)||'#N/D'}</td>
      <td class="pct ${statusColor(p.statusProducao)}">${esc(p.statusProducao)}</td>
      <td class="actions"><button class="smallbtn" data-pcpadd="${esc(p.id)}">adicionar à fila</button></td>
    </tr>`).join('');
    document.getElementById('pcpUnassignedWrap').innerHTML = `
      <table class="recTable">
        <thead><tr><th>ID</th><th>Cliente</th><th>Descrição</th><th>Qtd</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows2}</tbody>
      </table>`;
  }

  document.querySelectorAll('[data-pcpup]').forEach(b=>b.addEventListener('click', ()=>pcpMove(b.dataset.pcpup,-1)));
  document.querySelectorAll('[data-pcpdown]').forEach(b=>b.addEventListener('click', ()=>pcpMove(b.dataset.pcpdown,1)));
  document.querySelectorAll('[data-pcpout]').forEach(b=>b.addEventListener('click', ()=>pcpUnassign(b.dataset.pcpout)));
  document.querySelectorAll('[data-pcpadd]').forEach(b=>b.addEventListener('click', ()=>pcpAssign(b.dataset.pcpadd)));
}

async function imprimirFilaPcp(){
  const machineId=document.getElementById('pcpMachineSelect').value;
  const machine=machines.find(m=>m.id===machineId);
  const queue=pcpQueueFor(machineId);
  if(!machineId||!machine){alert('Selecione uma máquina.');return;}
  if(!queue.length){alert('Não há pedidos na fila desta máquina.');return;}
  const registros=await listAllProductionRecords();
  const produzido=p=>registros.filter(r=>r.maquinaId===machineId&&(r.idPedido===p.id||String(r.idPedido||'')===String(p.numeroOp||''))).reduce((t,r)=>t+parseNum(r.qtdProduzido),0);
  const rows=queue.map((p,idx)=>`<tr><td>${idx+1}º</td><td>${esc(pedidoDisplay(p))}</td><td>${esc(p.cliente||'')}</td><td>${esc(p.descricaoItem||'')}</td><td>${esc(p.quantidade||'')}</td><td>${fmt(produzido(p))}</td><td>${esc(p.statusProducao||'')}</td></tr>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Fila PCP - ${esc(machine.name)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#111;margin:0}h1{font-size:20px;color:#092e70;margin:0}header{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #092e70;padding-bottom:8px;margin-bottom:12px}.meta{text-align:right;font-size:12px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#092e70;color:white}th,td{border:1px solid #555;padding:6px;text-align:left}td:first-child,td:nth-child(2),td:nth-child(5),td:nth-child(6){text-align:center}.foot{margin-top:10px;font-size:10px;color:#555}</style></head><body><header><div><h1>PROGRAMAÇÃO DE PRODUÇÃO</h1><b>${esc(machine.name)}</b> · ${esc(machine.setor)}</div><div class="meta">Emitido em ${new Date().toLocaleString('pt-BR')}<br>${queue.length} pedido(s) na fila</div></header><table><thead><tr><th>Ordem</th><th>OP</th><th>Cliente</th><th>Descrição</th><th>Qtd.</th><th>Qtd. Produzida</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">Forpack Guaiúba · Painel de Produção</div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w=window.open('','_blank');if(!w){alert('Permita pop-ups para imprimir a fila.');return;}w.document.open();w.document.write(html);w.document.close();
}

async function pcpMove(pedidoId, dir){
  const machineId = document.getElementById('pcpMachineSelect').value;
  const queue = pcpQueueFor(machineId);
  const idx = queue.findIndex(p=>p.id===pedidoId);
  const swapIdx = idx+dir;
  if(idx<0 || swapIdx<0 || swapIdx>=queue.length) return;
  const a = queue[idx], b = queue[swapIdx];
  const tmp = a.prioridade||0;
  a.prioridade = b.prioridade||0;
  b.prioridade = tmp;
  if(a.prioridade===b.prioridade){ a.prioridade = dir<0 ? b.prioridade-1 : b.prioridade+1; }
  await savePedido(a); await savePedido(b);
  pedidos = await loadPedidos();
  renderPcpQueue(); renderPcpOverview();
}

async function pcpUnassign(pedidoId){
  const p = pedidos.find(x=>x.id===pedidoId);
  if(!p) return;
  p.maquinaId=''; p.prioridade=0;
  await savePedido(p);
  pedidos = await loadPedidos();
  renderPcpQueue(); renderPcpOverview();
}

async function pcpAssign(pedidoId){
  const machineId = document.getElementById('pcpMachineSelect').value;
  if(!machineId){ alert('Selecione uma máquina primeiro.'); return; }
  const p = pedidos.find(x=>x.id===pedidoId);
  if(!p) return;
  const queue = pcpQueueFor(machineId);
  const maxP = queue.reduce((m,x)=>Math.max(m, x.prioridade||0), 0);
  p.maquinaId = machineId;
  p.prioridade = maxP+1;
  await savePedido(p);
  pedidos = await loadPedidos();
  renderPcpQueue(); renderPcpOverview();
}

// ================= EMISSÃO DE OP =================
function opInput(id,label,value='',type='text',extra=''){
  return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function opSelect(id,label,value,options){
  return `<div class="field"><label>${label}</label><select id="${id}">${options.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o||'—')}</option>`).join('')}</select></div>`;
}
function blankOp(pedido){
  const numeroExistente=pedido&&/^\d+$/.test(String(pedido.numeroOp||''))?Number(pedido.numeroOp):proximoNumeroOp;
  return {numero:numeroExistente,data:todayStr(),pedidoId:pedido?pedido.id:'',cliente:pedido?pedido.cliente:'',produto:pedido?pedido.descricaoItem:'',quantidade:pedido?pedido.quantidade:'',dimensao:'',estrutura:'',
    extrusao:{balaoEspess:'',tipoBob:'TUBULAR',dimensoesBob:'',transporte:'NÃO',pigmentacao:'NÃO',tratamento:'EXTERNO',slit:'',gilete:'',formulacao:''},
    impressao:{cliche:'',dimensaoBob:'',lado:'FRENTE',camada:'SIMPLES',camisa:'',quantidade:'',colado:'NÃO',cores:Array.from({length:6},()=>({cor:'',referencia:'',anilox:''}))},
    corte:{maquina:'',dimensao:'',saco:'SIM',tipoBob:'TUBULAR',solda:'FUNDO',sanfona:'S/SANF',tamanho:'',alcaVazada:'NÃO',alcaCamiseta:'NÃO',fechadoTriangular:'NÃO',perfurado:'NÃO',observacoes:''}};
}
function pedidoJaTemOpEmitida(p){
  return ordensProducao.some(op=>op.pedidoId===p.id || (p.numeroOp && String(op.numero)===String(p.numeroOp)));
}
function pedidoOptionsParaOp(selectedId){
  const disponiveis=pedidos.filter(p=>p.id===selectedId || !pedidoJaTemOpEmitida(p));
  return `<option value="">Selecione o pedido sem OP emitida</option>`+disponiveis.map(p=>{
    const op=pedidoDisplay(p), cliente=p.cliente||'SEM CLIENTE', produto=p.descricaoItem||'SEM PRODUTO', qtd=p.quantidade||'SEM QTD';
    return `<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(op+' · '+cliente+' · '+produto+' · Qtd: '+qtd)}</option>`;
  }).join('');
}
function renderOpForm(op){
  op=op||blankOp(); op.extrusao=op.extrusao||{}; op.impressao=op.impressao||{}; op.corte=op.corte||{};
  op.impressao.cores=op.impressao.cores||Array.from({length:6},()=>({cor:'',referencia:'',anilox:''}));
  document.getElementById('opCabecalho').innerHTML=
    opInput('op_numero','Número da OP',op.numero,'number','readonly')+opInput('op_data','Data',toIso(op.data)||todayStr(),'date')+
    `<div class="field"><label>Pedido sem OP emitida</label><select id="op_pedidoId">${pedidoOptionsParaOp(op.pedidoId||'')}</select></div>`+
    opInput('op_cliente','Cliente',op.cliente,'text','list="opClientesList"')+`<datalist id="opClientesList">${dataOptions(clientes)}</datalist>`+
    opInput('op_produto','Produto',op.produto,'text','list="opProdutosList"')+`<datalist id="opProdutosList">${dataOptions(produtos)}</datalist>`+
    opInput('op_quantidade','Quantidade (kg)',op.quantidade)+opInput('op_dimensao','Dimensão (cm)',op.dimensao)+opInput('op_estrutura','Estrutura',op.estrutura);
  const e=op.extrusao;
  document.getElementById('opExtrusao').innerHTML=opInput('op_e_balao','Balão / espessura',e.balaoEspess)+opInput('op_e_tipoBob','Tipo de bobina',e.tipoBob)+opInput('op_e_dimBob','Dimensões da bobina',e.dimensoesBob)+opSelect('op_e_transp','Transparente',e.transporte||'NÃO',['SIM','NÃO'])+opSelect('op_e_pig','Pigmentado',e.pigmentacao||'NÃO',['SIM','NÃO'])+opSelect('op_e_trat','Tratamento',e.tratamento||'EXTERNO',['INTERNO','EXTERNO','AMBOS','SEM TRATAMENTO'])+opInput('op_e_slit','Slit',e.slit)+opInput('op_e_gilete','Gilete',e.gilete)+opInput('op_e_form','Formulação',e.formulacao);
  const i=op.impressao;
  document.getElementById('opImpressao').innerHTML=opInput('op_i_cliche','Clichê',i.cliche)+opInput('op_i_dimBob','Dimensão da bobina',i.dimensaoBob)+opSelect('op_i_lado','Impressão',i.lado||'FRENTE',['FRENTE','FRENTE/VERSO'])+opSelect('op_i_camada','Camada',i.camada||'SIMPLES',['SIMPLES','DUPLA'])+opInput('op_i_camisa','Camisa / formato',i.camisa)+opInput('op_i_qtd','Quantidade',i.quantidade)+opSelect('op_i_colado','Colado',i.colado||'NÃO',['SIM','NÃO']);
  document.getElementById('opCores').innerHTML=`<div class="opColors">${Array.from({length:6},(_,n)=>{const c=i.cores[n]||{};return `<div class="opColorCard"><strong>${n+1}ª COR</strong><input id="op_cor_${n}" value="${esc(c.cor)}" placeholder="Cor"><input id="op_ref_${n}" value="${esc(c.referencia)}" placeholder="Referência"><input id="op_anilox_${n}" value="${esc(c.anilox)}" placeholder="Linhas / BCM"></div>`}).join('')}</div>`;
  const c=op.corte;
  document.getElementById('opCorte').innerHTML=opInput('op_c_maquina','Máquina',c.maquina)+opInput('op_c_dimensao','Dimensão',c.dimensao)+opSelect('op_c_saco','Saco',c.saco||'SIM',['SIM','NÃO'])+opSelect('op_c_tipoBob','Tipo de bobina',c.tipoBob||'TUBULAR',['F. TÉCNICO','TUBULAR','ENFESTADA'])+opSelect('op_c_solda','Tipo de solda',c.solda||'FUNDO',['LATERAL','FUNDO','BEIRA LATERAL'])+opSelect('op_c_sanfona','Tipo de sanfona',c.sanfona||'S/SANF',['S/SANF','LATERAL','FUNDO'])+opInput('op_c_tamanho','Tamanho (cm)',c.tamanho)+opSelect('op_c_alcaV','Alça vazada',c.alcaVazada||'NÃO',['SIM','NÃO'])+opSelect('op_c_alcaC','Alça camiseta',c.alcaCamiseta||'NÃO',['SIM','NÃO'])+opSelect('op_c_fechado','Fechado triangular',c.fechadoTriangular||'NÃO',['SIM','NÃO'])+opSelect('op_c_perfurado','Perfurado',c.perfurado||'NÃO',['SIM','NÃO'])+opInput('op_c_obs','Observações',c.observacoes);
  document.getElementById('op_pedidoId').addEventListener('change',e=>{const p=pedidos.find(x=>x.id===e.target.value);if(p)renderOpForm({...blankOp(p),numero:op.numero,data:document.getElementById('op_data').value});});
  document.getElementById('op_produto').addEventListener('change',async e=>{
    const ficha=await loadFichaProduto(e.target.value.trim()); if(!ficha)return;
    if(confirm('Carregar a ficha técnica já salva para este produto?')) renderOpForm({...readOpForm(),...ficha,produto:e.target.value.trim()});
  });
}
function opVal(id){const el=document.getElementById(id);return el?el.value.trim():'';}
function readOpForm(){
  return {numero:Number(opVal('op_numero')),data:opVal('op_data'),pedidoId:opVal('op_pedidoId'),cliente:opVal('op_cliente'),produto:opVal('op_produto'),quantidade:opVal('op_quantidade'),dimensao:opVal('op_dimensao'),estrutura:opVal('op_estrutura'),
    extrusao:{balaoEspess:opVal('op_e_balao'),tipoBob:opVal('op_e_tipoBob'),dimensoesBob:opVal('op_e_dimBob'),transporte:opVal('op_e_transp'),pigmentacao:opVal('op_e_pig'),tratamento:opVal('op_e_trat'),slit:opVal('op_e_slit'),gilete:opVal('op_e_gilete'),formulacao:opVal('op_e_form')},
    impressao:{cliche:opVal('op_i_cliche'),dimensaoBob:opVal('op_i_dimBob'),lado:opVal('op_i_lado'),camada:opVal('op_i_camada'),camisa:opVal('op_i_camisa'),quantidade:opVal('op_i_qtd'),colado:opVal('op_i_colado'),cores:Array.from({length:6},(_,n)=>({cor:opVal('op_cor_'+n),referencia:opVal('op_ref_'+n),anilox:opVal('op_anilox_'+n)}))},
    corte:{maquina:opVal('op_c_maquina'),dimensao:opVal('op_c_dimensao'),saco:opVal('op_c_saco'),tipoBob:opVal('op_c_tipoBob'),solda:opVal('op_c_solda'),sanfona:opVal('op_c_sanfona'),tamanho:opVal('op_c_tamanho'),alcaVazada:opVal('op_c_alcaV'),alcaCamiseta:opVal('op_c_alcaC'),fechadoTriangular:opVal('op_c_fechado'),perfurado:opVal('op_c_perfurado'),observacoes:opVal('op_c_obs')},updatedAt:new Date().toISOString()};
}
function abrirOpDoPedido(pedidoId){
  const p=pedidos.find(x=>x.id===pedidoId); if(!p)return;
  document.querySelector('[data-tab="ordens"]').click(); editingOpNumber=null; renderOpForm(blankOp(p)); window.scrollTo({top:0,behavior:'smooth'});
}
async function salvarOp(){
  const op=readOpForm();
  if(!op.numero||!op.cliente||!op.produto){alert('Informe número, cliente e produto.');return;}
  if(!editingOpNumber&&ordensProducao.some(x=>Number(x.numero)===op.numero)){alert('Já existe uma OP com este número. Ajuste a sequência em Configurações.');return;}
  await saveOrdemProducao(op); await saveFichaProduto(op.produto,op);
  const p=pedidos.find(x=>x.id===op.pedidoId); if(p){p.numeroOp=String(op.numero);await savePedido(p);pedidos=await loadPedidos();}
  if(!editingOpNumber&&op.numero>=proximoNumeroOp)await saveProximoNumeroOp(op.numero+1);
  editingOpNumber=op.numero; ordensProducao=await loadOrdensProducao(); renderOpsTable(); renderPedidosTable(); refreshPedidoDatalist();
  document.getElementById('nextOpNumber').value=proximoNumeroOp; document.getElementById('opSaveStatus').textContent='OP '+op.numero+' salva com sucesso';
}
function renderOpsTable(){
  document.getElementById('opListStatus').textContent=ordensProducao.length+' OP(s)';
  if(!ordensProducao.length){document.getElementById('opsTableWrap').innerHTML='<div class="empty">Nenhuma OP emitida.</div>';return;}
  document.getElementById('opsTableWrap').innerHTML=`<table class="recTable"><thead><tr><th>OP</th><th>Data</th><th>Cliente</th><th>Produto</th><th>Qtd.</th><th></th></tr></thead><tbody>${ordensProducao.map(op=>`<tr><td>${esc(op.numero)}</td><td>${brDate(op.data)}</td><td>${esc(op.cliente)}</td><td>${esc(op.produto)}</td><td>${esc(op.quantidade)}</td><td class="actions"><button class="smallbtn" data-opedit="${op.numero}">editar</button><button class="smallbtn" data-opprint="${op.numero}">imprimir</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-opedit]').forEach(b=>b.addEventListener('click',()=>{const op=ordensProducao.find(x=>String(x.numero)===b.dataset.opedit);if(op){editingOpNumber=op.numero;renderOpForm(op);window.scrollTo({top:0,behavior:'smooth'});}}));
  document.querySelectorAll('[data-opprint]').forEach(b=>b.addEventListener('click',()=>{const op=ordensProducao.find(x=>String(x.numero)===b.dataset.opprint);if(op)imprimirOp(op);}));
}
function opMark(v,label){return `${String(v).toUpperCase()==='SIM'?'☒':'☐'} ${label}`;}
function imprimirOp(op){
  const e=op.extrusao||{},i=op.impressao||{},c=op.corte||{},cores=i.cores||[];
  const cells=(field)=>Array.from({length:6},(_,n)=>`<td>${esc((cores[n]||{})[field]||'')}</td>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>OP ${esc(op.numero)}</title><style>
  @page{size:A4;margin:7mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#050505;font-size:10px}.sheet{width:100%;border:2px solid #111}.head{display:grid;grid-template-columns:170px 1fr 115px;align-items:center;border-bottom:2px solid #111;padding:3px 8px}.brand{font-size:21px;font-weight:900;color:#082d70}.head h1{font-size:21px;text-align:center;color:#082d70;margin:0}.number{text-align:center;font-size:28px;font-weight:900}.number small{display:block;font-size:13px}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #111;padding:3px 5px;height:20px;vertical-align:middle}.lbl{background:#b9b9b9;font-weight:800;text-align:center}.blue{background:#092e70;color:white;font-weight:800}.cyan{background:#48b8df;font-weight:800}.title{font-size:20px;color:#092e70;font-weight:900;text-align:center;padding:8px;border-top:2px solid #111}.center{text-align:center}.big{height:44px}.obs{height:34px}.noBorder{border:0}@media print{button{display:none}}
  </style></head><body><div class="sheet"><div class="head"><div class="brand">Forpack<br><small>Embalagens</small></div><h1>ORDEM DE PRODUÇÃO--GUAIÚBA</h1><div class="number">${esc(op.numero)}<small>${brDate(op.data)}</small></div></div>
  <table><tr><td colspan="5" class="blue"></td><td class="blue center">QUANT. (kg)</td></tr><tr><td class="lbl">CLIENTE</td><td colspan="4">${esc(op.cliente)}</td><td rowspan="2" class="center"><b>${esc(op.quantidade)}</b></td></tr><tr><td class="lbl">PRODUTO</td><td colspan="4">${esc(op.produto)}</td></tr><tr><td class="lbl">DIMENSÃO (cm)</td><td colspan="2">${esc(op.dimensao)}</td><td class="lbl">ESTRUTURA</td><td colspan="2">${esc(op.estrutura)}</td></tr></table>
  <div class="title">EXTRUSÃO</div><table><tr><td class="lbl">BALÃO/ ESPES</td><td>${esc(e.balaoEspess)}</td><td class="lbl">TIPO BOB</td><td>${esc(e.tipoBob)}</td><td class="lbl">DIMENSÕES BOB</td><td>${esc(e.dimensoesBob)}</td></tr><tr><td>${opMark(e.transporte,'TRANSP.')}</td><td>${opMark(e.pigmentacao,'PIG.(CÔR).')}</td><td class="lbl">TRATAMENTO</td><td colspan="3">${esc(e.tratamento)}</td></tr><tr><td class="lbl">SLIT</td><td colspan="2">${esc(e.slit)}</td><td class="lbl">GILETE</td><td colspan="2">${esc(e.gilete)}</td></tr><tr><td class="lbl big">FORMULAÇÃO</td><td colspan="5">${esc(e.formulacao)}</td></tr></table>
  <div class="title">ORDEM DE PRODUÇÃO/IMPRESSÃO</div><table><tr><td class="lbl">CLIENTE</td><td colspan="5">${esc(op.cliente)}</td></tr><tr><td class="lbl">PRODUTO</td><td colspan="5">${esc(op.produto)}</td></tr><tr><td class="lbl">CLICHÊ</td><td colspan="5">${esc(i.cliche)}</td></tr><tr><td class="lbl">DIMENSÃO BOB.</td><td>${esc(i.dimensaoBob)}</td><td class="lbl">IMPRESSÃO</td><td>${esc(i.lado)}</td><td class="lbl">CAMADA</td><td>${esc(i.camada)}</td></tr><tr><td class="lbl">CAMISA/FORMATO</td><td>${esc(i.camisa)}</td><td class="lbl">QUANTIDADE</td><td>${esc(i.quantidade)}</td><td class="lbl">COLADO</td><td>${esc(i.colado)}</td></tr><tr><td colspan="6" class="lbl">CONFIGURAÇÃO DAS CORES</td></tr><tr>${Array.from({length:6},(_,n)=>`<th>${n+1}ª COR</th>`).join('')}</tr><tr>${cells('cor')}</tr><tr>${Array.from({length:6},()=>'<th>REFERÊNCIA</th>').join('')}</tr><tr>${cells('referencia')}</tr><tr><td colspan="6" class="cyan center">CONFIGURAÇÃO DE ANILOX</td></tr><tr>${cells('anilox')}</tr></table>
  <div class="title">ORDEM DE PRODUÇÃO/CORTE E SOLDA</div><table><tr><td class="lbl">CLIENTE</td><td colspan="4">${esc(op.cliente)}</td><td rowspan="2" class="center"><b>${esc(op.quantidade)}</b></td></tr><tr><td class="lbl">PRODUTO</td><td colspan="4">${esc(op.produto)}</td></tr><tr><td class="lbl">CLICHÊ</td><td colspan="5">${esc(i.cliche)}</td></tr><tr><td class="lbl">MÁQUINA</td><td>${esc(c.maquina)}</td><td class="lbl">DIMENSÃO</td><td>${esc(c.dimensao)}</td><td class="lbl">SACO</td><td>${esc(c.saco)}</td></tr><tr><td class="lbl">TIPO DE BOB.</td><td colspan="2">${esc(c.tipoBob)}</td><td class="lbl">ALÇA VAZADA</td><td colspan="2">${esc(c.alcaVazada)}</td></tr><tr><td class="lbl">TIPO DE SOLDA</td><td colspan="2">${esc(c.solda)}</td><td class="lbl">ALÇA CAMISETA</td><td colspan="2">${esc(c.alcaCamiseta)}</td></tr><tr><td class="lbl">TIPO DE SANF.</td><td colspan="2">${esc(c.sanfona)}</td><td class="lbl">FECHADO TRIAN.</td><td colspan="2">${esc(c.fechadoTriangular)}</td></tr><tr><td class="lbl">TAMANHO (cm)</td><td colspan="2">${esc(c.tamanho)}</td><td class="lbl">PERFURADO</td><td colspan="2">${esc(c.perfurado)}</td></tr><tr><td colspan="6" class="lbl center">OBSERVAÇÕES</td></tr><tr><td colspan="6" class="obs">${esc(c.observacoes)}</td></tr></table></div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w=window.open('','_blank'); if(!w){alert('Permita pop-ups para visualizar a OP.');return;} w.document.open();w.document.write(html);w.document.close();
}

// ================= FORM =================
function machineOptions(selected){
  return SETORES.map(setor=>{
    const opts = machines.filter(m=>m.setor===setor).map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.name)}</option>`).join('');
    return opts ? `<optgroup label="${setor}">${opts}</optgroup>` : '';
  }).join('');
}
function operadorOptions(selected){
  return operadores.map(o=>`<option value="${esc(o)}" ${o===selected?'selected':''}>${esc(o)}</option>`).join('');
}
function responsavelOptions(selected){
  return responsaveis.map(o=>`<option value="${esc(o)}" ${o===selected?'selected':''}>${esc(o)}</option>`).join('');
}
function turnoOptions(selected){
  return TURNOS.map(t=>`<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');
}
function materialOptions(selected){
  return materiais.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${m}</option>`).join('');
}

function renderForm(rec){
  rec = rec || { id:uuid(), idPedido:'', dataPedido:'', cliente:'', descricaoItem:'', material:'VIRGEM',
    quantidadePedido:'', dataProducao: document.getElementById('listDateInput').value || todayStr(),
    qtdProduzido:'', aparas:'', picote:'', operador: operadores[0]||'', turno:'MANHÃ', maquinaId: machines[0]?machines[0].id:'' };

  document.getElementById('formGrid').innerHTML = `
    <div class="field"><label>Pedido / OP (opcional)</label><input id="f_idPedido" value="${esc(rec.idPedido)}" placeholder="Digite a OP ou selecione o pedido" list="pedidoIdsList"></div>
    <div class="field"><label>Data Pedido (opcional)</label><input type="date" id="f_dataPedido" value="${esc(rec.dataPedido)}"></div>
    <div class="field"><label>Cliente / Empresa (opcional)</label><input id="f_cliente" value="${esc(rec.cliente)}" placeholder="Selecione ou pesquise" list="clientesLancList"><datalist id="clientesLancList">${dataOptions(clientes)}</datalist></div>
    <div class="field"><label>Descrição do Item (opcional)</label><input id="f_descricaoItem" value="${esc(rec.descricaoItem)}" placeholder="Selecione ou pesquise" list="produtosLancList"><datalist id="produtosLancList">${dataOptions(produtos)}</datalist></div>
    <div class="field"><label>Quantidade Pedido (opcional)</label><input id="f_quantidadePedido" value="${esc(rec.quantidadePedido)}" placeholder="0,00"></div>
    <div class="field"><label>Material</label><select id="f_material">${materialOptions(rec.material)}</select></div>
    <div class="field"><label>Setor / Máquina</label><select id="f_maquinaId">${machineOptions(rec.maquinaId)}</select></div>
    <div class="field"><label>Turno</label><select id="f_turno">${turnoOptions(rec.turno)}</select></div>
    <div class="field"><label>Operador</label><select id="f_operador">${operadorOptions(rec.operador)}</select></div>
    <div class="field"><label>Data Produção *</label><input type="date" id="f_dataProducao" value="${esc(rec.dataProducao)}"></div>
    <div class="field"><label>Qtd Produzido *</label><input id="f_qtdProduzido" value="${esc(rec.qtdProduzido)}" placeholder="0,00"></div>
    <div class="field"><label>Aparas</label><input id="f_aparas" value="${esc(rec.aparas)}" placeholder="0,00"></div>
    <div class="field"><label>Picote</label><input id="f_picote" value="${esc(rec.picote)}" placeholder="0,00"></div>
  `;
  document.getElementById('formGrid').dataset.id = rec.id;
  document.getElementById('formGrid').dataset.origDate = rec.dataProducao;

  document.getElementById('f_idPedido').addEventListener('change', e=>{
    const digitado = e.target.value.trim();
    const p = pedidos.find(x=>x.id===digitado || String(x.numeroOp!==undefined?x.numeroOp:x.id).trim()===digitado);
    if(p){
      e.target.value = p.id;
      if(!document.getElementById('f_cliente').value) document.getElementById('f_cliente').value = p.cliente||'';
      if(!document.getElementById('f_descricaoItem').value) document.getElementById('f_descricaoItem').value = p.descricaoItem||'';
      if(p.material) document.getElementById('f_material').value = p.material;
      if(p.data) document.getElementById('f_dataPedido').value = toIso(p.data);
      if(p.quantidade) document.getElementById('f_quantidadePedido').value = p.quantidade;
    }
  });
}

function readForm(){
  const g=document.getElementById('formGrid');
  return {
    id: g.dataset.id,
    idPedido: document.getElementById('f_idPedido').value.trim(),
    dataPedido: document.getElementById('f_dataPedido').value,
    cliente: document.getElementById('f_cliente').value.trim(),
    descricaoItem: document.getElementById('f_descricaoItem').value.trim(),
    material: document.getElementById('f_material').value,
    quantidadePedido: document.getElementById('f_quantidadePedido').value,
    maquinaId: document.getElementById('f_maquinaId').value,
    turno: document.getElementById('f_turno').value,
    operador: document.getElementById('f_operador').value,
    dataProducao: document.getElementById('f_dataProducao').value,
    qtdProduzido: document.getElementById('f_qtdProduzido').value,
    aparas: document.getElementById('f_aparas').value,
    picote: document.getElementById('f_picote').value
  };
}

async function handleSubmit(){
  const rec = readForm();
  if(!rec.dataProducao){ alert('Informe a Data de Produção.'); return; }
  if(rec.qtdProduzido===''){ alert('Informe a Quantidade Produzida.'); return; }
  const g=document.getElementById('formGrid');
  const origDate = g.dataset.origDate;

  if(editingKey && origDate && origDate!==rec.dataProducao){
    await deleteRecord(origDate, rec.id);
  }
  await saveRecord(rec.dataProducao, rec);
  let cadastroAlterado = false;
  if(rec.cliente && !clientes.some(v=>v.toLocaleUpperCase('pt-BR')===rec.cliente.toLocaleUpperCase('pt-BR'))){ clientes=uniqueNames([...clientes,rec.cliente]); cadastroAlterado=true; }
  if(rec.descricaoItem && !produtos.some(v=>v.toLocaleUpperCase('pt-BR')===rec.descricaoItem.toLocaleUpperCase('pt-BR'))){ produtos=uniqueNames([...produtos,rec.descricaoItem]); cadastroAlterado=true; }
  if(cadastroAlterado){
    await Promise.all([saveSimpleList('config:clientes',clientes),saveSimpleList('config:produtos',produtos)]);
    renderConfig();
  }

  editingKey=null;
  document.getElementById('cancelEditBtn').style.display='none';
  document.getElementById('submitBtn').textContent='Adicionar Lançamento';
  document.getElementById('formTitle').textContent='Novo Lançamento';
  renderForm();
  await refreshRecordsList();
}

function machineName(id){ const m=machines.find(x=>x.id===id); return m?m.name:id; }
function machineSetor(id){ const m=machines.find(x=>x.id===id); return m?m.setor:''; }

async function refreshRecordsList(){
  const dateStr = document.getElementById('listDateInput').value;
  document.getElementById('listStatus').textContent='carregando…';
  const recs = await listRecordsForDate(dateStr);
  document.getElementById('listStatus').textContent = recs.length+' lançamento(s)';
  if(recs.length===0){
    document.getElementById('recordsTableWrap').innerHTML = `<div class="empty">Nenhum lançamento para ${brDate(dateStr)} ainda.</div>`;
    return;
  }
  const rows = recs.map(r=>{
    const pct = parseNum(r.qtdProduzido)>0 ? (parseNum(r.aparas)/parseNum(r.qtdProduzido)*100) : 0;
    const pedido = pedidos.find(p=>p.id===r.idPedido);
    return `<tr>
      <td>${esc(pedido?pedidoDisplay(pedido):r.idPedido)||'#N/D'}</td>
      <td>${esc(r.cliente)||'#N/D'}</td>
      <td>${esc(machineName(r.maquinaId))}</td>
      <td>${esc(r.turno)}</td>
      <td>${esc(r.material)}</td>
      <td>${esc(r.operador)}</td>
      <td>${fmt(parseNum(r.qtdProduzido))}</td>
      <td>${fmt(parseNum(r.aparas))}</td>
      <td class="pct ${pctClass(pct)}">${fmtPct(pct)}</td>
      <td class="actions">
        <button class="smallbtn" data-edit="${r.id}" data-date="${dateStr}">editar</button>
        <button class="smallbtn" data-del="${r.id}" data-date="${dateStr}">excluir</button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('recordsTableWrap').innerHTML = `
    <table class="recTable">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Máquina</th><th>Turno</th><th>Material</th><th>Operador</th><th>Produzido</th><th>Aparas</th><th>%</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  document.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const recs2 = await listRecordsForDate(btn.dataset.date);
      const rec = recs2.find(r=>r.id===btn.dataset.edit);
      if(!rec) return;
      editingKey={date:btn.dataset.date,id:rec.id};
      renderForm(rec);
      document.getElementById('cancelEditBtn').style.display='inline-block';
      document.getElementById('submitBtn').textContent='Salvar Alterações';
      document.getElementById('formTitle').textContent='Editando Lançamento';
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
  document.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Excluir este lançamento?')) return;
      await deleteRecord(btn.dataset.date, btn.dataset.del);
      await refreshRecordsList();
    });
  });
}

// ================= RELATÓRIO DIÁRIO =================
async function renderReport(){
  const dateStr = document.getElementById('reportDateInput').value;
  const recs = await listRecordsForDate(dateStr);
  if(recs.length===0){
    document.getElementById('reportContent').innerHTML = `<div class="empty">Nenhum lançamento para ${brDate(dateStr)}.<br>Cadastre lançamentos na aba "Lançamento".</div>`;
    return;
  }

  let html='';
  let corteMachTotal=0, rebobTotal=0;

  SETORES.forEach(setor=>{
    const setorMachines = machines.filter(m=>m.setor===setor);
    const setorRecs = recs.filter(r=>machineSetor(r.maquinaId)===setor);
    if(setorRecs.length===0) return;

    let grand=0;
    const rows = setorMachines.map(m=>{
      const mRecs = setorRecs.filter(r=>r.maquinaId===m.id);
      if(mRecs.length===0) return null;
      const byTurno = {MANHÃ:0,TARDE:0,NOITE:0};
      mRecs.forEach(r=>byTurno[r.turno]+=parseNum(r.qtdProduzido));
      const tot = byTurno.MANHÃ+byTurno.TARDE+byTurno.NOITE;
      grand+=tot;
      return `<tr><td>${esc(m.name)}</td><td>${fmt(byTurno.MANHÃ)}</td><td>${fmt(byTurno.TARDE)}</td><td>${fmt(byTurno.NOITE)}</td><td>${fmt(tot)}</td></tr>`;
    }).filter(Boolean).join('');

    if(setor==='CORTE') corteMachTotal=grand;
    if(setor==='REBOBINADEIRA') rebobTotal=grand;

    html += `<div class="section">
      <div class="section-head"><h2>${setor}</h2><span class="totalTag">${fmt(grand)}</span></div>
      <div class="hazard"></div>
      <table><thead><tr><th>Máquina</th><th>Manhã</th><th>Tarde</th><th>Noite</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  });

  html += `<div class="section"><div class="section-head"><h2>Total Corte + Rebobinadeira</h2><span class="totalTag">${fmt(corteMachTotal+rebobTotal)}</span></div><div class="hazard"></div></div>`;

  const extRecs = recs.filter(r=>machineSetor(r.maquinaId)==='EXTRUSÃO');
  const extByMat = {};
  extRecs.forEach(r=>{
    const k=r.material||'OUTRO';
    if(!extByMat[k]) extByMat[k]={prod:0,apara:0};
    extByMat[k].prod+=parseNum(r.qtdProduzido); extByMat[k].apara+=parseNum(r.aparas);
  });
  const extRows = Object.keys(extByMat).map(k=>{
    const v=extByMat[k]; const pct = v.prod>0?(v.apara/v.prod*100):0;
    return `<tr><td>${k}</td><td>${fmt(v.prod)}</td><td>${fmt(v.apara)}</td><td class="pct ${pctClass(pct)}">${fmtPct(pct)}</td></tr>`;
  }).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);">sem dados</td></tr>`;

  const corteRecs = recs.filter(r=>machineSetor(r.maquinaId)==='CORTE');
  const corteByMat = {};
  corteRecs.forEach(r=>{
    const k=r.material||'OUTRO';
    if(!corteByMat[k]) corteByMat[k]={prod:0,apara:0};
    corteByMat[k].prod+=parseNum(r.qtdProduzido); corteByMat[k].apara+=parseNum(r.aparas);
  });
  let corteRows = Object.keys(corteByMat).map(k=>{
    const v=corteByMat[k]; const pct=v.prod>0?(v.apara/v.prod*100):0;
    return `<tr><td>${k}</td><td>${fmt(v.prod)}</td><td>${fmt(v.apara)}</td><td class="pct ${pctClass(pct)}">${fmtPct(pct)}</td><td>—</td><td>—</td></tr>`;
  }).join('');
  const rebobRecs = recs.filter(r=>machineSetor(r.maquinaId)==='REBOBINADEIRA');
  if(rebobRecs.length>0){
    const prod=rebobRecs.reduce((s,r)=>s+parseNum(r.qtdProduzido),0);
    const apara=rebobRecs.reduce((s,r)=>s+parseNum(r.aparas),0);
    const picote=rebobRecs.reduce((s,r)=>s+parseNum(r.picote),0);
    const pct=prod>0?(apara/prod*100):0;
    const pctP=prod>0?(picote/prod*100):0;
    corteRows += `<tr><td>REBOBINADEIRA</td><td>${fmt(prod)}</td><td>${fmt(apara)}</td><td class="pct ${pctClass(pct)}">${fmtPct(pct)}</td><td>${fmt(picote)}</td><td class="pct ${pctClass(pctP)}">${fmtPct(pctP)}</td></tr>`;
  }
  if(!corteRows) corteRows = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);">sem dados</td></tr>`;

  html += `<div class="grid2">
    <div class="section"><div class="section-head"><h2>Perdas Extrusão</h2></div>
      <table><thead><tr><th>Material</th><th>Produção</th><th>Apara</th><th>%</th></tr></thead><tbody>${extRows}</tbody></table>
    </div>
    <div class="section"><div class="section-head"><h2>Perdas Corte</h2></div>
      <table><thead><tr><th>Material</th><th>Produção</th><th>Apara</th><th>%</th><th>Ap. Picote</th><th>%</th></tr></thead><tbody>${corteRows}</tbody></table>
    </div>
  </div>`;

  document.getElementById('reportContent').innerHTML = html;
  window.__lastReportRecs = recs;
}

function exportCsv(){
  const recs = window.__lastReportRecs || [];
  if(recs.length===0){ alert('Nenhum dado para exportar.'); return; }
  const headers=['ID Pedido','Data Pedido','Cliente','Descrição','Material','Qtd Pedido','Data Produção','Qtd Produzido','Aparas','Picote','Operador','Turno','Máquina','Setor','% Aparas'];
  const lines=[headers.join(';')];
  recs.forEach(r=>{
    const pct = parseNum(r.qtdProduzido)>0 ? (parseNum(r.aparas)/parseNum(r.qtdProduzido)*100) : 0;
    lines.push([r.idPedido||'#N/D', r.dataPedido?brDate(r.dataPedido):'#N/D', r.cliente||'#N/D', r.descricaoItem||'#N/D',
      r.material, r.quantidadePedido||'#N/D', brDate(r.dataProducao), fmt(parseNum(r.qtdProduzido)), fmt(parseNum(r.aparas)),
      fmt(parseNum(r.picote)), r.operador, r.turno, machineName(r.maquinaId), machineSetor(r.maquinaId), fmtPct(pct)
    ].join(';'));
  });
  const blob=new Blob(["\uFEFF"+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`relatorio_${document.getElementById('reportDateInput').value}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ================= PAINEL MENSAL =================
let monthlyFilteredRecords=[];
function monthlyOrderNumber(r){
  const pedido=pedidos.find(p=>p.id===r.idPedido || String(p.numeroOp||'')===String(r.idPedido||''));
  return String(pedido?.numeroOp || r.idPedido || 'SEM OP');
}
function refreshMonthlyFilterOptions(recs){
  const machine=document.getElementById('monthlyMachine'), operator=document.getElementById('monthlyOperator'), op=document.getElementById('monthlyOp');
  const current={machine:machine.value,operator:operator.value,op:op.value};
  const usedMachines=[...new Set(recs.map(r=>r.maquinaId).filter(Boolean))].sort((a,b)=>machineName(a).localeCompare(machineName(b),'pt-BR'));
  const usedOperators=[...new Set(recs.map(r=>r.operador).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const usedOps=[...new Set(recs.map(monthlyOrderNumber).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  machine.innerHTML='<option value="">Todas</option>'+usedMachines.map(id=>`<option value="${esc(id)}">${esc(machineName(id))}</option>`).join('');
  operator.innerHTML='<option value="">Todos</option>'+usedOperators.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  op.innerHTML='<option value="">Todas</option>'+usedOps.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(usedMachines.includes(current.machine))machine.value=current.machine;
  if(usedOperators.includes(current.operator))operator.value=current.operator;
  if(usedOps.includes(current.op))op.value=current.op;
}
async function renderDashboard(){
  const start=document.getElementById('monthlyStartDate').value, end=document.getElementById('monthlyEndDate').value;
  const monthStr = (start||document.getElementById('monthInput').value).slice(0,7);
  document.getElementById('monthStatus').textContent='carregando…';
  let monthKeys=[];
  if(start&&end){let cursor=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');while(cursor<=last){const key=cursor.toISOString().slice(0,7);if(!monthKeys.includes(key))monthKeys.push(key);cursor.setMonth(cursor.getMonth()+1,1);}}
  if(!monthKeys.length)monthKeys=[monthStr];
  let all=[];for(const key of monthKeys)all.push(...await listRecordsForMonth(key));
  const unique=new Map(all.map(r=>[r.id||`${r.dataProducao}-${r.idPedido}-${r.maquinaId}-${r.operador}`,r]));all=[...unique.values()];
  refreshMonthlyFilterOptions(all);
  const machine=document.getElementById('monthlyMachine').value,operator=document.getElementById('monthlyOperator').value,op=document.getElementById('monthlyOp').value;
  const recs=all.filter(r=>(!start||r.dataProducao>=start)&&(!end||r.dataProducao<=end)&&(!machine||r.maquinaId===machine)&&(!operator||r.operador===operator)&&(!op||monthlyOrderNumber(r)===op));
  monthlyFilteredRecords=recs;
  document.getElementById('monthStatus').textContent = recs.length+' lançamento(s) conforme os filtros';
  if(recs.length===0){
    document.getElementById('dashContent').innerHTML = `<div class="empty">Nenhum lançamento encontrado para os filtros aplicados.</div>`;
    return;
  }
  const setoresOrdem=['EXTRUSÃO','IMPRESSÃO','LAMINAÇÃO','REBOBINADEIRA','CORTE'];
  const cards = setoresOrdem.map(setor=>{
    const setorRecs = recs.filter(r=>machineSetor(r.maquinaId)===setor);
    const prod=setorRecs.reduce((s,r)=>s+parseNum(r.qtdProduzido),0),aparas=setorRecs.reduce((s,r)=>s+parseNum(r.aparas),0),refile=setorRecs.reduce((s,r)=>s+parseNum(r.picote),0);
    const pctA=prod>0?aparas/prod*100:0,pctR=prod>0?refile/prod*100:0,totalLoss=aparas+refile,pctTotal=prod>0?totalLoss/prod*100:0;
    const rebob=setor==='REBOBINADEIRA';
    return `<article class="monthly-sector-card ${rebob?'rebob':''}"><header><strong>Produção - ${esc(setor.charAt(0)+setor.slice(1).toLowerCase())}</strong><small>${setorRecs.length} lançamento(s)</small></header><div class="monthly-card-values"><div><small>Produção</small><strong>${fmt(prod)} <i>kg</i></strong><span>Total do setor</span></div><div class="loss"><small>${rebob?'Aparas':'Perdas totais'}</small><strong>${fmt(aparas)} <i>kg</i></strong><span>${fmtPct(pctA)} da produção</span></div>${rebob?`<div class="loss"><small>Refile</small><strong>${fmt(refile)} <i>kg</i></strong><span>${fmtPct(pctR)} refilado</span></div>`:''}</div>${rebob?`<div class="monthly-card-total">Perdas totais: ${fmt(totalLoss)} kg · ${fmtPct(pctTotal)}</div>`:''}</article>`;
  }).join('');
  const rows=recs.slice().sort((a,b)=>`${b.dataProducao} ${b.createdAt||''}`.localeCompare(`${a.dataProducao} ${a.createdAt||''}`)).map(r=>{const perdas=parseNum(r.aparas)+parseNum(r.picote);return `<tr><td>${brDate(r.dataProducao)}</td><td class="op-cell">${esc(monthlyOrderNumber(r))}</td><td>${esc(r.descricaoItem||'#N/D')}</td><td>${esc(machineName(r.maquinaId))}</td><td>${esc(r.operador||'#N/D')}</td><td>${esc(r.turno||'#N/D')}</td><td>${fmt(parseNum(r.qtdProduzido))}</td><td>${fmt(parseNum(r.aparas))}</td><td>${fmt(parseNum(r.picote))}</td><td>${fmt(perdas)}</td></tr>`}).join('');
  document.getElementById('dashContent').innerHTML = `
    <div class="monthly-sector-grid">${cards}</div>
    <div class="section monthly-detail"><div class="section-head"><div><span class="status" style="color:#48b8df;font-weight:700;">DETALHAMENTO</span><h2 style="margin-top:4px;">Apontamentos filtrados</h2></div><span class="status">${recs.length} registro(s)</span></div><table><thead><tr><th>Data</th><th>OP</th><th>Produto</th><th>Máquina</th><th>Operador</th><th>Turno</th><th>Produzido</th><th>Aparas</th><th>Picote / Refile</th><th>Perdas</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}
function exportMonthlyCsv(){
  if(!monthlyFilteredRecords.length){alert('Nenhum dado filtrado para exportar.');return;}
  const lines=[['Data','OP','Produto','Máquina','Setor','Operador','Turno','Produzido','Aparas','Picote / Refile','Perdas'].join(';')];
  monthlyFilteredRecords.forEach(r=>lines.push([brDate(r.dataProducao),monthlyOrderNumber(r),r.descricaoItem||'',machineName(r.maquinaId),machineSetor(r.maquinaId),r.operador||'',r.turno||'',fmt(parseNum(r.qtdProduzido)),fmt(parseNum(r.aparas)),fmt(parseNum(r.picote)),fmt(parseNum(r.aparas)+parseNum(r.picote))].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')));
  const blob=new Blob(["\uFEFF"+lines.join('\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`relatorio_mensal_${document.getElementById('monthlyStartDate').value}_${document.getElementById('monthlyEndDate').value}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

// ================= CONFIGURAÇÕES =================
function renderConfig(){
  const produtoSelecionado=document.getElementById('produtoEditSelect').value;
  document.getElementById('machineList').innerHTML = SETORES.map(setor=>{
    const items = machines.filter(m=>m.setor===setor);
    if(items.length===0) return '';
    return `<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--text-dim);letter-spacing:.5px;">${setor}</span><br>` +
      items.map(m=>`<span class="tagPill">${esc(m.name)}<button data-rmmac="${m.id}">×</button></span>`).join('') + `</div>`;
  }).join('');
  document.getElementById('opList').innerHTML = operadores.map(o=>`<span class="tagPill">${esc(o)}<button data-rmop="${esc(o)}">×</button></span>`).join('');
  document.getElementById('respList').innerHTML = responsaveis.map(o=>`<span class="tagPill">${esc(o)}<button data-rmresp="${esc(o)}">×</button></span>`).join('');
  document.getElementById('clienteList').innerHTML = clientes.length ? clientes.map(o=>`<span class="tagPill">${esc(o)}<button class="editCadastroBtn" data-editcliente="${esc(o)}" title="Editar cliente">EDITAR</button><button data-rmcliente="${esc(o)}" title="Excluir cliente">×</button></span>`).join('') : '<span class="status">Nenhum cliente cadastrado.</span>';
  document.getElementById('produtoList').innerHTML = produtos.length ? produtos.map(o=>`<span class="tagPill">${esc(o)}<button class="editCadastroBtn" data-editproduto="${esc(o)}" title="Editar produto">EDITAR</button><button data-rmproduto="${esc(o)}" title="Excluir produto">×</button></span>`).join('') : '<span class="status">Nenhum produto cadastrado.</span>';
  document.getElementById('produtoEditSelect').innerHTML='<option value="">Selecione um produto para consultar ou editar</option>'+produtos.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('');
  if(produtos.includes(produtoSelecionado))document.getElementById('produtoEditSelect').value=produtoSelecionado;
  document.getElementById('matList').innerHTML = materiais.map(o=>`<span class="tagPill">${esc(o)}<button data-rmmat="${esc(o)}">×</button></span>`).join('');
  document.getElementById('scList').innerHTML = statusClicheList.filter(s=>s).map(o=>`<span class="tagPill">${esc(o)}<button data-rmsc="${esc(o)}">×</button></span>`).join('');
  document.getElementById('spList').innerHTML = statusProducaoList.map(o=>`<span class="tagPill">${esc(o)}<button data-rmsp="${esc(o)}">×</button></span>`).join('');

  document.querySelectorAll('[data-rmresp]').forEach(b=>b.addEventListener('click', async ()=>{
    responsaveis = responsaveis.filter(x=>x!==b.dataset.rmresp);
    await saveSimpleList('config:responsaveis', responsaveis); renderConfig(); renderPedidoForm();
  }));
  document.querySelectorAll('[data-editcliente]').forEach(b=>b.addEventListener('click', async ()=>{
    await editarCadastro('cliente', b.dataset.editcliente);
  }));
  document.querySelectorAll('[data-editproduto]').forEach(b=>b.addEventListener('click', async ()=>{
    await editarCadastro('produto', b.dataset.editproduto);
  }));
  document.querySelectorAll('[data-rmcliente]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Remover este cliente do cadastro? Os pedidos existentes serão mantidos.')) return;
    clientes = clientes.filter(x=>x!==b.dataset.rmcliente);
    await saveSimpleList('config:clientes', clientes); renderConfig(); renderPedidoForm(); renderForm();
  }));
  document.querySelectorAll('[data-rmproduto]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Remover este produto do cadastro? Os pedidos existentes serão mantidos.')) return;
    produtos = produtos.filter(x=>x!==b.dataset.rmproduto);
    await saveSimpleList('config:produtos', produtos); renderConfig(); renderPedidoForm(); renderForm();
  }));
  document.querySelectorAll('[data-rmmat]').forEach(b=>b.addEventListener('click', async ()=>{
    materiais = materiais.filter(x=>x!==b.dataset.rmmat);
    await saveSimpleList('config:materiais', materiais); renderConfig(); renderPedidoForm(); renderForm();
  }));
  document.querySelectorAll('[data-rmsc]').forEach(b=>b.addEventListener('click', async ()=>{
    statusClicheList = statusClicheList.filter(x=>x!==b.dataset.rmsc);
    await saveSimpleList('config:statusCliche', statusClicheList); renderConfig(); renderPedidoForm();
  }));
  document.querySelectorAll('[data-rmsp]').forEach(b=>b.addEventListener('click', async ()=>{
    statusProducaoList = statusProducaoList.filter(x=>x!==b.dataset.rmsp);
    await saveSimpleList('config:statusProducao', statusProducaoList); renderConfig(); renderPedidoForm(); refreshPedidoFilterOptions();
  }));
  document.getElementById('newMacSetor').innerHTML = SETORES.map(s=>`<option value="${s}">${s}</option>`).join('');

  document.querySelectorAll('[data-rmmac]').forEach(b=>b.addEventListener('click', async ()=>{
    machines = machines.filter(m=>m.id!==b.dataset.rmmac);
    await saveMachines(); renderConfig(); renderForm(); renderPedidoForm();
    document.getElementById('pcpMachineSelect').innerHTML = machineOptions('');
    renderPcpOverview(); renderPcpQueue();
  }));
  document.querySelectorAll('[data-rmop]').forEach(b=>b.addEventListener('click', async ()=>{
    operadores = operadores.filter(o=>o!==b.dataset.rmop);
    await saveOperadores(); renderConfig(); renderForm();
  }));
}

async function editarCadastro(tipo, nomeAtual){
  const rotulo = tipo==='cliente' ? 'cliente' : 'produto / descrição';
  const novoNome = prompt(`Editar ${rotulo}:`, nomeAtual);
  if(novoNome===null) return;
  const nome = novoNome.trim();
  if(!nome){ alert('O nome não pode ficar vazio.'); return; }
  if(nome===nomeAtual) return;
  const lista = tipo==='cliente' ? clientes : produtos;
  if(lista.some(v=>v!==nomeAtual && v.toLocaleUpperCase('pt-BR')===nome.toLocaleUpperCase('pt-BR'))){
    alert(`Já existe um ${rotulo} com esse nome.`); return;
  }
  if(!confirm(`Alterar "${nomeAtual}" para "${nome}" também nos pedidos e lançamentos existentes?`)) return;

  for(const p of pedidos){
    const campo = tipo==='cliente' ? 'cliente' : 'descricaoItem';
    if((p[campo]||'').trim()===nomeAtual){ p[campo]=nome; await savePedido(p); }
  }

  const registros = await window.storage.list('record:', true);
  if(registros && registros.keys){
    for(const key of registros.keys){
      try{
        const r=await window.storage.get(key, true);
        if(!r||!r.value) continue;
        const rec=JSON.parse(r.value);
        const campo = tipo==='cliente' ? 'cliente' : 'descricaoItem';
        if((rec[campo]||'').trim()===nomeAtual){ rec[campo]=nome; await window.storage.set(key,JSON.stringify(rec),true); }
      }catch(e){ console.error('Não foi possível atualizar',key,e); }
    }
  }

  if(tipo==='cliente'){
    clientes=uniqueNames(clientes.map(v=>v===nomeAtual?nome:v));
    await saveSimpleList('config:clientes',clientes);
  }else{
    produtos=uniqueNames(produtos.map(v=>v===nomeAtual?nome:v));
    await saveSimpleList('config:produtos',produtos);
  }
  pedidos=await loadPedidos();
  renderConfig(); renderPedidoForm(); renderForm(); renderPedidosTable();
  await refreshRecordsList();
}

document.getElementById('addMacBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newMacName').value.trim();
  const setor=document.getElementById('newMacSetor').value;
  if(!name) return;
  machines.push({id:uuid(), name, setor});
  await saveMachines();
  document.getElementById('newMacName').value='';
  renderConfig(); renderForm(); renderPedidoForm();
  document.getElementById('pcpMachineSelect').innerHTML = machineOptions('');
  renderPcpOverview(); renderPcpQueue();
});
document.getElementById('addOpBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newOpName').value.trim();
  if(!name) return;
  operadores.push(name);
  await saveOperadores();
  document.getElementById('newOpName').value='';
  renderConfig(); renderForm();
});
function refreshPedidoFilterOptions(){
  const sel=document.getElementById('pedidoFilterStatus');
  const cur=sel.value;
  sel.innerHTML = '<option value="">Todos os status</option>' + statusProducaoList.map(s=>`<option value="${s}">${s}</option>`).join('');
  sel.value = cur;
}
document.getElementById('addRespBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newRespName').value.trim();
  if(!name) return;
  responsaveis.push(name);
  await saveSimpleList('config:responsaveis', responsaveis);
  document.getElementById('newRespName').value='';
  renderConfig(); renderPedidoForm();
});
document.getElementById('addClienteBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newClienteName').value.trim();
  if(!name) return;
  if(clientes.some(v=>v.toLocaleUpperCase('pt-BR')===name.toLocaleUpperCase('pt-BR'))){ alert('Este cliente já está cadastrado.'); return; }
  clientes=uniqueNames([...clientes,name]);
  await saveSimpleList('config:clientes', clientes);
  document.getElementById('newClienteName').value='';
  renderConfig(); renderPedidoForm(); renderForm();
});
document.getElementById('addProdutoBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newProdutoName').value.trim();
  if(!name) return;
  if(produtos.some(v=>v.toLocaleUpperCase('pt-BR')===name.toLocaleUpperCase('pt-BR'))){ alert('Este produto já está cadastrado.'); return; }
  produtos=uniqueNames([...produtos,name]);
  await saveSimpleList('config:produtos', produtos);
  document.getElementById('newProdutoName').value='';
  renderConfig(); renderPedidoForm(); renderForm();
});
document.getElementById('editSelectedProdutoBtn').addEventListener('click',async()=>{
  const produto=document.getElementById('produtoEditSelect').value;
  if(!produto){alert('Selecione um produto na lista.');return;}
  await editarCadastro('produto',produto);
});
document.getElementById('addMatBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newMatName').value.trim().toUpperCase();
  if(!name) return;
  materiais.push(name);
  await saveSimpleList('config:materiais', materiais);
  document.getElementById('newMatName').value='';
  renderConfig(); renderPedidoForm(); renderForm();
});
document.getElementById('addScBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newScName').value.trim().toUpperCase();
  if(!name) return;
  statusClicheList.push(name);
  await saveSimpleList('config:statusCliche', statusClicheList);
  document.getElementById('newScName').value='';
  renderConfig(); renderPedidoForm();
});
document.getElementById('addSpBtn').addEventListener('click', async ()=>{
  const name=document.getElementById('newSpName').value.trim().toUpperCase();
  if(!name) return;
  statusProducaoList.push(name);
  await saveSimpleList('config:statusProducao', statusProducaoList);
  document.getElementById('newSpName').value='';
  renderConfig(); renderPedidoForm(); refreshPedidoFilterOptions();
});

// ================= TABS =================
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['lancamento','pedidos','ordens','programacao','relatorio','painel','config'].forEach(t=>{
      document.getElementById('tab-'+t).style.display = (t===btn.dataset.tab)?'block':'none';
    });
    if(btn.dataset.tab==='relatorio') renderReport();
    if(btn.dataset.tab==='painel') renderDashboard();
    if(btn.dataset.tab==='pedidos') renderPedidosTable();
    if(btn.dataset.tab==='ordens') renderOpsTable();
    if(btn.dataset.tab==='programacao'){ renderPcpOverview(); renderPcpQueue(); }
  });
});

// ================= INIT =================
document.getElementById('submitBtn').addEventListener('click', handleSubmit);
document.getElementById('cancelEditBtn').addEventListener('click', ()=>{
  editingKey=null;
  document.getElementById('cancelEditBtn').style.display='none';
  document.getElementById('submitBtn').textContent='Adicionar Lançamento';
  document.getElementById('formTitle').textContent='Novo Lançamento';
  renderForm();
});
document.getElementById('listDateInput').addEventListener('change', refreshRecordsList);
document.getElementById('reportDateInput').addEventListener('change', renderReport);
document.getElementById('monthInput').addEventListener('change', renderDashboard);
document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
document.getElementById('monthlyApplyBtn').addEventListener('click', renderDashboard);
document.getElementById('monthlyCsvBtn').addEventListener('click', exportMonthlyCsv);
document.getElementById('monthlyPrintBtn').addEventListener('click',()=>{document.body.classList.add('monthly-print-mode');window.print();setTimeout(()=>document.body.classList.remove('monthly-print-mode'),300);});

document.getElementById('pedidoSubmitBtn').addEventListener('click', handlePedidoSubmit);
document.getElementById('pedidoCancelBtn').addEventListener('click', ()=>{
  editingPedidoId=null;
  document.getElementById('pedidoCancelBtn').style.display='none';
  document.getElementById('pedidoSubmitBtn').textContent='Adicionar Pedido';
  document.getElementById('pedidoFormTitle').textContent='Novo Pedido (OP)';
  renderPedidoForm();
});
document.getElementById('pedidoSearch').addEventListener('input', renderPedidosTable);
document.getElementById('pedidoFilterStatus').addEventListener('change', renderPedidosTable);
document.getElementById('pcpPrintBtn').addEventListener('click',imprimirFilaPcp);
document.getElementById('opSaveBtn').addEventListener('click',salvarOp);
document.getElementById('opPrintBtn').addEventListener('click',()=>imprimirOp(readOpForm()));
document.getElementById('opNovaBtn').addEventListener('click',()=>{editingOpNumber=null;renderOpForm(blankOp());document.getElementById('opSaveStatus').textContent='';});
document.getElementById('saveNextOpBtn').addEventListener('click',async()=>{
  const n=Number(document.getElementById('nextOpNumber').value);if(!n||n<1){alert('Informe um número válido.');return;}await saveProximoNumeroOp(n);if(!editingOpNumber)renderOpForm(blankOp());alert('Próximo número de OP atualizado para '+n+'.');
});

(async function init(){
  machines = await loadMachines();
  operadores = await loadOperadores();
  responsaveis = await loadSimpleList('config:responsaveis', DEFAULT_RESPONSAVEIS);
  materiais = await loadSimpleList('config:materiais', DEFAULT_MATERIAIS);
  statusClicheList = await loadSimpleList('config:statusCliche', DEFAULT_STATUS_CLICHE);
  statusProducaoList = await loadSimpleList('config:statusProducao', DEFAULT_STATUS_PRODUCAO);
  pedidos = await loadPedidos();
  proximoNumeroOp = await loadProximoNumeroOp();
  ordensProducao = await loadOrdensProducao();
  clientes = uniqueNames(await loadSimpleList('config:clientes', []));
  produtos = uniqueNames(await loadSimpleList('config:produtos', []));
  const clientesHistoricos = uniqueNames(pedidos.map(p=>p.cliente));
  const produtosHistoricos = uniqueNames(pedidos.map(p=>p.descricaoItem));
  const clientesMesclados = uniqueNames([...clientes,...clientesHistoricos]);
  const produtosMesclados = uniqueNames([...produtos,...produtosHistoricos]);
  if(clientesMesclados.length!==clientes.length){ clientes=clientesMesclados; await saveSimpleList('config:clientes',clientes); }
  if(produtosMesclados.length!==produtos.length){ produtos=produtosMesclados; await saveSimpleList('config:produtos',produtos); }
  document.getElementById('listDateInput').value = todayStr();
  document.getElementById('reportDateInput').value = todayStr();
  document.getElementById('monthInput').value = todayStr().slice(0,7);
  document.getElementById('monthlyStartDate').value = todayStr().slice(0,8)+'01';
  document.getElementById('monthlyEndDate').value = todayStr();
  document.getElementById('nextOpNumber').value = proximoNumeroOp;
  document.getElementById('pedidoFilterStatus').innerHTML = '<option value="">Todos os status</option>' + statusProducaoList.map(s=>`<option value="${s}">${s}</option>`).join('');
  document.getElementById('pcpMachineSelect').innerHTML = machineOptions('');
  document.getElementById('pcpMachineSelect').addEventListener('change', renderPcpQueue);
  renderForm();
  renderConfig();
  renderPedidoForm();
  renderPedidosTable();
  renderOpForm(blankOp());
  renderOpsTable();
  renderPcpOverview();
  renderPcpQueue();
  refreshPedidoDatalist();
  await refreshRecordsList();
  document.getElementById('clock').textContent = 'CONTROLE DE LANÇAMENTOS · '+new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toUpperCase();
})();
