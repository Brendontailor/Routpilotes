/* Recurso RoutePilot: provedores e matriz de distâncias. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoutePilotDistance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const EARTH_RADIUS_KM=6371;

  /** Calcula a distância geográfica direta entre duas coordenadas. */
  function getStraightLineDistance(a,b){
    const radians=value=>value*Math.PI/180;
    const dlat=radians(b.coords[0]-a.coords[0]),dlon=radians(b.coords[1]-a.coords[1]);
    const value=Math.sin(dlat/2)**2+Math.cos(radians(a.coords[0]))*Math.cos(radians(b.coords[0]))*Math.sin(dlon/2)**2;
    return EARTH_RADIUS_KM*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
  }

  /** Cria um provedor que separa distância direta, rota e duração estimada. */
  function createDistanceProvider({routeCalculator=null,averageSpeedKmh=35}={}){
    return {
      getStraightLineDistance,
      async getRouteDistance(a,b){
        if(!routeCalculator)return {distance:getStraightLineDistance(a,b),duration:null,geometry:null,fallback:true};
        try{
          const route=await routeCalculator(a.coords,b.coords);
          return {distance:route.distanceKm,duration:route.durationMinutes??null,geometry:route.geometry||null,fallback:false,source:route.source};
        }catch(error){
          return {distance:getStraightLineDistance(a,b),duration:null,geometry:null,fallback:true,error:error.message||String(error)};
        }
      },
      getRouteDuration(distanceKm){return Number.isFinite(distanceKm)&&averageSpeedKmh>0?distanceKm/averageSpeedKmh*60:null;}
    };
  }

  /** Mantém cada distância calculada para reutilização pelo comparador e otimizador. */
  class DistanceMatrix{
    constructor(points,provider,{mode='straight'}={}){
      this.points=[...points];this.provider=provider;this.mode=mode;this.cache=new Map();
      this.byId=new Map(this.points.map(point=>[point.id,point]));
    }
    key(a,b){return `${a.id}>${b.id}:${this.mode}`;}
    async get(a,b){
      if(a.id===b.id)return 0;
      const key=this.key(a,b);
      if(!this.cache.has(key)){
        const task=this.mode==='route'?this.provider.getRouteDistance(a,b).then(result=>result.distance):Promise.resolve(this.provider.getStraightLineDistance(a,b));
        this.cache.set(key,task);
        if(this.mode==='straight')this.cache.set(this.key(b,a),task);
      }
      return this.cache.get(key);
    }
    async build(){
      const values={};
      for(const point of this.points)values[point.id]={[point.id]:0};
      for(let i=0;i<this.points.length;i++)for(let j=0;j<this.points.length;j++){
        if(i===j)continue;
        values[this.points[i].id][this.points[j].id]=await this.get(this.points[i],this.points[j]);
      }
      return values;
    }
  }

  return {EARTH_RADIUS_KM,getStraightLineDistance,createDistanceProvider,DistanceMatrix};
});
