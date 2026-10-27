const {Reservation,Slot,Pass}=require('../models');
async function expireReservations(){
 const old=await Reservation.find({status:'ACTIVE',expiresAt:{$lt:new Date()}});
 for(const r of old){const u=await Reservation.updateOne({_id:r._id,status:'ACTIVE'},{status:'EXPIRED'});
  if(u.modifiedCount)await Slot.updateOne({_id:r.slotId,status:'RESERVED'},{status:'AVAILABLE'});}
 await Pass.updateMany({status:'ACTIVE',expiresAt:{$lt:new Date()}},{status:'EXPIRED'});
}
module.exports={expireReservations};
