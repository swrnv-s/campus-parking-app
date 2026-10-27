// Reconciles slots, reservations and sessions after crashes/manual edits: npm run repair:parking
const mongoose=require('mongoose');const {Slot,Reservation,Session}=require('../models');const {expireReservations}=require('../services/expiryService');
(async()=>{await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/campus-parking');await expireReservations();
 const n={staleReservedFreed:0,staleOccupiedFreed:0,occupiedRestored:0,reservedRestored:0,orphanReservationsCancelled:0};
 const act=new Set((await Reservation.find({status:'ACTIVE'})).map(r=>String(r.slotId))),occ=new Set((await Session.find({status:'ACTIVE'})).map(s=>String(s.slotId)));
 for(const s of await Slot.find({status:{$in:['RESERVED','OCCUPIED']}})){const id=String(s._id);
  if(s.status==='RESERVED'&&!act.has(id)){s.status='AVAILABLE';await s.save();n.staleReservedFreed++;}
  else if(s.status==='OCCUPIED'&&!occ.has(id)){s.status='AVAILABLE';await s.save();n.staleOccupiedFreed++;}}
 for(const id of occ){n.occupiedRestored+=(await Slot.updateOne({_id:id,status:{$ne:'OCCUPIED'}},{status:'OCCUPIED'})).modifiedCount;}
 for(const rv of await Reservation.find({status:'ACTIVE'})){const s=await Slot.findById(rv.slotId);
  if(s&&s.status==='AVAILABLE'){s.status='RESERVED';await s.save();n.reservedRestored++;}
  else if(!s||s.status!=='RESERVED'){rv.status='CANCELLED';rv.cancelledAt=new Date();await rv.save();n.orphanReservationsCancelled++;}}
 console.log('Parking state repaired:',n);process.exit(0);})();
