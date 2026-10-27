const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.getAdminStatistics=w(async(q,r)=>{const today=new Date();today.setHours(0,0,0,0);const c={};
 (await Slot.aggregate([{$match:{active:true}},{$group:{_id:'$status',n:{$sum:1}}}])).forEach(x=>c[x._id]=x.n);
 const avg=await Session.aggregate([{$match:{status:'COMPLETED'}},{$group:{_id:null,a:{$avg:'$durationMinutes'}}}]);
 const top=await Session.aggregate([{$group:{_id:'$parkingLotId',n:{$sum:1}}},{$sort:{n:-1}},{$limit:1},{$lookup:{from:'parkinglots',localField:'_id',foreignField:'_id',as:'l'}}]);
 const peak=await Session.aggregate([{$group:{_id:{$hour:'$startTime'},n:{$sum:1}}},{$sort:{n:-1}},{$limit:3}]);
 r.json({users:await User.countDocuments(),vehicles:await Vehicle.countDocuments({active:true}),pendingVehicles:await Vehicle.countDocuments({active:true,approvalStatus:'PENDING'}),
  slots:c,totalSlots:Object.values(c).reduce((a,b)=>a+b,0),activeSessions:await Session.countDocuments({status:'ACTIVE'}),todaySessions:await Session.countDocuments({startTime:{$gte:today}}),
  avgDurationMinutes:Math.round(avg[0]?.a||0),mostUsedLot:top[0]?.l[0]?.name||null,peakHours:peak.map(p=>({hour:p._id,sessions:p.n}))});});
exports.getStatisticsMy=w(async(q,r)=>{const ss=await Session.find({userId:q.session.uid}).populate('parkingLotId','name');const cnt={};
 ss.forEach(s=>{const n=s.parkingLotId?.name;cnt[n]=(cnt[n]||0)+1;});
 r.json({totalSessions:ss.length,totalMinutes:ss.reduce((a,s)=>a+(s.durationMinutes||0),0),mostUsedLot:Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||null});});
