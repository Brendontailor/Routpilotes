/* Recurso RoutePilot: cadastro de OS, distribuição e agenda diária desktop. */
const RoutePilotAgenda=(()=>{
  const CONFIG=RoutePilotSchedulingConfig,CORE=RoutePilotSchedulingCore;
  const state={tab:'map',date:new Date().toISOString().slice(0,10),technicians:[],orders:[],selected:new Set(),confirmedLocation:null,locationCandidate:null,searchResults:[],searchTimer:null,geocodingService:null,searchCanExpand:false,searchWarning:'',generated:null,agenda:null,manager:false,detailId:null,pendingAgenda:null,drag:null,filters:[],visibleTechnicianIds:new Set(),showUnassigned:true,filterOpen:false,filterQuery:'',filterEditor:false,editFilterId:null,activeFilterId:null};
  const $agenda=id=>document.getElementById(id);
  const makeId=prefix=>crypto.randomUUID?`${prefix}_${crypto.randomUUID()}`:`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const technicianById=id=>state.technicians.find(item=>item.id===id);
  const serviceLabel=id=>CONFIG.SERVICE_TYPES[id]?.label||id;
  const shiftLabel=id=>CONFIG.SHIFTS[id]?.label||id;
  const visitLabel=order=>order.customerName||`OS ${order.number}`;
  const sameDayOrders=()=>state.orders.filter(order=>order.date===state.date);
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
    document.addEventListener('click',handleClick);document.addEventListener('submit',handleSubmit);document.addEventListener('reset',handleReset);document.addEventListener('input',handleInput);document.addEventListener('change',handleChange);document.addEventListener('dragstart',handleDragStart);document.addEventListener('dragover',handleDragOver);document.addEventListener('drop',handleDrop);
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
    if(state.filterEditor)root.insertAdjacentHTML('beforeend',renderFilterEditor());
    if(state.tab==='create'){RoutePilotAgendaMap.ensureMap();RoutePilotAgendaMap.render(state.generated?.schedules||[]);}
    if(scroll)requestAnimationFrame(()=>{const next=root.querySelector('.agenda-board');if(next){next.scrollTop=scroll.top;next.scrollLeft=scroll.left;}});
  }
  /** Monta os controles de data compartilhados pelas duas áreas. */
  function dateToolbar(title){return `<div class="operations-heading"><div><small>OPERAÇÃO DIÁRIA</small><h2>${title}</h2></div><div class="agenda-date-nav"><button data-agenda-action="datePrevious" aria-label="Dia anterior">‹</button><label>Data<input type="date" id="agendaDate" value="${state.date}"></label><button data-agenda-action="dateNext" aria-label="Próximo dia">›</button></div></div>`;}
  /** Renderiza seleção de técnicos, formulário de OS e resultado da distribuição. */
  function renderCreateRoute(){
    const orders=sameDayOrders(),technicians=activeTechnicians();
    return `<section class="route-creation">${dateToolbar('Criar rota')}<div class="route-builder-grid"><div class="route-builder-panel"><section class="technician-selection"><div class="section-title"><div><small>EQUIPE DO DIA</small><h3>Técnicos disponíveis</h3></div><button data-agenda-action="manageTechnicians">Gerenciar técnicos</button></div><div class="technician-chips">${technicians.map(item=>`<label><input type="checkbox" data-agenda-technician="${esc(item.id)}" ${state.selected.has(item.id)?'checked':''}><span>${esc(item.name)}<small>${esc(item.serviceArea||'Sem base definida')}</small></span></label>`).join('')}</div></section>${renderOrderForm()}<section class="work-order-list"><div class="section-title"><div><small>${orders.length} CADASTRADAS</small><h3>Ordens de serviço</h3></div></div>${orders.length?orders.map(renderOrderCard).join(''):'<p class="agenda-empty">Nenhuma OS cadastrada para esta data.</p>'}</section><button class="agenda-primary" data-agenda-action="generateRoutes" ${orders.length?'':'disabled'}>Gerar rota</button>${renderDistribution()}</div><aside class="operations-map-panel"><div class="map-panel-heading"><strong>Distribuição no mapa</strong><span>${state.generated?`${state.generated.allocated} alocadas`:'Aguardando geração'}</span></div><div id="operationsMap" aria-label="Mapa das rotas por técnico"></div></aside></div></section>`;
  }
  /** Renderiza o formulário de uma nova OS com restrições configuráveis. */
  function renderOrderForm(){
    const typeOptions=Object.entries(CONFIG.SERVICE_TYPES).map(([id,item])=>`<option value="${id}">${esc(item.label)}</option>`).join('');
    const techOptions=activeTechnicians().map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    return `<form id="workOrderForm" class="work-order-form"><div class="section-title"><div><small>NOVA VISITA</small><h3>Cadastrar atendimento</h3></div></div><div class="form-grid"><label>Nome do cliente<input name="customerName" required maxlength="100" autocomplete="off"></label><label>Tipo de serviço<select name="serviceType">${typeOptions}</select></label><label class="form-wide">Endereço/localidade<input id="workOrderAddress" name="address" required autocomplete="off" placeholder="Rua, número, bairro ou região"><div id="workOrderSuggestions" class="compare-suggestions work-order-suggestions" hidden></div><div id="workOrderLocationStatus" class="work-order-location-status" hidden></div></label><label>Turno<select name="shift">${Object.entries(CONFIG.SHIFTS).map(([id,item])=>`<option value="${id}">${item.label}</option>`).join('')}</select></label><label>Técnico obrigatório<select name="requiredTechnicianId"><option value="">Qualquer técnico</option>${techOptions}</select></label><label>Restrição de horário<select name="timeType" id="workOrderTimeType"><option value="free">Horário livre</option><option value="fixed">Horário exato</option><option value="window">Janela de horário</option></select></label><label>Início<input type="time" name="timeStart" disabled></label><label data-time-end>Fim da janela<input type="time" name="timeEnd" disabled></label><label>Posição fixa na rota<input type="number" name="fixedPosition" min="1" max="80" placeholder="Opcional"></label><label class="check-field"><input type="checkbox" name="highPriority"> Prioridade alta</label><label class="check-field"><input type="checkbox" name="locked"> Bloqueada</label><label class="form-wide">Observação operacional<textarea name="note" rows="2" maxlength="300"></textarea></label></div><input type="hidden" name="latitude"><input type="hidden" name="longitude"><input type="hidden" name="locality"><div class="form-actions"><button type="reset">Limpar</button><button class="agenda-primary" type="submit">Adicionar atendimento</button></div></form>`;
  }
  /** Resume um atendimento exibindo apenas os dados necessários à operação. */
  function renderOrderCard(order){return `<article class="work-order-card"><span class="service-dot" style="--service-color:${CONFIG.SERVICE_TYPES[order.serviceType].color}"></span><div><strong>${esc(visitLabel(order))}</strong><small>${esc(serviceLabel(order.serviceType))} · ${esc(shiftLabel(order.shift))}</small><p>${esc(order.locality||order.address)}</p></div><div class="order-badges">${order.highPriority?'<b>Prioridade</b>':''}${order.locked?'<b>Bloqueada</b>':''}</div><button data-agenda-action="orderDetails" data-id="${esc(order.id)}">Detalhes</button><button data-agenda-action="removeOrder" data-id="${esc(order.id)}" aria-label="Remover atendimento">×</button></article>`;}
  /** Exibe rotas por técnico/turno e motivos das OS não alocadas. */
  function renderDistribution(){
    const result=state.generated;if(!result)return '';
    const schedules=result.schedules.map(schedule=>`<article class="schedule-result"><div class="schedule-title"><div><strong>${esc(schedule.technician.name)}</strong><small>${shiftLabel(schedule.shiftId)} · ${Math.round(schedule.load*100)}% da capacidade</small></div><b>${schedule.distanceKm.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</b></div><ol>${schedule.items.map((item,index)=>`<li draggable="${!item.order.locked}" data-agenda-drag="${schedule.technician.id}:${schedule.shiftId}" data-index="${index}"><span>${index+1}</span><time>${CORE.minutesToTime(item.start)}</time><div><strong>${esc(visitLabel(item.order))}</strong><small>${esc(serviceLabel(item.order.serviceType))} · ${esc(item.order.locality||item.order.address)}</small>${item.areaReminder?`<em class="area-reminder">${esc(item.areaReminder)}</em>`:''}</div></li>`).join('')}</ol></article>`).join('');
    const unallocated=result.unallocated.length?`<section class="unallocated-panel"><h3>Atendimentos não alocados <span>${result.unallocated.length}</span></h3>${result.unallocated.map(item=>`<article><strong>${esc(visitLabel(item.order))}</strong><b>${item.reason}</b><p>${esc(item.message)}</p></article>`).join('')}</section>`:'';
    return `<section class="distribution-results"><div class="distribution-summary"><div><strong>${result.total}</strong><span>cadastradas</span></div><div><strong>${result.allocated}</strong><span>alocadas</span></div><div><strong>${result.unallocated.length}</strong><span>não alocadas</span></div><button class="agenda-primary" data-agenda-action="sendToAgenda" ${result.allocated?'':'disabled'}>Enviar para agenda</button></div>${schedules}${unallocated}</section>`;
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
  function previewLocation(index){const candidate=state.searchResults[index];if(!candidate)return;state.locationCandidate=candidate;state.confirmedLocation=null;RoutePilotAgendaMap.previewLocation(candidate);showLocationSearch(state.searchResults,locationFeedback(candidate));}
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
    const allTechnicians=activeTechnicians(),technicians=RoutePilotAgendaFilters.visibleTechnicians(allTechnicians,state.visibleTechnicianIds),agenda=state.agenda,items=agenda?.schedules?.flatMap(schedule=>schedule.items.map(item=>({...item,technicianId:schedule.technician.id})))||[];
    const startHour=6,endHour=19,rowHeight=64,totalHeight=(endHour-startHour)*rowHeight;
    const columns=[...technicians,...(state.showUnassigned?[{id:'unassigned',name:'Sem colaborador',serviceArea:''}]:[])];
    return `<section class="agenda-view">${dateToolbar('Agenda diária')}<div class="agenda-toolbar"><span>${esc(todayLabel(state.date))}</span><div class="agenda-filter-anchor"><button data-agenda-action="toggleAgendaFilter" aria-expanded="${state.filterOpen}">Técnicos: ${technicians.length} selecionados ▾</button>${state.filterOpen?renderAgendaFilter(allTechnicians):''}</div><button data-agenda-action="manageTechnicians">Gerenciar técnicos</button><button data-main-tab="create">Criar rota</button></div><div class="agenda-board" style="grid-template-columns:62px${columns.map(()=> ' 150px').join('')}"><div class="agenda-time-header"></div>${columns.map(item=>`<div class="agenda-tech-header"><strong>${esc(item.name)}</strong><small>${esc(item.serviceArea||'Atendimentos não alocados')}</small></div>`).join('')}<div class="agenda-time-axis" style="height:${totalHeight}px">${Array.from({length:endHour-startHour+1},(_,index)=>`<span style="top:${index*rowHeight}px">${String(startHour+index).padStart(2,'0')}:00</span>`).join('')}</div>${columns.map(technician=>`<div class="agenda-column" style="height:${totalHeight}px;background-size:100% ${rowHeight}px">${items.filter(item=>item.technicianId===technician.id).map(item=>renderAgendaBlock(item,startHour,rowHeight)).join('')}${technician.id==='unassigned'?(agenda?.unallocated||[]).map((entry,index)=>`<button class="agenda-unassigned" style="top:${index*58+8}px" data-agenda-action="orderDetails" data-id="${entry.order.id}"><strong>${esc(visitLabel(entry.order))}</strong><small>${esc(entry.reason)}</small></button>`).join(''):''}</div>`).join('')}</div></section>`;
  }
  /** Monta o filtro de visualização sem recalcular ou alterar a programação. */
  function renderAgendaFilter(technicians){
    const query=RoutePilotWorkOrderSearch.normalize(state.filterQuery),visible=technicians.filter(item=>!query||RoutePilotWorkOrderSearch.normalize(item.name).includes(query));
    return `<section class="agenda-filter-popover"><label>Filtro salvo<select id="agendaSavedFilter"><option value="">Seleção atual</option>${state.filters.map(filter=>`<option value="${esc(filter.id)}" ${filter.id===state.activeFilterId?'selected':''}>${esc(filter.name)}${filter.isDefault?' (padrão)':''}</option>`).join('')}</select></label><input id="agendaFilterSearch" placeholder="Buscar técnico..." value="${esc(state.filterQuery)}"><div class="agenda-filter-actions"><button data-agenda-action="agendaFilterAll">Todos</button><button data-agenda-action="agendaFilterNone">Nenhum</button></div><div class="agenda-filter-list">${visible.map(item=>`<label><input type="checkbox" data-agenda-filter-tech="${esc(item.id)}" ${state.visibleTechnicianIds.has(item.id)?'checked':''}> ${esc(item.name)}</label>`).join('')}</div><label class="agenda-filter-unassigned"><input type="checkbox" id="agendaFilterUnassigned" ${state.showUnassigned?'checked':''}> Sem colaborador</label><button class="agenda-primary" data-agenda-action="openFilterEditor">Salvar ou gerenciar filtros</button></section>`;
  }
  /** Permite criar, renomear, definir padrão e excluir filtros persistidos. */
  function renderFilterEditor(){
    const editing=state.filters.find(filter=>filter.id===state.editFilterId);
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Filtros da Agenda"><div class="modal-heading"><div><small>AGENDA</small><h2>Filtros de técnicos</h2></div><button data-agenda-action="closeFilterEditor">×</button></div><form id="agendaFilterForm" class="agenda-filter-form"><input type="hidden" name="id" value="${esc(editing?.id||'')}"><label>Nome do filtro<input name="name" required maxlength="60" value="${esc(editing?.name||'')}"></label><label><input type="checkbox" name="isDefault" ${editing?.isDefault?'checked':''}> Usar como padrão</label><button class="agenda-primary" type="submit">${editing?'Salvar alterações':'Salvar seleção atual'}</button></form><div class="saved-filter-list">${state.filters.length?state.filters.map(filter=>`<article><div><strong>${esc(filter.name)}</strong><small>${filter.technicianIds.length} técnicos${filter.showUnassigned?' · com Sem colaborador':''}${filter.isDefault?' · padrão':''}</small></div><button data-agenda-action="applySavedFilter" data-id="${esc(filter.id)}">Aplicar</button><button data-agenda-action="editSavedFilter" data-id="${esc(filter.id)}">Renomear</button><button data-agenda-action="defaultSavedFilter" data-id="${esc(filter.id)}">Padrão</button><button data-agenda-action="deleteSavedFilter" data-id="${esc(filter.id)}">Excluir</button></article>`).join(''):'<p class="agenda-empty">Nenhum filtro salvo.</p>'}</div></section></div>`;
  }
  /** Posiciona um bloco da agenda de acordo com início e duração. */
  function renderAgendaBlock(item,startHour,rowHeight){const top=(item.start-startHour*60)/60*rowHeight,height=Math.max(34,(item.end-item.start)/60*rowHeight);return `<button class="agenda-block" style="top:${top}px;height:${height}px;--service-color:${CONFIG.SERVICE_TYPES[item.order.serviceType].color}" data-agenda-action="orderDetails" data-id="${item.order.id}"><time>${CORE.minutesToTime(item.start)}–${CORE.minutesToTime(item.end)}</time><strong>${esc(visitLabel(item.order))}</strong><small>${esc(serviceLabel(item.order.serviceType))}</small><span>${esc(item.order.locality||item.order.address)}</span></button>`;}
  /** Exibe edição simples e não destrutiva dos técnicos. */
  function renderTechnicianManager(){return `<div class="agenda-modal-backdrop"><section class="agenda-modal technician-manager" role="dialog" aria-modal="true" aria-label="Gerenciar técnicos"><div class="modal-heading"><div><small>EQUIPE</small><h2>Gerenciar técnicos</h2></div><button data-agenda-action="closeManager">×</button></div><form id="addTechnicianForm" class="add-technician"><input name="name" placeholder="Nome do técnico" required><input name="serviceArea" placeholder="Base ou área"><button class="agenda-primary">Adicionar</button></form><div class="technician-manager-list">${state.technicians.sort((a,b)=>a.displayOrder-b.displayOrder).map((item,index)=>`<article><input data-tech-name="${item.id}" value="${esc(item.name)}" aria-label="Nome"><input data-tech-area="${item.id}" value="${esc(item.serviceArea||'')}" aria-label="Base"><label><input type="checkbox" data-tech-active="${item.id}" ${item.active?'checked':''}> Ativo</label><label><input type="checkbox" data-tech-shift="${item.id}:morning" ${item.defaultShifts.includes('morning')?'checked':''}> Manhã</label><label><input type="checkbox" data-tech-shift="${item.id}:afternoon" ${item.defaultShifts.includes('afternoon')?'checked':''}> Tarde</label><button data-agenda-action="moveTechnician" data-id="${item.id}" data-direction="-1" ${index?'':'disabled'}>↑</button><button data-agenda-action="moveTechnician" data-id="${item.id}" data-direction="1" ${index<state.technicians.length-1?'':'disabled'}>↓</button></article>`).join('')}</div><div class="modal-actions"><button data-agenda-action="closeManager">Concluir</button></div></section></div>`;}
  /** Mostra os campos operacionais e ações geográficas de uma OS. */
  function renderOrderDetails(id){const order=state.orders.find(item=>item.id===id);if(!order)return '';return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Detalhes do atendimento"><div class="modal-heading"><div><small>ATENDIMENTO</small><h2>${esc(visitLabel(order))}</h2></div><button data-agenda-action="closeOrderDetails">×</button></div><dl class="order-details">${order.customerName?`<dt>Cliente</dt><dd>${esc(order.customerName)}</dd>`:''}<dt>Serviço</dt><dd>${esc(serviceLabel(order.serviceType))}</dd><dt>Pesquisa original</dt><dd>${esc(order.searchedText||order.address)}</dd><dt>Endereço interpretado</dt><dd>${esc(order.address)}</dd><dt>Localidade</dt><dd>${esc(order.locality||'Não informada')}</dd><dt>Fonte</dt><dd>${esc(order.locationSource||'Cadastro anterior')}</dd><dt>Localização</dt><dd>${order.locationConfirmed?'Confirmada':'Cadastro anterior'}${order.locationApproximate?' · aproximada':''}</dd><dt>Turno</dt><dd>${esc(shiftLabel(order.shift))}</dd><dt>Restrição</dt><dd>${esc(order.timeConstraint.type)} ${esc(order.timeConstraint.start||'')}</dd><dt>Técnico obrigatório</dt><dd>${esc(technicianById(order.requiredTechnicianId)?.name||'Não')}</dd><dt>Observação</dt><dd>${esc(order.note||'Sem observação')}</dd></dl><div class="modal-actions"><button data-agenda-action="openOrderMap" data-id="${order.id}">Abrir no mapa</button><button data-agenda-action="copyOrderLocation" data-id="${order.id}">Copiar localização</button><button class="agenda-primary" data-agenda-action="shareOrder" data-id="${order.id}">Compartilhar</button></div></section></div>`;}
  /** Apresenta a escolha segura quando a data já possui programação. */
  function renderAgendaPreview(){
    const existing=state.agenda?.schedules?.reduce((sum,schedule)=>sum+schedule.items.length,0)||0,newCount=state.generated?.allocated||0,preview=state.pendingAgenda;
    const changeRows=preview?.changes?.details?.slice(0,8).map(item=>`<li><strong>${esc(item.label)}</strong><span>${esc(item.text)}</span></li>`).join('')||'';
    return `<div class="agenda-modal-backdrop"><section class="agenda-modal" role="dialog" aria-modal="true" aria-label="Prévia da agenda"><div class="modal-heading"><div><small>PRÉVIA</small><h2>${preview?.candidate?'Revise antes de aplicar':existing?'Agenda já possui OS':'Enviar para agenda'}</h2></div><button data-agenda-action="cancelAgendaPreview">×</button></div>${preview?.candidate?`<div class="preview-summary"><p><strong>${preview.changes.technicianChanges}</strong> trocaram de técnico</p><p><strong>${preview.changes.timeChanges}</strong> mudaram de horário</p><p><strong>${preview.changes.newOrders}</strong> novas OS encaixadas · ${preview.candidate.unallocated.length} não alocadas</p><p>Distância atual: ${preview.changes.currentDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km · Nova: ${preview.changes.newDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km</p></div>${changeRows?`<ul class="preview-changes">${changeRows}</ul>`:''}<div class="modal-actions"><button class="agenda-primary" data-agenda-action="applyAgenda">Aplicar nova agenda</button><button data-agenda-action="cancelAgendaPreview">Cancelar</button></div>`:`<div class="preview-summary"><p><strong>${existing}</strong> OS já existentes</p><p><strong>${newCount}</strong> OS da nova distribuição</p><p>Nenhuma alteração será aplicada antes da confirmação.</p></div>${existing?`<div class="agenda-choice"><button data-agenda-action="chooseAgendaMode" data-mode="reoptimize"><strong>Reotimizar agenda atual + novas OS</strong><span>Pode alterar técnico, ordem e horário de OS não bloqueadas.</span></button><button data-agenda-action="chooseAgendaMode" data-mode="fit"><strong>Manter agenda e encaixar novas</strong><span>Preserva a programação atual.</span></button></div>`:'<div class="modal-actions"><button class="agenda-primary" data-agenda-action="chooseAgendaMode" data-mode="replace">Preparar agenda</button><button data-agenda-action="cancelAgendaPreview">Cancelar</button></div>'}`}</section></div>`;
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
    const orders=sameDayOrders();if(!orders.length)return;showToast('Calculando distribuição...');
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
    const order={id:makeId('os'),customerName,date:state.date,serviceType:data.get('serviceType'),addressInput:originalSearch,formattedAddress,searchedText:originalSearch,address:formattedAddress,latitude,longitude,coords:[latitude,longitude],locality:place.locality||place.name||'',city:place.city||'',locationSource:place.source||'local',locationConfirmed:true,locationApproximate:Boolean(place.approximate),shift:data.get('shift')||'any',highPriority:data.has('highPriority'),locked:data.has('locked'),fixedPosition:Number.isInteger(fixedPosition)&&fixedPosition>0?fixedPosition:null,requiredTechnicianId:data.get('requiredTechnicianId')||null,note:String(data.get('note')||'').trim(),timeConstraint:{type:data.get('timeType'),start:data.get('timeStart')||null,end:data.get('timeEnd')||null},createdAt:new Date().toISOString()};
    state.orders.push(order);await RoutePilotAgendaStorage.put('workOrders',order);state.confirmedLocation=null;state.locationCandidate=null;state.searchResults=[];state.generated=null;RoutePilotAgendaMap.clearPreview();form.reset();render();showToast(`Atendimento de ${order.customerName} adicionado`);
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
  async function applyAgenda(){const candidate=state.pendingAgenda?.candidate;if(!candidate)return;state.agenda={date:state.date,schedules:candidate.schedules,unallocated:candidate.unallocated,updatedAt:new Date().toISOString()};await RoutePilotAgendaStorage.saveAgenda(state.agenda);state.pendingAgenda=null;state.tab='agenda';render();$agenda('operationsWorkspace').scrollTop=0;showToast('Agenda atualizada');}
  /** Abre uma OS no mapa principal e mantém a coordenada exata. */
  function openOrderMap(id){const order=state.orders.find(item=>item.id===id);if(!order)return;state.detailId=null;open('map');setTimeout(()=>identifyCoordinates(order.coords[0],order.coords[1],{source:'agenda'}),0);}
  /** Encaminha uma OS ao compartilhamento geográfico central. */
  function shareOrder(id){const order=state.orders.find(item=>item.id===id);if(!order)return;state.detailId=null;open('map');setTimeout(()=>openLocationShare(locationShareContext(order.coords[0],order.coords[1],{name:order.locality||'Atendimento',city:order.city})),0);}
  /** Trata cliques do workspace sem interferir nos eventos do mapa. */
  async function handleClick(event){
    const tabButton=event.target.closest('[data-main-tab]');if(tabButton){open(tabButton.dataset.mainTab);return;}
    const button=event.target.closest('[data-agenda-action]');if(!button)return;const action=button.dataset.agendaAction;
    if(action==='manageTechnicians'){state.manager=true;render();}
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
    if(action==='previewLocation')previewLocation(Number(button.dataset.index));
    if(action==='confirmLocation')confirmLocation();
    if(action==='moreLocationOptions')runLocationSearch($agenda('workOrderAddress')?.value||'',{forceExternal:true});
    if(action==='selectLocationOnMap'){RoutePilotAgendaMap.pickNextPoint(selectManualLocation);showToast('Clique no mapa para selecionar o ponto');}
    if(action==='toggleAgendaFilter'){state.filterOpen=!state.filterOpen;render({preserveAgendaScroll:true});}
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
  function handleDragStart(event){const row=event.target.closest('[data-agenda-drag]');if(!row||row.getAttribute('draggable')!=='true')return;state.drag={scheduleKey:row.dataset.agendaDrag,index:Number(row.dataset.index)};event.dataTransfer.effectAllowed='move';row.classList.add('is-dragging');}
  /** Permite o drop somente dentro da mesma rota de técnico e turno. */
  function handleDragOver(event){const row=event.target.closest('[data-agenda-drag]');if(row&&state.drag?.scheduleKey===row.dataset.agendaDrag)event.preventDefault();}
  /** Recalcula distância e horários uma única vez ao soltar o cartão. */
  function handleDrop(event){
    const row=event.target.closest('[data-agenda-drag]');if(!row||!state.drag||row.dataset.agendaDrag!==state.drag.scheduleKey)return;event.preventDefault();
    const [technicianId,shiftId]=state.drag.scheduleKey.split(':'),schedule=state.generated?.schedules.find(item=>item.technician.id===technicianId&&item.shiftId===shiftId),to=Number(row.dataset.index),from=state.drag.index;state.drag=null;if(!schedule||from===to)return;
    const orders=schedule.items.map(item=>item.order);if(orders[from].locked||orders[to].locked){showToast('Uma OS bloqueada não pode ser movida');return;}const [moved]=orders.splice(from,1);orders.splice(to,0,moved);
    const result=CORE.recalculateSchedule(orders,schedule.technician,shiftId,{matrix:state.generated.matrix});if(!result.valid){showToast(`Não foi possível mover: ${CONFIG.UNALLOCATED_REASONS[result.reason]}`);return;}Object.assign(schedule,result.schedule);render();
  }
  return {state,init,open,render,generateRoutes};
})();
