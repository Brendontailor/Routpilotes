/* Recurso RoutePilot: revisão dos dados operacionais. */
/** Guia: Executa uma etapa auxiliar em revisão dos dados operacionais (`issueGroups`). */
function issueGroups(items) {
  const groups=new Map();
  items.forEach(issue=>groups.set(issue.code,(groups.get(issue.code)||[]).concat(issue)));
  return [...groups.entries()].map(([code,group])=>`<details class="review-issue"><summary><span>${group.length}</span>${esc(group[0].message.replace(/:.*/,''))}</summary><ul>${group.slice(0,30).map(issue=>`<li>${esc(issue.message)}</li>`).join('')}${group.length>30?`<li>Mais ${group.length-30} itens.</li>`:''}</ul></details>`).join('');
}

/** Guia: Exibe o conteúdo solicitado em revisão dos dados operacionais (`openDataReview`). */
function openDataReview() {
  toolsOpen=true;$('toolsButton').setAttribute('aria-pressed','true');
  const report=validateRoutePilotData({log:false}),panel=$('toolsPanel');panel.hidden=false;
  panel.innerHTML=`<div class="inspector-heading"><div><small>QUALIDADE DA BASE</small><h2>Revisão dos dados</h2></div><button data-action="closeTools" aria-label="Fechar">&times;</button></div>
    <div class="review-summary"><span><b>${report.counts.points}</b> locais</span><span><b>${report.counts.regions}</b> regiões</span><span><b>${report.counts.references}</b> referências</span></div>
    <div class="review-totals"><span class="is-error"><b>${report.summary.errors}</b> erros</span><span class="is-warning"><b>${report.summary.warnings}</b> avisos</span><span><b>${report.summary.information}</b> informações</span></div>
    <section class="review-section"><h3>ERROS</h3>${report.errors.length?issueGroups(report.errors):'<p class="review-ok">Nenhum erro estrutural encontrado.</p>'}</section>
    <section class="review-section"><h3>AVISOS</h3>${report.warnings.length?issueGroups(report.warnings):'<p class="review-ok">Nenhum aviso.</p>'}</section>
    <section class="review-section"><h3>INFORMAÇÕES</h3><div class="review-facts"><p>${report.summary.informativeNearby} proximidades ainda informativas</p><p>${report.summary.unknownAccess} locais sem acesso classificado</p><p>${report.summary.missingSource} locais sem fonte informada</p><p>${report.summary.unknownConfidence} locais sem confiança informada</p><p>${report.summary.notReviewed} locais ainda não revisados</p></div></section>
    <p class="review-footnote">Dados desconhecidos permanecem como não informados. O RoutePilot não cria coordenadas ou classificações por suposição.</p>`;
}
