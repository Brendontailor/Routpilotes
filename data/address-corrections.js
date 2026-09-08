/* Enderecos conferidos manualmente quando ainda nao existem na base aberta. */
(function(root,factory){
  const addresses=factory();
  if(typeof module==='object'&&module.exports)module.exports=addresses;
  root.RoutePilotAddressCorrections=addresses;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return Object.freeze([
    Object.freeze({
      id:'address_pelotas_fragata_rozalvo_mendes_180',
      kind:'address',
      name:'Rua Rozalvo Mendes, 180',
      formattedAddress:'Rua Rozalvo Mendes, 180',
      street:'Rua Rozalvo Mendes',
      houseNumber:'180',
      aliases:['R. Rozalvo Mendes, 180','Rosalvo Mendes, 180'],
      city:'Pelotas',
      cityName:'Pelotas',
      region:'pelotas_urbana',
      locality:'Fragata',
      context:'Fragata, Pelotas',
      coords:[-31.739210888312844,-52.39853950331596],
      boundaryId:null,
      source:'user_verified',
      approximate:false,
      localPriority:180
    })
  ]);
});
