/* Recurso RoutePilot: diagnóstico dos endereços do OpenStreetMap. */
let addressDebugSelection=null;

/** Guia: Executa uma etapa auxiliar em diagnóstico dos endereços do OpenStreetMap (`addressDebugValue`). */
function addressDebugValue(value){
  const text=String(value??'').trim();
  return text||'Nao informado';
}

/** Guia: Executa uma etapa auxiliar em diagnóstico dos endereços do OpenStreetMap (`addressDebugRows`). */
function addressDebugRows(building){
  const tags=building.tags||{},center=building.center||[];
  return [
    ['OSM ID',building.id],
    ['Latitude',Number(center[0]).toFixed(7)],
    ['Longitude',Number(center[1]).toFixed(7)],
    ['Centroide',`${Number(center[0]).toFixed(7)}, ${Number(center[1]).toFixed(7)}`],
    ['addr:housenumber',tags['addr:housenumber']],
    ['addr:street',tags['addr:street']],
    ['addr:housename',tags['addr:housename']],
    ['building',tags.building],
    ['name',tags.name],
    ['ref',tags.ref]
  ].map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(addressDebugValue(value))}</dd></div>`).join('');
}

/** Guia: Executa uma etapa auxiliar em diagnóstico dos endereços do OpenStreetMap (`ensureAddressDebugPanel`). */
function ensureAddressDebugPanel(){
  let panel=$('addressDebugPanel');
  if(panel)return panel;
  panel=document.createElement('aside');
  panel.id='addressDebugPanel';
  panel.className='address-debug-panel';
  panel.hidden=true;
  panel.setAttribute('aria-label','Diagnostico do edificio OSM');
  document.querySelector('.map-canvas')?.appendChild(panel);
  return panel;
}

/** Guia: Exibe o conteúdo solicitado em diagnóstico dos endereços do OpenStreetMap (`openAddressDebugPanel`). */
function openAddressDebugPanel(building,geojson){
  const panel=ensureAddressDebugPanel(),tags=building.tags||{};
  addressDebugSelection={building,geojson};
  panel.innerHTML=`
    <div class="address-debug-heading"><div><small>DIAGNOSTICO OSM</small><strong>Edificio selecionado</strong></div><button type="button" data-address-debug-action="close" aria-label="Fechar diagnostico">&times;</button></div>
    <dl class="address-debug-data">${addressDebugRows(building)}</dl>
    <details class="address-debug-tags"><summary>Demais tags (${Object.keys(tags).length})</summary><pre>${esc(JSON.stringify(tags,null,2))}</pre></details>
    <details class="address-debug-tags"><summary>GeoJSON</summary><pre>${esc(JSON.stringify(geojson,null,2))}</pre></details>
    <div class="address-debug-actions"><button type="button" data-address-debug-action="coordinates">Copiar coordenadas</button><button type="button" data-address-debug-action="id">Copiar OSM ID</button><button type="button" data-address-debug-action="geojson">Copiar GeoJSON</button></div>`;
  panel.hidden=false;
}

/** Guia: Fecha a interface ou ação ativa em diagnóstico dos endereços do OpenStreetMap (`closeAddressDebugPanel`). */
function closeAddressDebugPanel(){
  const panel=$('addressDebugPanel');
  if(panel)panel.hidden=true;
  addressDebugSelection=null;
}

/** Prepara os dados para compartilhamento em diagnóstico dos endereços do OpenStreetMap (`copyAddressDebugValue`). */
async function copyAddressDebugValue(value,label){
  try{
    await navigator.clipboard.writeText(value);
    if(typeof showToast==='function')showToast(`${label} copiado.`);
  }catch(error){
    window.prompt(`Copie ${label.toLowerCase()}:`,value);
  }
}

/** Guia: Inicia o fluxo do recurso em diagnóstico dos endereços do OpenStreetMap (`initAddressDebug`). */
function initAddressDebug(){
  ensureAddressDebugPanel();
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-address-debug-action]');
    if(!button)return;
    const action=button.dataset.addressDebugAction;
    if(action==='close'){closeAddressDebugPanel();return;}
    if(!addressDebugSelection)return;
    const {building,geojson}=addressDebugSelection;
    if(action==='coordinates')copyAddressDebugValue(building.center.join(', '),'Coordenadas');
    if(action==='id')copyAddressDebugValue(building.id,'OSM ID');
    if(action==='geojson')copyAddressDebugValue(JSON.stringify(geojson),'GeoJSON');
  });
}

/** Guia: Alterna o estado do recurso em diagnóstico dos endereços do OpenStreetMap (`toggleAddressDebugMode`). */
function toggleAddressDebugMode(enabled){
  window.RoutePilotAddressDebug?.setDebug(enabled);
  document.querySelector('.map-canvas')?.classList.toggle('is-address-debug',Boolean(enabled));
  if(!enabled)closeAddressDebugPanel();
}

window.RoutePilotAddressInspector={open:openAddressDebugPanel,close:closeAddressDebugPanel};
