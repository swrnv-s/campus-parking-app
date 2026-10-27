const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.getQrSlotid=w(async(q,r)=>{const s=await Slot.findById(id(q.params.slotId));if(!s)throw err(404,'Not found');
 const url=`${process.env.BASE_URL||'http://localhost:3000'}/qr/verify?token=${s.qrToken}`;r.json({slot:s.slotNumber,url,dataUrl:await QR.toDataURL(url,{width:300})});});
exports.postQrVerify=w(async(q,r)=>{
 const sl=await Slot.findOne({qrToken:String(q.body.token||'')});if(!sl)throw err(400,'Invalid QR');
 const res=await Reservation.findOne({userId:q.session.uid,status:'ACTIVE',slotId:sl._id,expiresAt:{$gt:new Date()}});
 if(!res)throw err(403,'No active reservation of yours for this slot');
 const ok=await Slot.findOneAndUpdate({_id:sl._id,status:'RESERVED'},{status:'OCCUPIED'});if(!ok)throw err(409,'Slot is no longer reserved');
 await Reservation.updateOne({_id:res._id},{status:'CONFIRMED'});
 r.json(await Session.create({userId:res.userId,vehicleId:res.vehicleId,parkingLotId:res.parkingLotId,slotId:res.slotId,startTime:new Date()}));});
