const hav=(a,b)=>{const R=6371000,t=x=>x*Math.PI/180,dl=t(b.latitude-a.latitude),dn=t(b.longitude-a.longitude);
 const h=Math.sin(dl/2)**2+Math.cos(t(a.latitude))*Math.cos(t(b.latitude))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
const walkMin=d=>Math.max(1,Math.round(d/80)); // fallback walking speed 80 m/min
module.exports={hav,walkMin};
