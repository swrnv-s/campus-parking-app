// Walking routes via any OSRM-compatible server (default: OpenStreetMap foot profile). Falls back to a straight-line estimate.
const {hav,walkMin}=require('../utils/distance');
const BASE=process.env.ROUTING_URL||'https://routing.openstreetmap.de/routed-foot';
const say=s=>{const m=s.maneuver||{},nm=s.name?` onto ${s.name}`:'';
 if(m.type==='depart')return 'Start walking'+(s.name?` on ${s.name}`:'');if(m.type==='arrive')return 'Arrive at the parking lot';
 if(m.type==='roundabout'||m.type==='rotary')return 'Take the roundabout'+nm;return (m.modifier?`Turn ${m.modifier}`:'Continue')+nm;};
async function walkingRoute(a,b){
 try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),5000);
  const res=await fetch(`${BASE}/route/v1/foot/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson&steps=true`,{signal:ctl.signal});clearTimeout(t);
  const j=await res.json();if(j.code!=='Ok')throw new Error('no route');const R=j.routes[0];
  return {source:'osrm',distanceMeters:R.distance,durationMinutes:Math.max(1,Math.round(R.duration/60)),geometry:R.geometry.coordinates,
   steps:R.legs.flatMap(l=>l.steps).map(s=>({instruction:say(s),distance:s.distance}))};
 }catch(e){const d=hav(a,b);return {source:'estimate',distanceMeters:d,durationMinutes:walkMin(d),geometry:[[a.longitude,a.latitude],[b.longitude,b.latitude]],
  steps:[{instruction:'Walk straight toward the parking lot (routing service unavailable)',distance:d}]};}}
module.exports={walkingRoute};
