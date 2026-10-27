// Usage: ADMIN_EMAIL=a@x.edu ADMIN_PASSWORD=secret npm run seed
const mongoose=require('mongoose'),bcrypt=require('bcrypt'),crypto=require('crypto');const M=require('../models');
(async()=>{await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/campus-parking');await M.getSettings();
 const email=(process.env.ADMIN_EMAIL||'admin@campus.edu').toLowerCase();
 if(!await M.User.exists({email}))await M.User.create({name:'Admin',email,userType:'ADMIN',passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD||'admin123',10)});
 if(!await M.Building.countDocuments()){
  const B=await M.Building.insertMany([{name:'Building 1',code:'B1',location:{latitude:13.0827,longitude:80.2707}},{name:'Building 2',code:'B2',location:{latitude:13.0835,longitude:80.2717}},{name:'Building 3',code:'B3',location:{latitude:13.0845,longitude:80.2730}}]);
  const defs=[[0,'Building 1 Parking','P1','A','FOUR_WHEELER'],[0,'Cycle Parking','C1','C','CYCLE'],[2,'Guest Parking','P3','D','TWO_WHEELER']];
  for(const[bi,name,code,pre,vt]of defs){const l=await M.Lot.create({buildingId:B[bi]._id,name,code,location:{latitude:B[bi].location.latitude+.0004,longitude:B[bi].location.longitude+.0004}});
   await M.Slot.insertMany(Array.from({length:8},(_,i)=>({parkingLotId:l._id,slotNumber:pre+String(i+1).padStart(2,'0'),vehicleType:vt,position:{x:(i%4)*90+10,y:Math.floor(i/4)*80+10},qrToken:crypto.randomBytes(16).toString('hex')})));}}
 console.log('Seeded. Admin:',email);process.exit(0);})();
