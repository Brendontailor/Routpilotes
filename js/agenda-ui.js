/* Recurso RoutePilot: cadastro de OS, distribuição e agenda diária desktop. */
const RoutePilotAgenda=(()=>{
  const CONFIG=RoutePilotSchedulingConfig,CORE=RoutePilotSchedulingCore;
  const state={tab:'map',date:new Date().toISOString().slice(0,10),technicians:[],orders:[],selected:new Set(),techniciansExpanded:false,confirmedLocation:null,locationCandidate:null,searchResults:[],searchTimer:null,geocodingService:null,searchCanExpand:false,searchWarning:'',generated:null,agenda:null,manager:false,detailId:null,pendingAgenda:null,pendingMove:null,pendingVisitAction:null,pendingSuggestion:null,drag:null,unassignedOpen:true,filters:[],visibleTechnicianIds:new Set(),showUnassigned:true,filterOpen:false,filterQuery:'',filterEditor:false,editFilterId:null,activeFilterId:null};
  const $agenda=id=>document.getElementById(id);
  const makeId=prefix=>crypto.randomUUID?`${prefix}_${crypto.randomUUID()}`:`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const technicianById=id=>state.technicians.find(item=>item.id===id);
  const serviceLabel=id=>CONFIG.SERVICE_TYPES[id]?.label||id;
  const shiftLabel=id=>CONFIG.SHIFTS[id]?.label||id;
  const visitLabel=order=>order.customerName||`OS ${order.number}`;
  const sameDayOrders=()=>state.orders.filter(order=>order.date===state.date&&!order.archived);
  const pendingDayOrders=()=>{const scheduled=new Set((state.agenda?.schedules||[]).flatMap(schedule=>schedule.items.map(item=>item.order.id)));return sameDayOrders().filter(order=>!scheduled.has(order.id));};
  const scheduledVisit=orderId=>{for(const schedule of state.agenda?.schedules||[]){const item=schedule.items.find(entry=>entry.order.id===orderId);if(item)return {schedule,item,key:`${schedule.technician.id}:${schedule.shiftId}`};}return null;};
  const activeTechnicians=()=>state.technicians.filter(item=>item.active).sort((a,b)=>a.displayOrder-b.displayOrder);
  const todayLabel=date=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(`${date}T12:00:00`));

  /** Carrega técnicos, OS e agenda persistidos sem sobrescrever cadastros existentes. */
  async function init(){
    if(!window.matchMedia('(min-width:901px)').matches)return;
    state.technicians=await RoutePilotAgendaStorage.ensureDefaultTechnicians();state.orders=await RoutePilotAgendaStorage.all('workOrders');state.selected=new Set(activeTechnicians().map(item=>item.id));state.agenda=await RoutePilotAgendaStorage.getAgenda(state.date)||null;state.filters=await RoutePilotAgendaStorage.getAgendaFilters();
    const defaultFilter=state.filters.find(filter=>filter.isDefault);state.visibleTechnicianIds=new Set(defaultFilter?.technicianIds||activeTechnicians().map(item=>item.id));state.showUnassigned=defaultFilter?.showUnassigned!==false;state.activeFilterId=defaultFilter?.id||null;
    const operationContext=RoutePilotGeocodingCore.createOperationContext(regions,cityNames,CONFIGURACAO_GEOCODIFICACAO.centroPreferencial);
    state.geocodingService=RoutePilotGeocodingService.create({config:CONFIGURACAO_GEOCODIFICACAO,context:operationContext,localSearch:query=>searchLocalRouteLocations(query,{limit:CONFIGURACAO_GEOCODIFICACAO.maximoSugestoes}),localReverse:coords=>RoutePilotOpenAddresses.reverse(coords),photon:new RoutePilotGeocodingProviders.PhotonProvider(CONFIGURACAO_GEOCODIFICACAO.photon),geoapify:new RoutePilotGeocodingProviders.GeoapifyProvider(CONFIGURACAO_GEOCODIFICACAO.geoapify)});
    bind();renderTabs();
  }
  /** Registra os eventos próprios uma única vez. */
  function bind(){
    document.addEventListener('click',handleClick);document.addEventListener('submit',handleSubmit);document.addEventListener('reset',handleReset);document.addEventListener('input',handleInput);document.addEventListener('change',handleChange);document.addEventListener('dragstart',handleDragStart);document.addEventListener('dragover',handleDragOver);document.addEventListener('drop',handleDrop);document.addEventListener('dragend',handleDragEnd);document.addEventListener('keydown',handleKeydown);
  }
  /** Troca entre mapa, criação de rota e agenda somente no desktop. */
  async function open(tab){
    if(!['map','create','agenda'].includes(tab)||!window.matchMedia('(min-width:901px)').matches)return;
    state.tab=tab;document.body.classList.toggle('operations-active',tab!=='map');$agenda('app').hidden=tab!=='map';$agenda('operationsWorkspace').hidden=tab==='map';$agenda('toggleMap').hidden=tab!=='map';
    if(tab!=='map'){state.agenda=await RoutePilotAgendaStorage.getAgenda(state.date)||null;render();$agenda('operationsWorkspace').scrollTop=0;}
    else{RoutePilotAgendaMap.clear();renderTabs();}
  }
  /** Atualiza os botões de navegação principal. */
  function renderTabs(){document.querySelectorAll('[data-main-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mainTab===state.tab)));}
  /** Monta a área ativa e mantém o mapa operacional disponível. */
  function render({preserveAgendaScroll=false}={}){
    renderTabs();const root=$agenda('operationsContent');if(!root)return;const board=$agenda('operationsContent')?.querySelector('.agenda-board'),scroll=preserveAgendaScroll&&board?{top:board.scrollTop,left:board.scrollLeft}:null;
    root.innerHTML=state.tab==='agenda'?renderAgenda():renderCreateRoute();
    if(state.manager)root.insertAdjacentHTML('beforeend',renderTechnicianManager());
    if(state.detailId)root.insertAdjacentHTML('beforeend',renderOrderDetails(state.detailId));
    if(state.pendingAgenda)root.insertAdjacentHTML('beforeend',renderAgendaPreview());
    if(state.pendingMove)root.insertAdjacentHTML('beforeend',renderMoveConfirmation());
    if(state.pendingVisitAction)root.insertAdjacentHTML('beforeend',renderVisitActionConfirmation());
    if(state.pendingSuggestion)root.insertAdjacentHTML('beforeend',renderTechnicianSuggestion());
    if(state.filterEditor)root.insertAdjacentHTML('beforeend',renderFilterEditor());
    if(state.tab==='create'){RoutePilotAgendaMap.ensureMap();RoutePilotAgendaMap.render(state.generated?.schedules||[]);}
    if(scroll)requestAnimationFrame(()=>{const next=root.querySelector('.agenda-board');if(next){next.scrollTop=scroll.top;next.scrollLeft=scroll.left;}});
  }
  /** Monta os controles de data compartilhados pelas duas áreas. */
  function dateToolbar(title){return `<div class="operations-heading"><div><small>OPERAÇÃO DIÁRIA</small><h2>${title}</h2></div><div class="agenda-date-nav"><button data-agenda-action="datePrevious" aria-label="Dia anterior">‹</button><label>Data<input type="date" id="agendaDate" value="${state.date}"></label><button data-agenda-action="dateNext" aria-label="Próximo dia">›</button></div></div>`;}
  /** Renderiza seleção de técnicos, formulário de OS e resultado da distribuição. */
  function renderCreateRoute(){
    const orders=pendingDayOrders(),technicians=activeTechnicians();
    return `<section class="route-creation">${dateToolbar('Criar rota')}<div class="route-builder-grid"><div class="route-builder-panel"><section class="technician-selection ${state.techniciansExpanded?'':'is-collapsed'}"><div class="section-title"><div><small>EQUIPE DO DIA</small><h3>Técnicos disponíveis</h3><span class="technician-selection-summary">${state.selected.size} de ${technicians.length} selecionados</span></div><div><button data-agenda-action="toggleTechnicianNames" aria-expanded="${state.techniciansExpanded}">${state.techniciansExpanded?'Minimizar nomes':'Mostrar equipe'}</button><button data-agenda-action="manageTechnicians">Gerenciar técnicos</button></div></div>${state.techniciansExpanded?`<div class="technician-chips">${technicians.map(item=>`<label><input type="checkbox" data-agenda-technician="${esc(item.id)}" ${state.selected.has(item.id)?'checked':''}><span>${esc(item.name)}<small>${esc(item.serviceArea||'Sem base definida')}</small></span></label>`).join('')}</div>`:''}</section>${renderOrderForm()}<section class="work-order-list"><div class="section-title"><div><small>${orders.length} PENDENTES</small><h3>Ordens a distribuir</h3></div></div>${orders.length?orders.map(renderOrderCard).join(''):'<p class="agenda-empty">Nenhuma OS aguardando distribuição para esta data.</p>'}</section><button class="agenda-primary" data-agenda-action="generateRoutes" ${orders.length?'':'disabled'}>Gerar rota</button>${renderDistribution()}</div><aside class="operations-map-panel"><div class="map-panel-heading"><strong>Distribuição no mapa</strong><span>${state.generated?`${state.generated.allocated} alocadas`:'Aguardando geração'}</span></div><div id="operationsMap" aria-label="Mapa das rotas por técnico"></div></aside></div></section>`;
  }
  /** Renderiza o formulário de uma nova OS com restrições configuráveis. */
  function renderOrderForm(){
    const typeOptions=Object.entries(CONFIG.SERVICE_TYPES).map(([id,item])=>`<option value="${id}">${esc(item.label)}</option>`).join('');
    const techOptions=activeTechnicians().map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    return `<form id="workOrderForm" class="work-order-form"><div class="section-title"><div><small>NOVA VISITA</small><h3>Cadastrar atendimento</h3></div></div><details class="work-order-import"><summary>Importar OS por texto</summary><textarea id="workOrderImportText" rows="5" placeholder="Cole aqui o texto copiado do outro sistema"></textarea><div><small>Somente os dados usados no agendamento serão aproveitados. Login e campos extras serão ignorados.</small><button type="button" data-agenda-action="importWorkOrderText">Preencher formulário</button></div></details><div class="form-grid"><label>Nome do cliente<input name="customerName" required maxlength="100" autocomplete="off"></label><label>Tipo de serviço<select name="serviceType">${typeOptions}</select></label><label class="form-wide">Endereço/localidade<input id="workOrderAddress" name="address" required autocomplete="off" placeholder="Rua, número, bairro ou região"><div id="workOrderSuggestions" class="compare-suggestions work-order-suggestions" hidden></div><div id="workOrderLocationStatus" class="work-order-location-status" hidden></div></label><label>Turno<select name="shift">${Object.entries(CONFIG.SHIFTS).map(([id,item])=>`<option value="${id}">${item.label}</option>`).join('')}</select></label><label>Técnico inicial<select name="preferredTechnicianId"><option value="">Sem preferência</option>${techOptions}</select></label><label>Técnico obrigatório<select name="requiredTechnicianId"><option value="">Nenhum</option>${techOptions}</select></label><label>Restrição de horário<select name="timeType" id="workOrderTimeType"><option value="free">Horário livre</option><option value="fixed">Horário exato</option><option value="window">Janela de horário</option></select></label><label>Início<input type="time" name="timeStart" disabled></label><label data-time-end>Fim da janela<input type="time" name="timeEnd" disabled></label><label>Posição fixa na rota<input type="number" name="fixedPosition" min="1" max="80" placeholder="Opcional"></label><label class="check-field"><input type="checkbox" name="highPriority"> Prioridade alta</label><label class="check-field"><input type="checkbox" name="locked"> Bloqueada</label><label class="form-wide">Observação operacional<textarea name="note" rows="2" maxlength="300"></textarea></label></div><input type="hidden" name="latitude"><input type="hidden" name="longitude"><input type="hidden" name="locality"><div class="form-actions"><button type="reset">Limpar</button><button class="agenda-primary" type="submit">Adicionar atendimento</button></div></form>`;
  }
  /** Resume um atendimento exibindo apenas os dados necessários à operação. */
  function renderOrderCard(order){return `<article class="work-order-card"><span class="service-dot" style="--service-color:${CONFIG.SERVICE_TYPES[order.serviceType].color}"></span><div><strong>${esc(visitLabel(order))}</strong><small>${esc(serviceLabel(order.serviceType))} · ${esc(shiftLabel(order.shift))}</small><p>${esc(order.locality||order.address)}</p></div><div class="order-badges">${order.highPriority?'<b>Prioridade</b>':''}${order.locked?'<b>Bloqueada</b>':''}</div><button data-agenda-action="orderDetails" data-id="${esc(order.id)}">Detalhes</button><button data-agenda-action="removeOrder" data-id="${esc(order.id)}" aria-label="Remover atendimento">×</button></article>`;}
  /** Exibe rotas por técnico/turno e motivos das OS não alocadas. */
  function renderDistribution(){
    const result=state.generated;if(!result)return '';
    const schedules=result.schedules.map(schedule=>`<article class="schedule-result" data-agenda-schedule="${schedule.technician.id}:${schedule.shiftId}"><div class="schedule-title"><div><strong>${esc(schedule.technician.name)}</strong><small>${shiftLabel(schedule.shiftId)} · ${Math.round(schedule.load*100)}% da capacidade</small></div><b>${schedule.distanceKm.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</b></div><ol>${schedule.items.map((item,index)=>`<li draggable="${!item.order.locked}" data-agenda-drag="${schedule.technician.id}:${schedule.shiftId}" data-order-id="${esc(item.order.id)}" data-index="${index}"><span>${index+1}</span><time>${CORE.minutesToTime(item.start)}</time><div><strong>${esc(visitLabel(item.order))}</strong><small>${esc(serviceLabel(item.order.serviceType))} · ${esc(item.order.locality||item.order.address)}</small>${item.areaReminder?`<em class="area-reminder">${esc(item.areaReminder)}</em>`:''}</div></li>`).join('')}</ol></article>`).join('');
    const dropTargets=activeTechnicians().filter(item=>state.selected.has(item.id)).map(item=>`<button type="button" class="technician-drop-target" data-agenda-drop-technician="${esc(item.id)}"><strong>${esc(item.name)}</strong><small>${esc(item.serviceArea||'Sem base definida')}</small></button>`).join('');
    const unallocated=result.unallocated.length?`<section class="unallocated-panel"><h3>Atendimentos não alocados <span>${result.unallocated.length}</span></h3>${result.unallocated.map(item=>`<article><strong>${esc(visitLabel(item.order))}</strong><b>${item.reason}</b><p>${esc(item.message)}</p></article>`).join('')}</section>`:'';
    return `<section class="distribution-results"><div class="distribution-summary"><div><strong>${result.total}</strong><span>cadastradas</span></div><div><strong>${result.allocated}</strong><span>alocadas</span></div><div><strong>${result.unallocated.length}</strong><span>não alocadas</span></div><button class="agenda-primary" data-agenda-action="sendToAgenda" ${result.allocated?'':'disabled'}>Enviar para agenda</button></div>${schedules}<section class="technician-drop-section"><small>MUDAR TÉCNICO</small><p>Arraste uma OS e solte sobre o técnico de destino.</p><div class="technician-drop-targets">${dropTargets}</div></section>${unallocated}</section>`;
  }
  /** Atualiza sugestões e estado de confirmação sem reconstruir o formulário. */
  function showLocationSearch(results,message=''){
    const panel=$agenda('workOrderSuggestions'),status=$agenda('workOrderLocationStatus');if(!panel||!status)return;
    panel.hidden=!results.length;panel.innerHTML=results.map((item,index)=>`<button type="button" class="compare-suggestion ${index===0?'is-best':''}" data-agenda-action="previewLocation" data-index="${index}"><strong>${esc(item.formattedAddress||item.name)}</strong><small>${esc(item.cityName||cityName(item.city))} · ${esc(item.locality||'Localidade conhecida')} · ${esc(locationSourceLabel(item.source))}${item.approximate?' · aproximada':''}</small></button>`).join('');
    status.hidden=!message;status.innerHTML=message;
  }
  /** Monta um link gratuito para conferência manual, sem consultar APIs do Google. */
  function googleMapsCheckLink(candidate){
    if(!candidate)return '';
    const query=[candidate.formattedAddress||candidate.name,candidate.locality,candidate.cityName||cityName(candidate.city)].filter(Boolean).join(', ');
    const url=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Conferir no Google Maps ↗</a>`;
  }
  /** Traduz a origem tecnica para um rotulo curto na interface. */
  function locationSourceLabel(source){return ({local:'Base local',photon:'Photon',geoapify:'Geoapify',manual:'Ponto manual'})[source]||source||'Cadastro RoutePilot';}
  /** Monta o aviso e as acoes disponiveis para um candidato geografico. */
  function locationFeedback(candidate,{confirmed=false}={}){
    const message=confirmed?`Local confirmado: ${esc(candidate.formattedAddress||candidate.name)}`:candidate.partialAddress?'Rua localizada, número não confirmado.':candidate.approximate?'Localização aproximada — confirme no mapa.':'Melhor resultado exibido no mapa.';
    const warning=state.searchWarning?`<span class="location-warning">${esc(state.searchWarning)}</span>`:'';
    return `<span class="${confirmed?'location-confirmed':''}">${message}</span>${warning}${confirmed?'':`<button type="button" data-agenda-action="confirmLocation">Confirmar localização</button>`}${state.searchCanExpand&&!confirmed?'<button type="button" data-agenda-action="moreLocationOptions">Ver outras opções</button>':''}<button type="button" data-agenda-action="selectLocationOnMap">${confirmed?'Ajustar no mapa':'Selecionar no mapa'}</button>${googleMapsCheckLink(candidate)}`;
  }
  /** Pesquisa com debounce, cache e descarte de respostas antigas. */
  async function runLocationSearch(query,{forceExternal=false}={}){
    showLocationSearch([],`<span class="location-searching">Interpretando endereço...</span>`);
    try{const response=await state.geocodingService.search(query,{forceExternal});if(response.stale)return;state.searchResults=response.results;state.searchCanExpand=response.canExpand;state.searchWarning=response.warning||'';const best=response.results[0];if(!best){RoutePilotAgendaMap.clearPreview();showLocationSearch([],`<span class="location-warning">Nenhum local provável encontrado.</span><button type="button" data-agenda-action="selectLocationOnMap">Selecionar no mapa</button>`);return;}state.locationCandidate=best;RoutePilotAgendaMap.previewLocation(best);showLocationSearch(response.results,locationFeedback(best));}catch(error){showLocationSearch([],`<span class="location-warning">${esc(error.message||'Não foi possível pesquisar agora.')}</span><button type="button" data-agenda-action="selectLocationOnMap">Selecionar no mapa</button>`);}
  }
  /** Seleciona uma sugestão sem cadastrar a OS automaticamente. */
  function previewLocation(index){
    const candidate=state.searchResults[index];if(!candidate)return;
    const addressInput=$agenda('workOrderAddress');if(addressInput)addressInput.value=candidate.formattedAddress||candidate.name||addressInput.value;
    state.locationCandidate=candidate;state.confirmedLocation=null;RoutePilotAgendaMap.previewLocation(candidate);showLocationSearch(state.searchResults,locationFeedback(candidate));
  }
  /** Confirma as coordenadas que serão persistidas e reutilizadas pelo roteirizador. */
  function confirmLocation(){const candidate=state.locationCandidate;if(!candidate)return;state.confirmedLocation={...candidate,locationConfirmed:true};RoutePilotAgendaMap.previewLocation(candidate,{confirmed:true});showLocationSearch([],locationFeedback(candidate,{confirmed:true}));}
  /** Confirma primeiro o ponto manual e tenta enriquecer o endereco em segundo plano. */
  async function selectManualLocation(coords){
    const typed=$agenda('workOrderAddress')?.value.trim(),manual=RoutePilotGeocodingCore.createManualCandidate(coords,typed||'Ponto selecionado no mapa');if(!manual)return;
    const region=regionAtCoordinates(coords[0],coords[1]);state.searchCanExpand=false;state.searchWarning='';state.locationCandidate={...manual,city:region?.city||'',cityName:region?cityName(region.city):'',region:region?.id||null,locality:region?.name||manual.locality};confirmLocation();
    showLocationSearch([],`<span class="location-confirmed">Ponto manual confirmado.</span><span class="location-searching">Identificando rua e localidade...</span>${googleMapsCheckLink(state.locationCandidate)}`);
    const reverse=await state.geocodingService.reverse(coords),current=state.locationCandidate;if(!current||current.source!=='manual'||current.coords.some((value,index)=>value!==coords[index]))return;
    state.locationCandidate={...current,...reverse.result,coords:[...coords],latitude:coords[0],longitude:coords[1],source:'manual',locationConfirmed:true};state.confirmedLocation={...state.locationCandidate};state.searchWarning=reverse.warning||'';RoutePilotAgendaMap.previewLocation(state.locationCandidate,{confirmed:true});showLocationSearch([],locationFeedback(state.locationCandidate,{confirmed:true}));
  }
  /** Cria a grade diária inspirada no fluxo do IXC. */
  function renderAgenda(){
    const allTechnicians=activeTechnicians(),technicians=RoutePilotAgendaFilters.visibleTechnicians(allTechnicians,state.visibleTechnicianIds),agenda=state.agenda,items=agenda?.schedules?.flatMap(schedule=>schedule.items.map(item=>({...item,technicianId:schedule.technician.id,shiftId:schedule.shiftId})))||[];
    const startHour=6,endHour=19,rowHeight=64,totalHeight=(endHour-startHour)*rowHeight;
    const columns=technicians;
    const scheduledIds=new Set(items.map(item=>item.order.id)),reasonById=new Map((agenda?.unallocated||[]).map(item=>[item.order.id,item.message||item.reason])),unassigned=sameDayOrders().filter(order=>!scheduledIds.has(order.id));
    const drawerAvailable=state.showUnassigned&&unassigned.length>0,drawerVisible=drawerAvailable&&state.unassignedOpen,drawer=drawerVisible?`<aside class="unassigned-drawer"><div class="unassigned-drawer-heading"><div><small>PENDENTES</small><strong>OS não agendadas <b>${unassigned.length}</b></strong></div><button data-agenda-action="toggleUnassignedDrawer" aria-label="Ocultar OS não agendadas">‹</button></div><p>Arraste uma OS para a coluna do técnico.</p><div class="unassigned-drawer-list">${unassigned.map(order=>renderUnassignedCard(order,reasonById.get(order.id))).join('')}</div></aside>`:'';
    return `<section class="agenda-view">${dateToolbar('Agenda diária')}<div class="agenda-toolbar"><span>${esc(todayLabel(state.date))}</span>${drawerAvailable?`<button class="unassigned-toggle" data-agenda-action="toggleUnassignedDrawer" aria-pressed="${state.unassignedOpen}">${state.unassignedOpen?'Ocultar':'Mostrar'} não agendadas <b>${unassigned.length}</b></button>`:''}<div class="agenda-filter-anchor"><button data-agenda-action="toggleAgendaFilter" aria-expanded="${state.filterOpen}">Técnicos: ${technicians.length} selecionados ▾</button>${state.filterOpen?renderAgendaFilter(allTechnicians):''}</div><button data-agenda-action="manageTechnicians">Gerenciar técnicos</button><button data-main-tab="create">Criar rota</button></div><div class="agenda-workspace-layout ${drawerVisible?'has-unassigned-drawer':''}">${drawer}<div class="agenda-board" style="grid-template-columns:62px${columns.map(()=> ' 150px').join('')}"><div class="agenda-time-header"></div>${columns.map(item=>`<div class="agenda-tech-header"><strong>${esc(item.name)}</strong><small>${esc(item.serviceArea)}</small></div>`).join('')}<div class="agenda-time-axis" style="height:${totalHeight}px">${Array.from({length:endHour-startHour+1},(_,index)=>`<span style="top:${index*rowHeight}px">${String(startHour+index).padStart(2,'0')}:00</span>`).join('')}</div>${columns.map(technician=>`<div class="agenda-column" data-agenda-calendar-target="${esc(technician.id)}" style="height:${totalHeight}px;background-size:100% ${rowHeight}px">${items.filter(item=>item.technicianId===technician.id).map(item=>renderAgendaBlock(item,startHour,rowHeight)).join('')}</div>`).join('')}</div></div></section>`;
  }
  /** Monta um cartão arrastável para uma OS que ainda não está na grade. */
  function renderUnassignedCard(order,reason){return `<article class="unassigned-card" draggable="${!order.locked}" data-agenda-unscheduled-drag="${esc(order.id)}"><div><strong>${esc(visitLabel(order))}</strong><small>${esc(serviceLabel(order.serviceType))} · ${esc(shiftLabel(order.shift))}</small><span>${esc(order.locality||order.address)}</span>${reason?`<em>${esc(reason)}</em>`:''}</div><button data-agenda-action="orderDetails" data-id="${esc(order.id)}">Detalhes</button></article>`;}
  /** Monta o filtro de visualização sem recalcular ou alterar a programação. */
  function renderAgendaFilter(technicians){
    const query=RoutePilotWorkOrderSearch.normalize(state.filterQuery),visible=technicians.filter(item=>!query||RoutePilotWorkOrderSearch.normalize(item.name).includes(query));
    return `<section class="agenda-filter-popover"><label class="agenda-filter-saved">Filtro salvo<select id="agendaSavedFilter"><option value="">Seleção atual</option>${state.filters.map(filter=>`<option value="${esc(filter.id)}" ${filter.id===state.activeFilterId?'selected':''}>${esc(filter.name)}${filter.isDefault?' (padrão)':''}</option>`).join('')}</select></label><input id="agendaFilterSearch" placeholder="Buscar técnico..." value="${esc(state.filterQuery)}"><div class="agenda-filter-actions"><button data-agenda-action="agendaFilterAll">Todos</button><button data-agenda-action="agendaFilterNone">Nenhum</button></div><div class="agenda-filter-list">${visible.map(item=>`<label><span>${esc(item.name)}</span><input type="checkbox" data-agenda-filter-tech="${esc(item.id)}" ${state.visibleTechnicianIds.has(item.id)?'checked':''}></label>`).join('')}</div><label class="agenda-filter-unassigned"><span>OS não agendadas</span><input type="checkbox" id="agendaFilterUnassigned" ${state.showUnassigned?'checked':''}></label><button class="agenda-primary" data-agenda-action="openFilterEditor">Salvar ou gerenciar filtros</button></section>`;
  }
  /** Permite criar, renomear, definir padrão e excluir filtros persistidos. */
  function renderFilterEditor(){
    const editing=state.filters.find(filter=>filter.id===state.editFilterId);
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Filtros da Agenda"><div class="modal-heading"><div><small>AGENDA</small><h2>Filtros de técnicos</h2></div><button data-agenda-action="closeFilterEditor">×</button></div><form id="agendaFilterForm" class="agenda-filter-form"><input type="hidden" name="id" value="${esc(editing?.id||'')}"><label>Nome do filtro<input name="name" required maxlength="60" value="${esc(editing?.name||'')}"></label><label><input type="checkbox" name="isDefault" ${editing?.isDefault?'checked':''}> Usar como padrão</label><button class="agenda-primary" type="submit">${editing?'Salvar alterações':'Salvar seleção atual'}</button></form><div class="saved-filter-list">${state.filters.length?state.filters.map(filter=>`<article><div><strong>${esc(filter.name)}</strong><small>${filter.technicianIds.length} técnicos${filter.showUnassigned?' · com OS não agendadas':''}${filter.isDefault?' · padrão':''}</small></div><button data-agenda-action="applySavedFilter" data-id="${esc(filter.id)}">Aplicar</button><button data-agenda-action="editSavedFilter" data-id="${esc(filter.id)}">Renomear</button><button data-agenda-action="defaultSavedFilter" data-id="${esc(filter.id)}">Padrão</button><button data-agenda-action="deleteSavedFilter" data-id="${esc(filter.id)}">Excluir</button></article>`).join(''):'<p class="agenda-empty">Nenhum filtro salvo.</p>'}</div></section></div>`;
  }
  /** Posiciona um bloco da agenda de acordo com início e duração. */
  function renderAgendaBlock(item,startHour,rowHeight){const top=(item.start-startHour*60)/60*rowHeight,height=Math.max(34,(item.end-item.start)/60*rowHeight);return `<button class="agenda-block" draggable="${!item.order.locked}" style="top:${top}px;height:${height}px;--service-color:${CONFIG.SERVICE_TYPES[item.order.serviceType].color}" data-agenda-action="orderDetails" data-agenda-calendar-drag="${esc(item.technicianId)}:${esc(item.shiftId)}" data-order-id="${esc(item.order.id)}" data-id="${esc(item.order.id)}"><time>${CORE.minutesToTime(item.start)}–${CORE.minutesToTime(item.end)}</time><strong>${esc(visitLabel(item.order))}</strong><small>${esc(serviceLabel(item.order.serviceType))}</small><span>${esc(item.order.locality||item.order.address)}</span></button>`;}
  /** Exibe edição simples e não destrutiva dos técnicos. */
  function renderTechnicianManager(){return `<div class="agenda-modal-backdrop"><section class="agenda-modal technician-manager" role="dialog" aria-modal="true" aria-label="Gerenciar técnicos"><div class="modal-heading"><div><small>EQUIPE</small><h2>Gerenciar técnicos</h2></div><button data-agenda-action="closeManager">×</button></div><form id="addTechnicianForm" class="add-technician"><input name="name" placeholder="Nome do técnico" required><input name="serviceArea" placeholder="Base ou área"><button class="agenda-primary">Adicionar</button></form><div class="technician-manager-list">${state.technicians.sort((a,b)=>a.displayOrder-b.displayOrder).map((item,index)=>`<article><input data-tech-name="${item.id}" value="${esc(item.name)}" aria-label="Nome"><input data-tech-area="${item.id}" value="${esc(item.serviceArea||'')}" aria-label="Base"><label><input type="checkbox" data-tech-active="${item.id}" ${item.active?'checked':''}> Ativo</label><label><input type="checkbox" data-tech-shift="${item.id}:morning" ${item.defaultShifts.includes('morning')?'checked':''}> Manhã</label><label><input type="checkbox" data-tech-shift="${item.id}:afternoon" ${item.defaultShifts.includes('afternoon')?'checked':''}> Tarde</label><button data-agenda-action="moveTechnician" data-id="${item.id}" data-direction="-1" ${index?'':'disabled'}>↑</button><button data-agenda-action="moveTechnician" data-id="${item.id}" data-direction="1" ${index<state.technicians.length-1?'':'disabled'}>↓</button></article>`).join('')}</div><div class="modal-actions"><button data-agenda-action="closeManager">Concluir</button></div></section></div>`;}
  /** Mostra os campos operacionais e ações geográficas de uma OS. */
  function renderOrderDetails(id){const order=state.orders.find(item=>item.id===id);if(!order)return '';const scheduled=scheduledVisit(id);return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Detalhes do atendimento"><div class="modal-heading"><div><small>ATENDIMENTO</small><h2>${esc(visitLabel(order))}</h2></div><button data-agenda-action="closeOrderDetails">×</button></div><dl class="order-details">${order.customerName?`<dt>Cliente</dt><dd>${esc(order.customerName)}</dd>`:''}<dt>Serviço</dt><dd>${esc(serviceLabel(order.serviceType))}</dd><dt>Pesquisa original</dt><dd>${esc(order.searchedText||order.address)}</dd><dt>Endereço interpretado</dt><dd>${esc(order.address)}</dd><dt>Localidade</dt><dd>${esc(order.locality||'Não informada')}</dd><dt>Fonte</dt><dd>${esc(order.locationSource||'Cadastro anterior')}</dd><dt>Localização</dt><dd>${order.locationConfirmed?'Confirmada':'Cadastro anterior'}${order.locationApproximate?' · aproximada':''}</dd><dt>Turno</dt><dd>${esc(shiftLabel(order.shift))}</dd><dt>Restrição</dt><dd>${esc(order.timeConstraint.type)} ${esc(order.timeConstraint.start||'')}</dd><dt>Técnico inicial</dt><dd>${esc(technicianById(order.preferredTechnicianId)?.name||'Sem preferência')}</dd><dt>Técnico obrigatório</dt><dd>${esc(technicianById(order.requiredTechnicianId)?.name||'Não')}</dd><dt>Observação</dt><dd>${esc(order.note||'Sem observação')}</dd></dl><div class="modal-actions">${scheduled?`<button class="agenda-warning" data-agenda-action="requestRescheduleVisit" data-id="${esc(order.id)}">Reagendar</button><button class="agenda-danger" data-agenda-action="requestCancelVisit" data-id="${esc(order.id)}">Cancelar visita</button>`:''}<button data-agenda-action="openOrderMap" data-id="${order.id}">Abrir no mapa</button><button data-agenda-action="copyOrderLocation" data-id="${order.id}">Copiar localização</button><button data-agenda-action="suggestTechnician" data-id="${order.id}">Sugerir técnico ideal</button><button class="agenda-primary" data-agenda-action="shareOrder" data-id="${order.id}">Compartilhar</button></div></section></div>`;}
  /** Apresenta a escolha segura quando a data já possui programação. */
  function renderAgendaPreview(){
    const existing=state.agenda?.schedules?.reduce((sum,schedule)=>sum+schedule.items.length,0)||0,newCount=state.generated?.allocated||0,preview=state.pendingAgenda;
    const changeRows=preview?.changes?.details?.slice(0,8).map(item=>`<li><strong>${esc(item.label)}</strong><span>${esc(item.text)}</span></li>`).join('')||'';
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Prévia da agenda"><div class="modal-heading"><div><small>PRÉVIA</small><h2>${preview?.candidate?'Revise antes de aplicar':existing?'Agenda já possui OS':'Enviar para agenda'}</h2></div><button data-agenda-action="cancelAgendaPreview">×</button></div>${preview?.candidate?`<div class="preview-summary"><p><strong>${preview.changes.technicianChanges}</strong> trocaram de técnico</p><p><strong>${preview.changes.timeChanges}</strong> mudaram de horário</p><p><strong>${preview.changes.newOrders}</strong> novas OS encaixadas · ${preview.candidate.unallocated.length} não alocadas</p><p>Distância atual: ${preview.changes.currentDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km · Nova: ${preview.changes.newDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</p></div>${changeRows?`<ul class="preview-changes">${changeRows}</ul>`:''}<div class="modal-actions"><button class="agenda-primary" data-agenda-action="applyAgenda">Aplicar nova agenda</button><button data-agenda-action="cancelAgendaPreview">Cancelar</button></div>`:`<div class="preview-summary"><p><strong>${existing}</strong> OS já existentes</p><p><strong>${newCount}</strong> OS da nova distribuição</p><p>Nenhuma alteração será aplicada antes da confirmação.</p></div>${existing?`<div class="agenda-choice"><button data-agenda-action="chooseAgendaMode" data-mode="reoptimize"><strong>Reotimizar agenda atual + novas OS</strong><span>Pode alterar técnico, ordem e horário de OS não bloqueadas.</span></button><button data-agenda-action="chooseAgendaMode" data-mode="fit"><strong>Manter agenda e encaixar novas</strong><span>Preserva a programação atual.</span></button></div>`:'<div class="modal-actions"><button class="agenda-primary" data-agenda-action="chooseAgendaMode" data-mode="replace">Preparar agenda</button><button data-agenda-action="cancelAgendaPreview">Cancelar</button></div>'}`}</section></div>`;
  }
  /** Pede confirmação antes de trocar a OS de técnico e recalcular as rotas. */
  function renderMoveConfirmation(){
    const move=state.pendingMove,source=move.sourceKey?technicianById(move.sourceKey.split(':')[0]):null,target=technicianById(move.targetTechnicianId),reminder=CORE.assignmentReminder(target,move.order),hasTime=Number.isFinite(move.targetStart),sameTechnician=source?.id===target?.id;
    const title=hasTime?(source?sameTechnician?'Alterar horário?':'Mudar técnico e horário?':'Agendar atendimento?'):'Mudar técnico?';
    const description=hasTime?`${source?`Mover <strong>${esc(visitLabel(move.order))}</strong> de <b>${esc(source.name)}</b>${Number.isFinite(move.sourceStart)?`, às <b>${CORE.minutesToTime(move.sourceStart)}</b>`:''}`:`Agendar <strong>${esc(visitLabel(move.order))}</strong>`} para <b>${esc(target?.name||'Técnico')}</b>, às <b>${CORE.minutesToTime(move.targetStart)}</b>?`:`Mover <strong>${esc(visitLabel(move.order))}</strong> de <b>${esc(source?.name||'OS não agendadas')}</b> para <b>${esc(target?.name||'Técnico')}</b>, no turno da ${esc(shiftLabel(move.targetShiftId).toLowerCase())}?`;
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal move-confirmation" role="dialog" aria-modal="true" aria-label="Confirmar alteração da agenda"><div class="modal-heading"><div><small>CONFIRMAÇÃO</small><h2>${title}</h2></div><button data-agenda-action="cancelScheduleMove">×</button></div><p>${description}</p><div class="route-recalculation-notice"><strong>As rotas afetadas serão recalculadas</strong><span>O RoutePilot validará capacidade, horários, distância e restrições antes de salvar.</span></div>${reminder?`<p class="area-reminder">${esc(reminder)}</p>`:''}<div class="modal-actions"><button data-agenda-action="cancelScheduleMove">Cancelar</button><button class="agenda-primary" data-agenda-action="confirmScheduleMove">${hasTime?'Alterar e recalcular':'Mover e recalcular'}</button></div></section></div>`;
  }
  /** Confirma cancelamento ou devolução da visita para a lista de pendentes. */
  function renderVisitActionConfirmation(){
    const pending=state.pendingVisitAction,isCancel=pending.type==='cancel';
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal visit-action-confirmation" role="dialog" aria-modal="true" aria-label="Confirmar ${isCancel?'cancelamento':'reagendamento'}"><div class="modal-heading"><div><small>CONFIRMAÇÃO</small><h2>${isCancel?'Cancelar visita?':'Reagendar visita?'}</h2></div><button data-agenda-action="closeVisitAction">×</button></div><p>${isCancel?`A visita de <strong>${esc(visitLabel(pending.order))}</strong> será cancelada e retirada da agenda.`:`A visita de <strong>${esc(visitLabel(pending.order))}</strong> será retirada do horário atual e voltará para <b>OS não agendadas</b>.`}</p><div class="route-recalculation-notice"><strong>A rota de ${esc(pending.technicianName)} será recalculada</strong><span>Os demais atendimentos serão mantidos e terão os horários ajustados quando necessário.</span></div><div class="modal-actions"><button data-agenda-action="closeVisitAction">Voltar</button><button class="${isCancel?'agenda-danger':'agenda-warning'}" data-agenda-action="confirmVisitAction">${isCancel?'Confirmar cancelamento':'Enviar para não agendadas'}</button></div></section></div>`;
  }
  /** Apresenta a recomendação calculada e mantém a decisão com o usuário. */
  function renderTechnicianSuggestion(){
    const analysis=state.pendingSuggestion,selected=analysis.options[analysis.selectedIndex]||analysis.options[0];
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal technician-suggestion" role="dialog" aria-modal="true" aria-label="Sugestão de técnico"><div class="modal-heading"><div><small>ANÁLISE DE ROTAS</small><h2>Técnico sugerido</h2></div><button data-agenda-action="cancelTechnicianSuggestion">×</button></div><p>Melhores encaixes para <strong>${esc(visitLabel(analysis.order))}</strong>, considerando as rotas e restrições deste dia.</p><div class="technician-suggestion-list">${analysis.options.slice(0,3).map((option,index)=>`<button class="${index===analysis.selectedIndex?'is-selected':''}" data-agenda-action="selectTechnicianSuggestion" data-index="${index}"><span>${index===0?'Melhor opção':`Opção ${index+1}`}</span><strong>${esc(option.technician.name)}</strong><small>${esc(shiftLabel(option.shiftId))} · rota do dia ${option.totalDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km · base ${esc(option.technician.serviceArea||'não definida')}</small></button>`).join('')}</div>${selected.areaReminder?`<p class="area-reminder">${esc(selected.areaReminder)}</p>`:'<p class="suggestion-positive">A área do atendimento combina com a base do técnico selecionado.</p>'}<div class="modal-actions"><button data-agenda-action="cancelTechnicianSuggestion">Cancelar</button><button class="agenda-primary" data-agenda-action="applyTechnicianSuggestion">Enviar para ${esc(selected.technician.name)}</button></div></section></div>`;
  }

  /** Reotimiza a ordem de cada técnico sem violar horários ou posições fixas. */
  function optimizeDistributedSchedules(result,matrix){
    result.schedules=result.schedules.map(schedule=>{
      const orders=schedule.items.map(item=>item.order);if(orders.length<2)return schedule;
      const occupied=new Set(),lockedPositions={};
      orders.forEach((order,index)=>{const position=Number(order.fixedPosition)-1;if(Number.isInteger(position)&&position>=0&&position<orders.length&&!occupied.has(position)){lockedPositions[order.id]=position;occupied.add(position);}});
      orders.forEach((order,index)=>{if((order.locked||CORE.normalizeTimeConstraint(order.timeConstraint).type!=='free')&&!Object.hasOwn(lockedPositions,order.id)&&!occupied.has(index)){lockedPositions[order.id]=index;occupied.add(index);}});
      try{
        const optimized=RoutePilotRouteOptimizer.optimizeRoute(orders,{origin:orders[0],matrix,lockedPositions});
        const recalculated=CORE.recalculateSchedule(optimized.orderedPoints,schedule.technician,schedule.shiftId,{matrix});
        return recalculated.valid?recalculated.schedule:schedule;
      }catch(error){return schedule;}
    });
    return result;
  }
  /** Constrói a matriz local e distribui todas as OS do dia. */
  async function generateRoutes(){
    const orders=pendingDayOrders();if(!orders.length)return;showToast('Calculando distribuição...');
    const points=orders.map(order=>({...order,id:order.id}));let matrix={};
    try{matrix=(await RoutePilotLocalRouting.calculateMatrix(points)).matrix;}catch(error){const provider=RoutePilotDistance.createDistanceProvider();matrix=await new RoutePilotDistance.DistanceMatrix(points,provider,{mode:'straight'}).build();showToast('Usando distância em linha reta como contingência');}
    state.generated=optimizeDistributedSchedules(CORE.allocateWorkOrders(orders,state.technicians,{matrix,selectedTechnicianIds:[...state.selected]}),matrix);state.generated.matrix=matrix;render();
  }
  /** Valida, resolve e persiste uma nova OS. */
  async function addWorkOrder(form){
    const data=new FormData(form),customerName=String(data.get('customerName')).trim();
    const place=state.confirmedLocation;if(!place){showToast('Confirme a localização no mapa antes de adicionar a OS');return;}
    const duplicate=CORE.findDuplicateWorkOrder(state.orders.filter(order=>!order.archived),{customerName,date:state.date,coords:place.coords});if(duplicate){showToast('Este atendimento já está cadastrado para o mesmo cliente e local');return;}
    const fixedPosition=Number(data.get('fixedPosition'));
    const originalSearch=String(data.get('address')).trim();
    const formattedAddress=place.formattedAddress||place.name||originalSearch,latitude=Number(place.coords[0]),longitude=Number(place.coords[1]);
    const order={id:makeId('os'),customerName,date:state.date,serviceType:data.get('serviceType'),addressInput:originalSearch,formattedAddress,searchedText:originalSearch,address:formattedAddress,latitude,longitude,coords:[latitude,longitude],locality:place.locality||place.name||'',city:place.city||'',locationSource:place.source||'local',locationConfirmed:true,locationApproximate:Boolean(place.approximate),shift:data.get('shift')||'any',highPriority:data.has('highPriority'),locked:data.has('locked'),fixedPosition:Number.isInteger(fixedPosition)&&fixedPosition>0?fixedPosition:null,preferredTechnicianId:data.get('preferredTechnicianId')||null,requiredTechnicianId:data.get('requiredTechnicianId')||null,note:String(data.get('note')||'').trim(),timeConstraint:{type:data.get('timeType'),start:data.get('timeStart')||null,end:data.get('timeEnd')||null},createdAt:new Date().toISOString()};
    state.orders.push(order);await RoutePilotAgendaStorage.put('workOrders',order);state.confirmedLocation=null;state.locationCandidate=null;state.searchResults=[];state.generated=null;RoutePilotAgendaMap.clearPreview();form.reset();render();showToast(`Atendimento de ${order.customerName} adicionado`);
  }
  /** Preenche o cadastro com os campos úteis extraídos do texto externo. */
  async function importWorkOrderText(){
    const text=$agenda('workOrderImportText')?.value||'',imported=RoutePilotWorkOrderImport.parse(text);if(!imported.customerName&&!imported.address){showToast('Não encontrei cliente ou endereço no texto colado');return;}
    if(imported.date&&imported.date!==state.date){state.date=imported.date;state.generated=null;state.agenda=await RoutePilotAgendaStorage.getAgenda(state.date)||null;render();}
    const form=$agenda('workOrderForm');if(!form)return;const field=name=>form.elements.namedItem(name);
    field('customerName').value=imported.customerName;field('serviceType').value=imported.serviceType;field('shift').value=imported.shift;field('timeType').value=imported.timeConstraint.type;field('timeStart').value=imported.timeConstraint.start||'';field('timeEnd').value=imported.timeConstraint.end||'';field('timeStart').disabled=imported.timeConstraint.type==='free';field('timeEnd').disabled=imported.timeConstraint.type!=='window';
    const technicians=activeTechnicians(),exact=technicians.find(item=>RoutePilotWorkOrderSearch.normalize(item.name)===RoutePilotWorkOrderSearch.normalize(imported.technicianName)),ranked=imported.technicianName?RoutePilotWorkOrderSearch.rank(imported.technicianName,technicians,{limit:1})[0]:null,technician=exact||ranked;field('preferredTechnicianId').value=technician?.id||'';field('address').value=imported.address;state.confirmedLocation=null;state.locationCandidate=null;state.searchResults=[];
    if(imported.address){
      await runLocationSearch(imported.address);const expectedCity=RoutePilotWorkOrderSearch.normalize(imported.city),sameCityResults=expectedCity?state.searchResults.filter(item=>RoutePilotWorkOrderSearch.normalize(item.cityName||cityName(item.city))===expectedCity):state.searchResults;
      if(sameCityResults.length){state.searchResults=sameCityResults;previewLocation(0);}else if(imported.locality){await runLocationSearch([imported.locality,imported.city].filter(Boolean).join(', '));const regionResults=expectedCity?state.searchResults.filter(item=>RoutePilotWorkOrderSearch.normalize(item.cityName||cityName(item.city))===expectedCity):state.searchResults;if(regionResults.length){state.searchResults=regionResults;previewLocation(0);}}
    }showToast(`Dados preenchidos${technician?` · técnico identificado: ${technician.name}`:imported.technicianName?' · técnico não reconhecido':''}. Confirme a localização.`);
  }
  /** Aplica um filtro salvo somente às colunas visíveis. */
  function applyAgendaFilter(filter){const normalized=RoutePilotAgendaFilters.normalizeFilter(filter,activeTechnicians().map(item=>item.id));state.visibleTechnicianIds=new Set(normalized.technicianIds);state.showUnassigned=normalized.showUnassigned;state.activeFilterId=normalized.id||null;state.filterOpen=false;render({preserveAgendaScroll:true});}
  /** Persiste todos os filtros após alterar qual deles é o padrão. */
  async function persistFilters(){await RoutePilotAgendaStorage.putMany('settings',state.filters.map(filter=>({...filter,type:'agendaTechnicianFilter'})));}
  /** Calcula uma prévia sem alterar a agenda persistida. */
  function prepareAgendaCandidate(mode){
    const current=state.agenda,existingItems=current?.schedules?.flatMap(schedule=>schedule.items.map(item=>({...item,technicianId:schedule.technician.id})))||[];
    const existingIds=new Set(existingItems.map(item=>item.order.id));const newOrders=sameDayOrders().filter(order=>!existingIds.has(order.id));let candidate;
    if(mode==='replace'||!current)candidate=state.generated;
    else if(mode==='fit')candidate=CORE.allocateWorkOrders(newOrders,state.technicians,{matrix:state.generated.matrix,selectedTechnicianIds:[...state.selected],initialSchedules:current.schedules});
    else{
      const lockedSchedules=current.schedules.map(schedule=>({...schedule,items:schedule.items.filter(item=>item.order.locked)})).filter(schedule=>schedule.items.length);
      const unlocked=[...new Map([...existingItems.map(item=>item.order),...sameDayOrders()].filter(order=>!order.locked).map(order=>[order.id,order])).values()];
      candidate=optimizeDistributedSchedules(CORE.allocateWorkOrders(unlocked,state.technicians,{matrix:state.generated.matrix,selectedTechnicianIds:[...state.selected],initialSchedules:lockedSchedules}),state.generated.matrix);
    }
    const before=new Map(existingItems.map(item=>[item.order.id,item])),afterItems=candidate.schedules.flatMap(schedule=>schedule.items.map(item=>({...item,technicianId:schedule.technician.id})));let technicianChanges=0,timeChanges=0;const details=[];
    afterItems.forEach(item=>{const old=before.get(item.order.id);if(!old)return;const changes=[];if(old.technicianId!==item.technicianId){technicianChanges++;changes.push(`${technicianById(old.technicianId)?.name||'Sem colaborador'} → ${technicianById(item.technicianId)?.name}`);}if(old.start!==item.start){timeChanges++;changes.push(`${CORE.minutesToTime(old.start)} → ${CORE.minutesToTime(item.start)}`);}if(changes.length)details.push({label:visitLabel(item.order),text:changes.join(' · ')});});
    state.pendingAgenda={mode,candidate,changes:{technicianChanges,timeChanges,newOrders:afterItems.filter(item=>!before.has(item.order.id)).length,currentDistance:current?.schedules?.reduce((sum,schedule)=>sum+(Number(schedule.distanceKm)||0),0)||0,newDistance:candidate.schedules.reduce((sum,schedule)=>sum+(Number(schedule.distanceKm)||0),0),details}};render();
  }
  /** Salva a distribuição somente depois da confirmação da prévia. */
  async function applyAgenda(){const candidate=state.pendingAgenda?.candidate;if(!candidate)return;state.agenda={date:state.date,schedules:candidate.schedules,unallocated:candidate.unallocated,updatedAt:new Date().toISOString()};await RoutePilotAgendaStorage.saveAgenda(state.agenda);state.pendingAgenda=null;state.generated=null;state.tab='agenda';render();$agenda('operationsWorkspace').scrollTop=0;showToast('Agenda atualizada');}
  /** Escolhe um turno compatível, preferindo o turno indicado pelo ponto de destino. */
  function compatibleShift(order,technician,preferred){const allowed=new Set(CORE.allowedShiftIds(order)),available=technician.defaultShifts||[];return available.find(shift=>shift===preferred&&allowed.has(shift))||available.find(shift=>allowed.has(shift))||null;}
  /** Produz uma matriz apenas com as OS usadas na operação atual. */
  async function buildScheduleMatrix(schedules,extraOrders=[]){
    const orders=[...new Map([...schedules.flatMap(schedule=>schedule.items.map(item=>item.order)),...extraOrders].map(order=>[order.id,order])).values()];
    if(!orders.length)return {};
    if(orders.length===1)return {[orders[0].id]:{[orders[0].id]:0}};
    const cached=state.generated?.matrix;if(cached&&orders.every(order=>cached[order.id]&&orders.every(other=>Number.isFinite(cached[order.id][other.id]))))return cached;
    try{return (await RoutePilotLocalRouting.calculateMatrix(orders)).matrix;}catch(error){const provider=RoutePilotDistance.createDistanceProvider();showToast('Usando distância em linha reta como contingência');return new RoutePilotDistance.DistanceMatrix(orders,provider,{mode:'straight'}).build();}
  }
  /** Substitui somente as rotas afetadas e mantém a ordem visual dos técnicos. */
  function replaceAffectedSchedules(schedules,{sourceKey,targetKey,sourceSchedule,targetSchedule}){
    const updated=schedules.filter(schedule=>{const key=`${schedule.technician.id}:${schedule.shiftId}`;return key!==sourceKey&&key!==targetKey;});
    if(sourceSchedule?.items.length)updated.push(sourceSchedule);if(targetSchedule?.items.length)updated.push(targetSchedule);
    return updated.sort((a,b)=>a.technician.displayOrder-b.technician.displayOrder||Object.keys(CONFIG.SHIFTS).indexOf(a.shiftId)-Object.keys(CONFIG.SHIFTS).indexOf(b.shiftId));
  }
  /** Traduz falhas do agendador para uma mensagem operacional curta. */
  function moveFailureMessage(reason){return ({LOCKED_WORK_ORDER:'Uma OS bloqueada não pode mudar de técnico.',INVALID_MOVE:'Não foi possível identificar a rota de origem.',...CONFIG.UNALLOCATED_REASONS})[reason]||'Não foi possível encaixar a OS nessa rota.';}
  /** Identifica o turno operacional correspondente ao ponto vertical escolhido. */
  function shiftAtMinute(technician,minute){return (technician.defaultShifts||[]).find(shiftId=>{const shift=CONFIG.SHIFTS[shiftId];return shift?.start&&minute>=CORE.timeToMinutes(shift.start)&&minute<CORE.timeToMinutes(shift.end);})||null;}
  /** Abre a confirmação de mudança sem alterar dados durante o arrasto. */
  function queueScheduleMove({scope,orderId,sourceKey=null,targetTechnicianId,targetShiftId,targetIndex,targetStart=null}){
    const order=state.orders.find(item=>item.id===orderId);if(!order)return;if(order.locked){showToast('Uma OS bloqueada não pode mudar de técnico');return;}
    const target=technicianById(targetTechnicianId);if(!target){showToast('Técnico de destino não encontrado');return;}const proposedOrder=Number.isFinite(targetStart)?{...order,shift:targetShiftId,timeConstraint:{type:'fixed',start:CORE.minutesToTime(targetStart),end:null}}:order,shift=compatibleShift(proposedOrder,target,targetShiftId);if(!shift){showToast(moveFailureMessage('SHIFT_CONFLICT'));return;}
    const container=scope==='generated'?state.generated:state.agenda,source=sourceKey?(container?.schedules||[]).find(schedule=>`${schedule.technician.id}:${schedule.shiftId}`===sourceKey):null,sourceStart=source?.items.find(item=>item.order.id===orderId)?.start;
    if(sourceKey===`${target.id}:${shift}`&&(!Number.isFinite(targetStart)||sourceStart===targetStart))return;
    state.drag=null;state.pendingMove={scope,order,sourceKey,targetTechnicianId:target.id,targetShiftId:shift,targetIndex,targetStart:Number.isFinite(targetStart)?targetStart:null,sourceStart};render({preserveAgendaScroll:scope==='agenda'});
  }
  /** Confirma a transferência, recalcula as duas rotas e persiste quando for Agenda. */
  async function confirmScheduleMove(){
    const move=state.pendingMove;if(!move)return;const container=move.scope==='generated'?state.generated:state.agenda,schedules=container?.schedules||[],source=move.sourceKey?schedules.find(schedule=>`${schedule.technician.id}:${schedule.shiftId}`===move.sourceKey):null,targetTechnician=technicianById(move.targetTechnicianId);
    const targetKey=`${targetTechnician.id}:${move.targetShiftId}`,target=schedules.find(schedule=>`${schedule.technician.id}:${schedule.shiftId}`===targetKey)||{technician:targetTechnician,shiftId:move.targetShiftId,items:[],load:0,distanceKm:0};
    showToast('Recalculando rotas...');const matrix=await buildScheduleMatrix(schedules,[move.order]);let result;
    if(Number.isFinite(move.targetStart))result=CORE.scheduleWorkOrderAtTime(move.order,source,target,move.targetStart,{matrix});
    else if(source)result=CORE.moveWorkOrderBetweenSchedules(source,target,move.order.id,move.targetIndex,{matrix});else{const assigned=CORE.assignWorkOrderToSchedule(move.order,target,move.targetIndex,{matrix});result=assigned.valid?{valid:true,order:move.order,sourceSchedule:null,targetSchedule:assigned.schedule}:assigned;}
    if(!result.valid){state.pendingMove=null;render({preserveAgendaScroll:move.scope==='agenda'});showToast(moveFailureMessage(result.reason));return;}
    const updated=replaceAffectedSchedules(schedules,{sourceKey:move.sourceKey,targetKey,sourceSchedule:result.sourceSchedule,targetSchedule:result.targetSchedule});
    if(move.scope==='generated'){state.generated={...state.generated,schedules:updated,matrix,unallocated:state.generated.unallocated.filter(item=>item.order.id!==move.order.id)};state.generated.allocated=state.generated.total-state.generated.unallocated.length;}
    else{if(Number.isFinite(move.targetStart)){state.orders=state.orders.map(order=>order.id===result.order.id?result.order:order);await RoutePilotAgendaStorage.put('workOrders',result.order);}state.agenda={date:state.date,schedules:updated,unallocated:(state.agenda?.unallocated||[]).filter(item=>item.order.id!==move.order.id),updatedAt:new Date().toISOString()};await RoutePilotAgendaStorage.saveAgenda(state.agenda);}
    state.pendingMove=null;render({preserveAgendaScroll:move.scope==='agenda'});showToast(`OS movida para ${targetTechnician.name}; rotas recalculadas`);
  }
  /** Abre a confirmação de cancelamento ou reagendamento de uma visita agendada. */
  function requestVisitAction(orderId,type){
    const order=state.orders.find(item=>item.id===orderId),scheduled=scheduledVisit(orderId);if(!order||!scheduled){showToast('Esta OS não está agendada');return;}
    state.detailId=null;state.pendingVisitAction={type,order,scheduleKey:scheduled.key,technicianName:scheduled.schedule.technician.name};render({preserveAgendaScroll:true});
  }
  /** Retira a visita da rota, persiste o estado escolhido e recalcula a coluna. */
  async function confirmVisitAction(){
    const pending=state.pendingVisitAction;if(!pending)return;const schedules=state.agenda?.schedules||[],source=schedules.find(schedule=>`${schedule.technician.id}:${schedule.shiftId}`===pending.scheduleKey);if(!source){state.pendingVisitAction=null;render({preserveAgendaScroll:true});showToast('A visita já não está nesta agenda');return;}
    showToast('Atualizando agenda...');const matrix=await buildScheduleMatrix(schedules),result=CORE.removeWorkOrderFromSchedule(source,pending.order.id,{matrix});if(!result.valid){state.pendingVisitAction=null;render({preserveAgendaScroll:true});showToast(moveFailureMessage(result.reason));return;}
    const isCancel=pending.type==='cancel',now=new Date().toISOString(),updatedOrder=isCancel?{...pending.order,status:'cancelled',archived:true,date:'',cancelledAt:now}:{...pending.order,status:'pending_reschedule',shift:'any',timeConstraint:{type:'free',start:null,end:null},rescheduledAt:now};
    state.orders=state.orders.map(order=>order.id===updatedOrder.id?updatedOrder:order);await RoutePilotAgendaStorage.put('workOrders',updatedOrder);
    const updatedSchedules=replaceAffectedSchedules(schedules,{sourceKey:pending.scheduleKey,targetKey:null,sourceSchedule:result.schedule,targetSchedule:null}),remaining=(state.agenda?.unallocated||[]).filter(item=>item.order.id!==updatedOrder.id),unallocated=isCancel?remaining:[...remaining,{order:updatedOrder,reason:'RESCHEDULE_PENDING',message:'Aguardando novo agendamento.'}];
    state.agenda={date:state.date,schedules:updatedSchedules,unallocated,updatedAt:now};await RoutePilotAgendaStorage.saveAgenda(state.agenda);state.pendingVisitAction=null;state.unassignedOpen=!isCancel;render({preserveAgendaScroll:true});showToast(isCancel?'Visita cancelada e retirada da agenda':'Visita enviada para OS não agendadas');
  }
  /** Analisa os encaixes de uma OS e abre a recomendação sem alterar a agenda. */
  async function suggestTechnician(orderId){
    const order=state.orders.find(item=>item.id===orderId);if(!order)return;if(order.locked){showToast('OS bloqueada: remova o bloqueio antes de trocar o técnico');return;}
    const belongsToAgenda=state.agenda?.schedules?.some(schedule=>schedule.items.some(item=>item.order.id===orderId)),scope=belongsToAgenda||!state.generated?'agenda':'generated',container=scope==='agenda'?state.agenda:state.generated,schedules=container?.schedules||[];
    state.detailId=null;showToast('Analisando técnicos e rotas...');const matrix=await buildScheduleMatrix(schedules,[order]),ranked=CORE.recommendWorkOrderAssignments(order,schedules,activeTechnicians(),{matrix}),byTechnician=[];ranked.forEach(option=>{if(!byTechnician.some(item=>item.technician.id===option.technician.id))byTechnician.push(option);});
    if(!byTechnician.length){render();showToast('Nenhum técnico possui um encaixe válido para esta OS');return;}
    state.pendingSuggestion={order,scope,matrix,options:byTechnician,selectedIndex:0};render({preserveAgendaScroll:scope==='agenda'});
  }
  /** Aplica o encaixe escolhido na prévia e salva somente após confirmação. */
  async function applyTechnicianSuggestion(){
    const analysis=state.pendingSuggestion,option=analysis?.options[analysis.selectedIndex];if(!analysis||!option)return;const container=analysis.scope==='generated'?state.generated:state.agenda,schedules=container?.schedules||[];
    const updated=replaceAffectedSchedules(schedules,{sourceKey:option.sourceKey,targetKey:option.targetKey,sourceSchedule:option.sourceSchedule,targetSchedule:option.schedule});
    if(analysis.scope==='generated'){state.generated={...state.generated,schedules:updated,matrix:analysis.matrix,unallocated:(state.generated.unallocated||[]).filter(item=>item.order.id!==analysis.order.id)};state.generated.allocated=state.generated.total-state.generated.unallocated.length;}
    else{state.agenda={date:state.date,schedules:updated,unallocated:(state.agenda?.unallocated||[]).filter(item=>item.order.id!==analysis.order.id),updatedAt:new Date().toISOString()};await RoutePilotAgendaStorage.saveAgenda(state.agenda);}
    state.pendingSuggestion=null;render({preserveAgendaScroll:analysis.scope==='agenda'});showToast(`OS enviada para ${option.technician.name}; rota recalculada`);
  }
  /** Abre uma OS no mapa principal e mantém a coordenada exata. */
  function openOrderMap(id){const order=state.orders.find(item=>item.id===id);if(!order)return;state.detailId=null;open('map');setTimeout(()=>identifyCoordinates(order.coords[0],order.coords[1],{source:'agenda'}),0);}
  /** Encaminha uma OS ao compartilhamento geográfico central. */
  function shareOrder(id){const order=state.orders.find(item=>item.id===id);if(!order)return;state.detailId=null;open('map');setTimeout(()=>openLocationShare(locationShareContext(order.coords[0],order.coords[1],{name:order.locality||'Atendimento',city:order.city})),0);}
  /** Trata cliques do workspace sem interferir nos eventos do mapa. */
  async function handleClick(event){
    const tabButton=event.target.closest('[data-main-tab]');if(tabButton){open(tabButton.dataset.mainTab);return;}
    const button=event.target.closest('[data-agenda-action]');if(!button)return;const action=button.dataset.agendaAction;
    if(action==='manageTechnicians'){state.manager=true;render();}
    if(action==='toggleTechnicianNames'){state.techniciansExpanded=!state.techniciansExpanded;render();}
    if(action==='closeManager'){state.manager=false;render();}
    if(action==='orderDetails'){state.detailId=button.dataset.id;render();}
    if(action==='closeOrderDetails'){state.detailId=null;render();}
    if(action==='generateRoutes')await generateRoutes();
    if(action==='sendToAgenda'){state.pendingAgenda={mode:null};render();}
    if(action==='cancelAgendaPreview'){state.pendingAgenda=null;render();}
    if(action==='chooseAgendaMode')prepareAgendaCandidate(button.dataset.mode);
    if(action==='applyAgenda')await applyAgenda();
    if(action==='openOrderMap')openOrderMap(button.dataset.id);
    if(action==='shareOrder')shareOrder(button.dataset.id);
    if(action==='copyOrderLocation'){const order=state.orders.find(item=>item.id===button.dataset.id);if(order)copyMapCoordinates(order.coords[0],order.coords[1]);}
    if(action==='importWorkOrderText')await importWorkOrderText();
    if(action==='suggestTechnician')await suggestTechnician(button.dataset.id);
    if(action==='cancelTechnicianSuggestion'){state.pendingSuggestion=null;render({preserveAgendaScroll:state.tab==='agenda'});}
    if(action==='selectTechnicianSuggestion'){state.pendingSuggestion.selectedIndex=Number(button.dataset.index)||0;render({preserveAgendaScroll:state.pendingSuggestion.scope==='agenda'});}
    if(action==='applyTechnicianSuggestion')await applyTechnicianSuggestion();
    if(action==='cancelScheduleMove'){state.pendingMove=null;render({preserveAgendaScroll:state.tab==='agenda'});}
    if(action==='confirmScheduleMove')await confirmScheduleMove();
    if(action==='requestRescheduleVisit')requestVisitAction(button.dataset.id,'reschedule');
    if(action==='requestCancelVisit')requestVisitAction(button.dataset.id,'cancel');
    if(action==='closeVisitAction'){state.pendingVisitAction=null;render({preserveAgendaScroll:true});}
    if(action==='confirmVisitAction')await confirmVisitAction();
    if(action==='previewLocation')previewLocation(Number(button.dataset.index));
    if(action==='confirmLocation')confirmLocation();
    if(action==='moreLocationOptions')runLocationSearch($agenda('workOrderAddress')?.value||'',{forceExternal:true});
    if(action==='selectLocationOnMap'){RoutePilotAgendaMap.pickNextPoint(selectManualLocation);showToast('Clique no mapa para selecionar o ponto');}
    if(action==='toggleAgendaFilter'){state.filterOpen=!state.filterOpen;render({preserveAgendaScroll:true});}
    if(action==='toggleUnassignedDrawer'){state.unassignedOpen=!state.unassignedOpen;render({preserveAgendaScroll:true});}
    if(action==='agendaFilterAll'){state.visibleTechnicianIds=new Set(activeTechnicians().map(item=>item.id));state.activeFilterId=null;render({preserveAgendaScroll:true});}
    if(action==='agendaFilterNone'){state.visibleTechnicianIds=new Set();state.activeFilterId=null;render({preserveAgendaScroll:true});}
    if(action==='openFilterEditor'){state.filterEditor=true;state.editFilterId=null;render({preserveAgendaScroll:true});}
    if(action==='closeFilterEditor'){state.filterEditor=false;state.editFilterId=null;render({preserveAgendaScroll:true});}
    if(action==='applySavedFilter'){const filter=state.filters.find(item=>item.id===button.dataset.id);if(filter){state.filterEditor=false;applyAgendaFilter(filter);}}
    if(action==='editSavedFilter'){state.editFilterId=button.dataset.id;render({preserveAgendaScroll:true});}
    if(action==='defaultSavedFilter'){state.filters=RoutePilotAgendaFilters.setDefault(state.filters,button.dataset.id);await persistFilters();render({preserveAgendaScroll:true});}
    if(action==='deleteSavedFilter'){await RoutePilotAgendaStorage.removeAgendaFilter(button.dataset.id);state.filters=RoutePilotAgendaFilters.removeFilter(state.filters,button.dataset.id);if(state.activeFilterId===button.dataset.id)state.activeFilterId=null;if(state.editFilterId===button.dataset.id)state.editFilterId=null;render({preserveAgendaScroll:true});}
    if(action==='removeOrder'){const order=state.orders.find(item=>item.id===button.dataset.id);if(order){order.archived=true;order.date='';await RoutePilotAgendaStorage.put('workOrders',order);state.generated=null;render();}}
    if(action==='datePrevious'||action==='dateNext'){const date=new Date(`${state.date}T12:00:00`);date.setDate(date.getDate()+(action==='dateNext'?1:-1));state.date=date.toISOString().slice(0,10);state.generated=null;state.agenda=await RoutePilotAgendaStorage.getAgenda(state.date)||null;render();}
    if(action==='moveTechnician'){const index=state.technicians.findIndex(item=>item.id===button.dataset.id),next=index+Number(button.dataset.direction);if(index>=0&&next>=0&&next<state.technicians.length){[state.technicians[index],state.technicians[next]]=[state.technicians[next],state.technicians[index]];state.technicians.forEach((item,position)=>item.displayOrder=position);await RoutePilotAgendaStorage.putMany('technicians',state.technicians);render();}}
  }
  /** Trata formulários de OS e técnicos. */
  async function handleSubmit(event){
    if(event.target.id==='workOrderForm'){event.preventDefault();await addWorkOrder(event.target);}
    if(event.target.id==='addTechnicianForm'){event.preventDefault();const data=new FormData(event.target),technician={id:makeId('tech'),name:String(data.get('name')).trim(),serviceArea:String(data.get('serviceArea')||'').trim(),active:true,defaultShifts:['morning','afternoon'],displayOrder:state.technicians.length,startLocation:null};state.technicians.push(technician);state.selected.add(technician.id);await RoutePilotAgendaStorage.put('technicians',technician);render();}
    if(event.target.id==='agendaFilterForm'){event.preventDefault();const data=new FormData(event.target),existing=state.filters.find(item=>item.id===data.get('id')),filter={id:existing?.id||makeId('agenda_filter'),name:String(data.get('name')).trim(),technicianIds:existing?.technicianIds||[...state.visibleTechnicianIds],showUnassigned:existing?.showUnassigned??state.showUnassigned,isDefault:data.has('isDefault')};state.filters=RoutePilotAgendaFilters.saveFilter(state.filters,filter);await persistFilters();state.editFilterId=null;state.activeFilterId=filter.id;render({preserveAgendaScroll:true});showToast('Filtro salvo');}
  }
  /** Limpa confirmação e devolve o turno para Qualquer. */
  function handleReset(event){if(event.target.id!=='workOrderForm')return;state.geocodingService?.cancel();clearTimeout(state.searchTimer);state.confirmedLocation=null;state.locationCandidate=null;state.searchResults=[];state.searchCanExpand=false;state.searchWarning='';RoutePilotAgendaMap.clearPreview();setTimeout(()=>{event.target.shift.value='any';showLocationSearch([],'');},0);}
  /** Mostra sugestões geográficas no formulário de OS. */
  function handleInput(event){
    if(event.target.id==='workOrderAddress'){state.confirmedLocation=null;state.locationCandidate=null;state.geocodingService?.cancel();clearTimeout(state.searchTimer);const query=event.target.value;if(!RoutePilotWorkOrderSearch.normalize(query)){state.searchResults=[];RoutePilotAgendaMap.clearPreview();showLocationSearch([],'');return;}state.searchTimer=setTimeout(()=>runLocationSearch(query),CONFIGURACAO_GEOCODIFICACAO.debounceMs);}
    if(event.target.id==='agendaFilterSearch'){state.filterQuery=event.target.value;const query=RoutePilotWorkOrderSearch.normalize(state.filterQuery);document.querySelectorAll('.agenda-filter-list label').forEach(label=>label.hidden=Boolean(query)&&!RoutePilotWorkOrderSearch.normalize(label.textContent).includes(query));}
  }
  /** Persiste disponibilidade, nome, base e data selecionada. */
  async function handleChange(event){
    if(event.target.id==='agendaDate'){state.date=event.target.value;state.generated=null;state.agenda=await RoutePilotAgendaStorage.getAgenda(state.date)||null;render();}
    if(event.target.dataset.agendaTechnician){event.target.checked?state.selected.add(event.target.dataset.agendaTechnician):state.selected.delete(event.target.dataset.agendaTechnician);}
    if(event.target.dataset.agendaFilterTech){event.target.checked?state.visibleTechnicianIds.add(event.target.dataset.agendaFilterTech):state.visibleTechnicianIds.delete(event.target.dataset.agendaFilterTech);state.activeFilterId=null;render({preserveAgendaScroll:true});}
    if(event.target.id==='agendaFilterUnassigned'){state.showUnassigned=event.target.checked;state.activeFilterId=null;render({preserveAgendaScroll:true});}
    if(event.target.id==='agendaSavedFilter'){const filter=state.filters.find(item=>item.id===event.target.value);if(filter)applyAgendaFilter(filter);}
    if(event.target.id==='workOrderTimeType'){const form=event.target.form,type=event.target.value;form.timeStart.disabled=type==='free';form.timeEnd.disabled=type!=='window';}
    const techId=event.target.dataset.techName||event.target.dataset.techArea||event.target.dataset.techActive;if(techId){const tech=technicianById(techId);if(event.target.dataset.techName)tech.name=event.target.value.trim()||tech.name;if(event.target.dataset.techArea)tech.serviceArea=event.target.value.trim();if(event.target.dataset.techActive)tech.active=event.target.checked;await RoutePilotAgendaStorage.put('technicians',tech);}
    if(event.target.dataset.techShift){const [id,shift]=event.target.dataset.techShift.split(':'),tech=technicianById(id),set=new Set(tech.defaultShifts);event.target.checked?set.add(shift):set.delete(shift);tech.defaultShifts=[...set];await RoutePilotAgendaStorage.put('technicians',tech);}
  }
  /** Guarda a origem do arrasto sem recalcular durante o movimento. */
  function handleDragStart(event){
    const generated=event.target.closest('[data-agenda-drag]'),scheduled=event.target.closest('[data-agenda-calendar-drag]'),unassigned=event.target.closest('[data-agenda-unscheduled-drag]'),element=generated||scheduled||unassigned;if(!element||element.getAttribute('draggable')!=='true')return;
    state.drag=generated?{scope:'generated',scheduleKey:generated.dataset.agendaDrag,index:Number(generated.dataset.index),orderId:generated.dataset.orderId}:scheduled?{scope:'agenda',scheduleKey:scheduled.dataset.agendaCalendarDrag,orderId:scheduled.dataset.orderId}:{scope:'agenda',scheduleKey:null,orderId:unassigned.dataset.agendaUnscheduledDrag};
    if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',state.drag.orderId);}element.classList.add('is-dragging');
  }
  /** Destaca somente destinos compatíveis com o tipo de arrasto atual. */
  function handleDragOver(event){
    if(!state.drag)return;const target=state.drag.scope==='generated'?event.target.closest('[data-agenda-drag],[data-agenda-schedule],[data-agenda-drop-technician]'):event.target.closest('[data-agenda-calendar-target]');if(!target)return;
    event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';document.querySelectorAll('.is-drop-target').forEach(item=>{if(item!==target){item.classList.remove('is-drop-target');delete item.dataset.dropTime;item.style.removeProperty('--agenda-drop-y');}});target.classList.add('is-drop-target');
    if(state.drag.scope==='agenda'){const rect=target.getBoundingClientRect(),minutes=Math.max(6*60,Math.min(19*60,Math.round((6*60+(event.clientY-rect.top)/64*60)/15)*15));target.dataset.dropTime=CORE.minutesToTime(minutes);target.style.setProperty('--agenda-drop-y',`${(minutes-6*60)/60*64}px`);}
  }
  /** Recalcula distância e horários uma única vez ao soltar o cartão. */
  function handleDrop(event){
    const drag=state.drag;if(!drag)return;
    if(drag.scope==='generated'){
      const row=event.target.closest('[data-agenda-drag]'),scheduleTarget=event.target.closest('[data-agenda-schedule]'),technicianTarget=event.target.closest('[data-agenda-drop-technician]');if(!row&&!scheduleTarget&&!technicianTarget)return;event.preventDefault();
      const targetKey=row?.dataset.agendaDrag||scheduleTarget?.dataset.agendaSchedule||null;
      if(targetKey===drag.scheduleKey&&row){const [technicianId,shiftId]=drag.scheduleKey.split(':'),schedule=state.generated?.schedules.find(item=>item.technician.id===technicianId&&item.shiftId===shiftId),to=Number(row.dataset.index),from=drag.index;state.drag=null;if(!schedule||from===to)return;const orders=schedule.items.map(item=>item.order);if(orders[from].locked||orders[to].locked){showToast('Uma OS bloqueada não pode ser movida');return;}const [moved]=orders.splice(from,1);orders.splice(to,0,moved);const result=CORE.recalculateSchedule(orders,schedule.technician,shiftId,{matrix:state.generated.matrix});if(!result.valid){showToast(`Não foi possível mover: ${moveFailureMessage(result.reason)}`);return;}Object.assign(schedule,result.schedule);render();return;}
      const [targetTechnicianId,targetShiftId]=targetKey?targetKey.split(':'):[technicianTarget.dataset.agendaDropTechnician,drag.scheduleKey?.split(':')[1]];const targetSchedule=state.generated?.schedules.find(item=>`${item.technician.id}:${item.shiftId}`===targetKey);queueScheduleMove({scope:'generated',orderId:drag.orderId,sourceKey:drag.scheduleKey,targetTechnicianId,targetShiftId,targetIndex:row?Number(row.dataset.index):targetSchedule?.items.length||0});return;
    }
    const column=event.target.closest('[data-agenda-calendar-target]');if(!column)return;event.preventDefault();const rect=column.getBoundingClientRect(),targetStart=Math.max(6*60,Math.min(19*60,Math.round((6*60+(event.clientY-rect.top)/64*60)/15)*15)),targetTechnician=technicianById(column.dataset.agendaCalendarTarget),preferredShift=shiftAtMinute(targetTechnician,targetStart);if(!preferredShift){handleDragEnd();showToast('Escolha um horário entre 08:00–12:00 ou 13:00–18:00');return;}queueScheduleMove({scope:'agenda',orderId:drag.orderId,sourceKey:drag.scheduleKey,targetTechnicianId:targetTechnician.id,targetShiftId:preferredShift,targetIndex:Number.MAX_SAFE_INTEGER,targetStart});
  }
  /** Limpa realces visuais quando o usuário cancela ou encerra o arrasto. */
  function handleDragEnd(){document.querySelectorAll('.is-dragging,.is-drop-target').forEach(item=>item.classList.remove('is-dragging','is-drop-target'));document.querySelectorAll('[data-drop-time]').forEach(item=>{delete item.dataset.dropTime;item.style.removeProperty('--agenda-drop-y');});state.drag=null;}
  /** Esc fecha primeiro a confirmação operacional que estiver aberta. */
  function handleKeydown(event){if(event.key!=='Escape')return;if(state.pendingMove){state.pendingMove=null;render({preserveAgendaScroll:state.tab==='agenda'});}else if(state.pendingVisitAction){state.pendingVisitAction=null;render({preserveAgendaScroll:state.tab==='agenda'});}else if(state.pendingSuggestion){state.pendingSuggestion=null;render({preserveAgendaScroll:state.tab==='agenda'});}}
  return {state,init,open,render,generateRoutes};
})();
