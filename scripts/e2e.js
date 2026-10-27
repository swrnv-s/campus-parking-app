// End-to-end test. Needs: server running, DB seeded (npm run seed).
// ADMIN_EMAIL=... ADMIN_PASSWORD=... [SLOW=1 for the 62s expiry test] node scripts/e2e.js   (Node 18+)
const base=process.env.BASE||'http://localhost:3000';let fails=0;
const client=()=>{let ck='';return async(m,u,b)=>{const r=await fetch(base+'/api'+u,{method:m,headers:{'content-type':'application/json',cookie:ck},body:b?JSON.stringify(b):undefined});
 const sc=r.headers.getSetCookie?.();if(sc?.length)ck=sc.map(c=>c.split(';')[0]).join('; ');let j={};try{j=await r.json()}catch{}return{s:r.status,j};};};
const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const rnd=()=>String(Math.floor(Math.random()*9000)+1000),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const adm=client(),A=client(),B=client(),t=Date.now();
 let r=await adm('POST','/auth/login',{email:process.env.ADMIN_EMAIL||'admin@campus.edu',password:process.env.ADMIN_PASSWORD||'admin123'});ok('admin login',r.s===200);
 for(const[c,n]of[[A,'a'],[B,'b']]){r=await c('POST','/auth/register',{name:'User '+n,email:`${n}${t}@t.edu`,password:'secret1',userType:'FACULTY'});ok('register '+n,r.s===200);}
 const plate='TN23AB'+rnd(),plate2='TN24CD'+rnd();
 const va=(await A('POST','/vehicles',{vehicleNumber:plate.replace(/(..)(..)(..)(....)/,'$1 $2 $3 $4'),vehicleType:'FOUR_WHEELER'})).j;ok('A registers vehicle',!!va._id);
 r=await B('POST','/vehicles',{vehicleNumber:plate.toLowerCase(),vehicleType:'FOUR_WHEELER'});ok('duplicate normalized number rejected',r.s===409);
 const vb=(await B('POST','/vehicles',{vehicleNumber:'TN99ZZ'+rnd(),vehicleType:'FOUR_WHEELER'})).j;
 const va2=(await A('POST','/vehicles',{vehicleNumber:plate2,vehicleType:'FOUR_WHEELER'})).j;
 r=await A('POST','/reservations',{vehicleId:va._id,slotId:'000000000000000000000000'});ok('unapproved vehicle cannot reserve',r.s>=400);
 const pend=(await adm('GET','/admin/vehicles/pending')).j;ok('admin sees pending',pend.some(v=>v._id===va._id));
 for(const v of[va,vb,va2])await adm('POST',`/admin/vehicles/${v._id}/approve`);
 for(const[c,v]of[[A,va],[A,va2],[B,vb]]){r=await c('POST','/passes',{vehicleId:v._id});ok('pass issued',r.s===200);}
 const lots=(await A('GET','/parking/lots')).j;let lot,slots;
 for(const l of lots){const s=(await A('GET',`/parking/lots/${l._id}/slots`)).j.filter(x=>x.vehicleType==='FOUR_WHEELER'&&x.status==='AVAILABLE'&&x.active);if(s.length>=3){lot=l;slots=s;break;}}
 if(!lot){console.log('Need a FOUR_WHEELER lot with 3+ free slots');process.exit(1);}
 const bld=(await A('GET','/buildings')).j,f=(await A('GET',`/parking/find?destinationBuildingId=${bld[bld.length>1?1:0]._id}&vehicleType=FOUR_WHEELER`)).j;
 ok('find parking returns distance & walking time',f.length&&f[0].distanceMeters>=0&&f[0].walkingMinutes>=1);
 const tok=async s=>(await adm('GET','/qr/'+s._id)).j.url.split('token=')[1];
 const [s1,s2,s3]=slots;
 r=await A('POST','/reservations',{vehicleId:va._id,slotId:s1._id});ok('A reserves slot 1',r.s===200);const res=r.j;
 r=await B('POST','/reservations',{vehicleId:vb._id,slotId:s1._id});ok('B cannot reserve same slot',r.s===409);
 r=await B('POST','/qr/verify',{token:await tok(s1)});ok("B's QR scan rejected",r.s===403);
 r=await A('POST','/qr/verify',{token:await tok(s2)});ok('A scanning wrong slot QR rejected',r.s===403);
 r=await A('POST','/reservations',{vehicleId:va2._id,slotId:s2._id});ok('A reserves slot 2 for 2nd vehicle',r.s===200);
 r=await A('POST','/qr/verify',{token:await tok(s1)});ok('A verifies slot 1 QR',r.s===200);const sess1=r.j;
 r=await A('POST','/qr/verify',{token:await tok(s2)});ok('A verifies slot 2 QR (2nd vehicle)',r.s===200);const sess2=r.j;
 const act=(await A('GET','/parking/sessions/active')).j;ok('two ACTIVE sessions for one user',act.length===2);
 ok('slot OCCUPIED',(await A('GET',`/parking/lots/${lot._id}/slots`)).j.find(x=>x._id===s1._id).status==='OCCUPIED');
 r=await A('POST','/reservations',{vehicleId:va._id,slotId:s3._id});ok('parked vehicle cannot reserve again',r.s===409);
 r=await A('POST',`/parking/sessions/${sess1._id}/leave`);ok('leave parking',r.s===200&&r.j.status==='COMPLETED');
 ok('slot AVAILABLE immediately',(await A('GET',`/parking/lots/${lot._id}/slots`)).j.find(x=>x._id===s1._id).status==='AVAILABLE');
 await A('POST',`/parking/sessions/${sess2._id}/leave`);
 r=await B('POST','/reservations',{vehicleId:vb._id,slotId:s3._id});ok('B reserves slot 3',r.s===200);
 r=await B('POST',`/reservations/${r.j._id}/cancel`);ok('cancel frees slot',r.s===200&&(await B('GET',`/parking/lots/${lot._id}/slots`)).j.find(x=>x._id===s3._id).status==='AVAILABLE');
 r=await adm('GET','/admin/statistics');ok('statistics available',r.s===200&&r.j.todaySessions>=2);
 const C=client();await C('POST','/auth/register',{name:'Stu',email:`s${t}@t.edu`,password:'secret1',userType:'STUDENT'});
 r=await C('POST','/vehicles',{vehicleType:'CYCLE'});ok('cycle registers without a number',r.s===200);
 r=await C('POST','/vehicles',{vehicleType:'CYCLE'});ok('second cycle registers (no index collision)',r.s===200);
 r=await B('POST','/vehicles',{vehicleType:'FOUR_WHEELER'});ok('motor vehicle without number rejected',r.s===400);
 // vehicle limit via settings
 await adm('PUT','/admin/settings',{maxVehiclesPerUser:2});r=await A('POST','/vehicles',{vehicleNumber:'TN55XY'+rnd(),vehicleType:'FOUR_WHEELER'});ok('limit enforced (max=2)',r.s===400);
 await adm('PUT','/admin/settings',{maxVehiclesPerUser:3});r=await A('POST','/vehicles',{vehicleNumber:'TN55XY'+rnd(),vehicleType:'FOUR_WHEELER'});ok('admin raising limit allows more',r.s===200);
 await adm('PUT','/admin/settings',{maxVehiclesPerUser:5});
 if(process.env.SLOW){await adm('PUT','/admin/settings',{reservationWindowMinutes:1});r=await B('POST','/reservations',{vehicleId:vb._id,slotId:s3._id});ok('reserve for expiry test',r.s===200);
  console.log('waiting 62s for expiry...');await sleep(62000);
  ok('reservation expired & slot AVAILABLE',(await B('GET','/reservations')).j.length===0&&(await B('GET',`/parking/lots/${lot._id}/slots`)).j.find(x=>x._id===s3._id).status==='AVAILABLE');
  await adm('PUT','/admin/settings',{reservationWindowMinutes:10});}
 console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
