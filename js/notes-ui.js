let toolsOpen=false;
let nearbyNotesToken=0;
let annotatePointMode=false;

function initToolsButton() {
  let button=$('toolsButton');
  if(!button){
    button=document.createElement('button');
    button.type='button';button.id='toolsButton';button.className='tools-button';button.setAttribute('aria-pressed','false');
    button.innerHTML=`${iconSvg('settings')}Ferramentas`;
    document.querySelector('.header-actions').insertBefore(button,$('toggleMap'));
  }
  if(button.dataset.ready)return;
  button.dataset.ready='true';
  button.addEventListener('click',toggleTools);
}

function toggleTools() {
  if(toolsOpen){closeTools();return;}
  cancelMapInteraction('tools');toolsOpen=true;
  renderToolsMenu();renderDesktopShell();
}

function closeTools(renderNow=true) {
  toolsOpen=false;$('toolsButton').setAttribute('aria-pressed','false');$('toolsPanel').hidden=true;
  if(renderNow)renderDesktopShell();
}

function renderToolsMenu() {
  const panel=$('toolsPanel');panel.hidden=false;
  panel.innerHTML=`<div class="inspector-heading"><div><small>ROUTEPILOT V2</small><h2>Ferramentas</h2></div><button data-action="closeTools" aria-label="Fechar ferramentas">&times;</button></div>
    <div class="tool-list"><button data-action="annotatePoint">${iconSvg('pin')}<span><b>Anotar ponto</b><small>Clique no mapa e salve a informação como pendente</small></span></button><button data-action="activateIdentify">${iconSvg('pin')}<span><b>Identificar ponto</b><small>Clique no mapa ou pesquise coordenadas</small></span></button><button data-action="reviewNotes">${iconSvg('check')}<span><b>Validar anotações</b><small>Revisar conhecimento operacional pendente</small></span></button><button data-action="reviewData">${iconSvg('list')}<span><b>Revisar dados</b><small>Erros, avisos e informações da base</small></span></button></div>
    <p class="local-storage-note">Anotações armazenadas neste computador.</p>`;
}

function startAnnotatePoint() {
  if(annotatePointMode){cancelAnnotatePoint(false);setIdentifyPointMode(false);return;}
  if(comparisonActive())goBack();
  cancelMapInteraction('identify');closeTools(false);
  if(!state.city&&!state.region&&!state.overview)generalMap();
  annotatePointMode=true;
  setIdentifyPointMode(true);
  $('identifyPointHint').firstChild.textContent='Clique no ponto que deseja anotar ';
  renderDesktopShell();
}

function cancelAnnotatePoint(renderNow=true) {
  annotatePointMode=false;
  $('identifyPointHint').firstChild.textContent='Selecione um ponto no mapa ';
  if(renderNow)renderDesktopShell();
}

function noteStatusLabel(status) {
  return status==='validated'?'Informação operacional validada':status==='rejected'?'Informação rejeitada':'Informação ainda não validada';
}

function noteTypeLabel(type) {
  return {general:'Geral',reference:'Referência',access:'Acesso',warning:'Alerta'}[type]||'Geral';
}

function addNoteSection(lat,lng,showButton=true) {
  return `<div class="add-note-area">${showButton?'<button type="button" data-action="showAddNote" class="add-note-button">+ Adicionar anotação</button>':''}<div id="addNoteFormHost"></div><div id="nearbyOperationalNotes" class="nearby-notes"></div><p class="local-storage-note">Anotações armazenadas neste computador.</p></div>`;
}

function showAddNoteForm() {
  const context=identifiedArea||areaUnderstandingContext||currentAreaContext();
  if(!context)return;
  const host=$('addNoteFormHost');if(!host)return;
  host.innerHTML=`<form id="operationalNoteForm" class="note-form"><label for="noteType">Tipo</label><select id="noteType" name="type"><option value="general">Geral</option><option value="reference">Referência</option><option value="access">Acesso</option><option value="warning">Alerta</option></select><label for="noteText">Informação sobre este local</label><textarea id="noteText" name="text" maxlength="500" required placeholder="Ex.: Entrada pela estrada depois da escola."></textarea><div><button type="submit">Salvar como pendente</button><button type="button" data-action="cancelAddNote">Cancelar</button></div><p>Não inclua nome, telefone, contrato ou outros dados do cliente.</p></form>`;
  $('noteText').focus();
}

function cancelAddNote() { const host=$('addNoteFormHost');if(host)host.innerHTML=''; }

async function saveOperationalNote(form) {
  const context=identifiedArea||areaUnderstandingContext||currentAreaContext();
  if(!context)return;
  const data=new FormData(form),lat=context.lat,lng=context.lng??context.lon;
  try {
    await createNote({latitude:lat,longitude:lng,type:data.get('type'),text:data.get('text')});
    cancelAddNote();showToast('Anotação salva como pendente');renderNearbyOperationalNotes(lat,lng);
  } catch(error) { showToast(error.message||'Não foi possível salvar'); }
}

async function renderNearbyOperationalNotes(lat,lng) {
  const target=$('nearbyOperationalNotes');if(!target)return;
  const token=++nearbyNotesToken;
  try {
    const notes=await getNearbyNotes(lat,lng,500);
    if(token!==nearbyNotesToken||!$('nearbyOperationalNotes'))return;
    const pending=notes.filter(note=>note.status==='pending'),validated=notes.filter(note=>note.status==='validated');
    const group=(title,items,status)=>items.length?`<div class="note-group"><h3>${title}</h3>${items.map(note=>`<article class="note-summary is-${status}"><b>${esc(note.text)}</b><span>${esc(noteTypeLabel(note.type))} · ${distanceLabel(note.distanceKm)}</span><small>${esc(noteStatusLabel(note.status))}</small></article>`).join('')}</div>`:'';
    target.innerHTML=group('INFORMAÇÕES VALIDADAS',validated,'validated')+group('ANOTAÇÕES PENDENTES',pending,'pending')||'<p class="empty">Nenhuma anotação operacional a até 500 m.</p>';
  } catch(error) { target.innerHTML='<p class="empty">Armazenamento local de anotações indisponível.</p>'; }
}

function nearestKnownLocations(note) {
  return points.filter(point=>point.kind!=='referencia').map(point=>({point,km:distanceKm([note.latitude,note.longitude],[point.lat,point.lon])})).sort((a,b)=>a.km-b.km).slice(0,3);
}

async function renderNotesReview() {
  toolsOpen=true;$('toolsButton').setAttribute('aria-pressed','true');renderDesktopShell();
  const panel=$('toolsPanel');panel.hidden=false;
  panel.innerHTML='<div class="inspector-heading"><div><small>CONHECIMENTO OPERACIONAL</small><h2>Validar anotações</h2></div><button data-action="closeTools" aria-label="Fechar">&times;</button></div><p class="local-storage-note">Anotações armazenadas neste computador.</p><div id="pendingNotesList"><p class="empty">Carregando...</p></div>';
  try {
    const pending=await getPendingNotes(),target=$('pendingNotesList');if(!target)return;
    target.innerHTML=pending.length?pending.map(note=>{
      const area=analyzeCoordinates(note.latitude,note.longitude),near=nearestKnownLocations(note);
      const approximate=area.insideCoverage?`${area.region.name} · ${cityName(area.city)}`:'Fora da cobertura cadastrada';
      return `<article class="review-note" data-note-id="${esc(note.id)}"><div class="note-state is-pending">Pendente de validação</div><h3>${esc(note.text)}</h3><p><b>Tipo:</b> ${esc(noteTypeLabel(note.type))}</p><p><b>Coordenadas:</b> ${note.latitude.toFixed(6)}, ${note.longitude.toFixed(6)}</p><p><b>Localização aproximada:</b> ${esc(approximate)}</p><p><b>Localidades conhecidas:</b> ${near.map(item=>`${esc(item.point.name)} (${distanceLabel(item.km)})`).join(' · ')}</p><div class="review-links"><button data-action="openNoteMap" data-id="${esc(note.id)}" data-lat="${note.latitude}" data-lng="${note.longitude}">Abrir no mapa</button><a href="${googleMapsPointUrl(note.latitude,note.longitude)}" target="_blank" rel="noopener noreferrer">Google Maps</a><button data-action="noteStreetView" data-lat="${note.latitude}" data-lng="${note.longitude}">Street View</button></div><div class="review-actions"><button data-action="validateOperationalNote" data-id="${esc(note.id)}">Validar</button><button data-action="editOperationalNote" data-id="${esc(note.id)}">Editar</button><button data-action="rejectOperationalNote" data-id="${esc(note.id)}">Rejeitar</button></div><div class="note-edit-host"></div></article>`;
    }).join(''):'<p class="empty">Nenhuma anotação pendente.</p>';
  } catch(error) { $('pendingNotesList').innerHTML='<p class="empty">Não foi possível acessar as anotações deste computador.</p>'; }
}

async function openOperationalNote(id,lat,lng) {
  let note=null;
  try { note=(await RoutePilotNotes.getAllNotes()).find(item=>item.id===id)||null; } catch(error) {}
  closeTools(false);
  identifyCoordinates(lat,lng,{source:'note',note});
}

async function validateOperationalNote(id) { try{const note=await validateNote(id);showToast('Informação operacional validada');if(identifiedArea?.note?.id===id){identifiedArea.note=note;renderAreaInspector();renderDesktopShell();}else renderNotesReview();refreshOperationalKnowledge();}catch(error){showToast(error.message);} }
async function rejectOperationalNote(id) { try{const note=await rejectNote(id);showToast('Anotação rejeitada');if(identifiedArea?.note?.id===id){identifiedArea.note=note;renderAreaInspector();renderDesktopShell();}else renderNotesReview();refreshOperationalKnowledge();}catch(error){showToast(error.message);} }

function editOperationalNote(id) {
  const article=document.querySelector(`[data-note-id="${CSS.escape(id)}"]`),host=article?.querySelector('.note-edit-host');if(!host)return;
  const current=article.querySelector('h3').textContent;
  host.innerHTML=`<form class="note-edit-form" data-note-id="${esc(id)}"><textarea name="text" maxlength="500" required>${esc(current)}</textarea><select name="type"><option value="general">Geral</option><option value="reference">Referência</option><option value="access">Acesso</option><option value="warning">Alerta</option></select><button type="submit">Salvar edição</button></form>`;
}

async function saveOperationalNoteEdit(form) {
  const data=new FormData(form);
  try { const note=await updateNote(form.dataset.noteId,{text:data.get('text'),type:data.get('type')});showToast('Anotação atualizada');if(identifiedArea?.note?.id===note.id){identifiedArea.note=note;renderAreaInspector();renderDesktopShell();}else renderNotesReview(); } catch(error) { showToast(error.message); }
}

function refreshOperationalKnowledge() {
  if(identifiedArea)renderNearbyOperationalNotes(identifiedArea.lat,identifiedArea.lng);
  if(areaPanelMode==='understand'&&areaUnderstandingContext)loadValidatedAreaKnowledge(areaUnderstandingContext);
  if(areaPanelMode==='radius'&&radiusSearchContext)calculateAroundArea(radiusSearchKm);
  if(areaPanelMode==='addressRadius'&&addressRadiusContext)applyAddressRadius(addressRadiusMeters);
}
