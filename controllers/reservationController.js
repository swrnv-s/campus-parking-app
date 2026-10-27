const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.postReservations=w(async(q,r)=>{const u=await me(q),s=await getSettings();
 const v=await Vehicle.findOne({_id:id(q.body.vehicleId),userId:u._id,active:true});if(!v)throw err(404,'Vehicle not found');
 if(v.approvalStatus!=='APPROVED')throw err(403,'Vehicle not approved');
 if(!await Pass.exists({vehicleId:v._id,status:'ACTIVE',expiresAt:{$gt:new Date()}}))throw err(403,'No valid parking pass');
 if(await Session.exists({vehicleId:v._id,status:'ACTIVE'})||await Reservation.exists({vehicleId:v._id,status:'ACTIVE'}))throw err(409,'Vehicle already parked or reserved');
 const sl=await Slot.findById(id(q.body.slotId));if(!sl||!sl.active)throw err(404,'Slot unavailable');
 if(sl.vehicleType!==v.vehicleType)throw err(400,'Slot type incompatible with vehicle');
 const got=await Slot.findOneAndUpdate({_id:sl._id,status:'AVAILABLE',active:true},{status:'RESERVED'}); // atomic claim
 if(!got)throw err(409,'Slot not available');
 try{r.json(await Reservation.create({userId:u._id,vehicleId:v._id,parkingLotId:sl.parkingLotId,slotId:sl._id,expiresAt:new Date(Date.now()+s.reservationWindowMinutes*6e4)}));}
 catch(e){await Slot.updateOne({_id:sl._id},{status:'AVAILABLE'});throw e;}});
exports.getReservations=w(async(q,r)=>r.json(await Reservation.find({userId:q.session.uid,status:'ACTIVE'}).populate('vehicleId slotId parkingLotId')));
exports.postReservationsIdCancel=w(async(q,r)=>{const x=await Reservation.findOneAndUpdate({_id:id(q.params.id),userId:q.session.uid,status:'ACTIVE',expiresAt:{$gt:new Date()}},{status:'CANCELLED',cancelledAt:new Date()});
 if(!x)throw err(400,'No active reservation');await Slot.updateOne({_id:x.slotId,status:'RESERVED'},{status:'AVAILABLE'});r.json({ok:true});});
