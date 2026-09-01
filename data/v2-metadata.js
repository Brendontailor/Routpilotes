const ACCESS_TYPES=new Set(['urban','rural','highway','mixed','unknown']);
const ACCESS_SURFACES=new Set(['asphalt','paved','unpaved','mixed','unknown']);
const ACCESS_DIFFICULTIES=new Set(['easy','medium','difficult','unknown']);
const DATA_CONFIDENCE_LEVELS=new Set(['high','medium','approximate','unknown']);
const NOTE_TYPES=new Set(['general','access','warning','reference']);

function applyV2Defaults(item) {
  item.aliases=Array.isArray(item.aliases)?item.aliases:[];
  item.access={
    type:ACCESS_TYPES.has(item.access?.type)?item.access.type:'unknown',
    surface:ACCESS_SURFACES.has(item.access?.surface)?item.access.surface:'unknown',
    difficulty:ACCESS_DIFFICULTIES.has(item.access?.difficulty)?item.access.difficulty:'unknown',
    mainAccess:typeof item.access?.mainAccess==='string'?item.access.mainAccess:null
  };
  item.notes=Array.isArray(item.notes)?item.notes.filter(note=>note&&NOTE_TYPES.has(note.type)&&typeof note.text==='string'):[];
  item.dataQuality={
    confidence:DATA_CONFIDENCE_LEVELS.has(item.dataQuality?.confidence)?item.dataQuality.confidence:'unknown',
    source:typeof item.dataQuality?.source==='string'?item.dataQuality.source:null,
    sourceDate:typeof item.dataQuality?.sourceDate==='string'?item.dataQuality.sourceDate:null,
    reviewed:item.dataQuality?.reviewed===true
  };
}

points.forEach(applyV2Defaults);
regions.forEach(applyV2Defaults);

// Boundary names are existing registered data, so they are safe search aliases.
boundaries.features.forEach(feature=>{
  const point=points.find(item=>item.id===feature.properties.pointId);
  const alias=feature.properties.name;
  if(point&&alias&&alias!==point.name&&!point.aliases.includes(alias))point.aliases.push(alias);
});

