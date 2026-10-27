const {validateMotorNumber}=require('../utils/vehicleNumber');const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.getVehicles=w(async(q,r)=>{const vs=await Vehicle.find({userId:q.session.uid,active:true}).lean();
 for(const v of vs){v.pass=await Pass.findOne({vehicleId:v._id,status:'ACTIVE'});v.parked=!!await Session.exists({vehicleId:v._id,status:'ACTIVE'});}r.json(vs);});
exports.postVehicles=w(async(q,r)=>{const u=await me(q),s=await getSettings(),{vehicleNumber,vehicleType,model,color}=q.body;
 if(!ELIGIBLE[u.userType].includes(vehicleType))throw err(400,'Choose an eligible vehicle type');
 if(await Vehicle.countDocuments({userId:u._id,active:true})>=s.maxVehiclesPerUser)throw err(400,`Max ${s.maxVehiclesPerUser} vehicles allowed`);
 let num=String(vehicleNumber||'').trim().replace(/\s+/g,' '),n;
 if(vehicleType==='CYCLE'){num=num||'CYCLE-'+crypto.randomBytes(3).toString('hex').toUpperCase();n=undefined;} // cycles: no registration number, never unique-checked
 else{num=num.toUpperCase();n=norm(num);const bad=validateMotorNumber(n);if(bad)throw err(400,bad);}
 r.json(await Vehicle.create({userId:u._id,vehicleNumber:num,normalizedVehicleNumber:n,vehicleType,model,color}));});
exports.deleteVehiclesId=w(async(q,r)=>{const v=await Vehicle.findOne({_id:id(q.params.id),userId:q.session.uid,active:true});if(!v)throw err(404,'Not found');
 if(await Session.exists({vehicleId:v._id,status:'ACTIVE'})||await Reservation.exists({vehicleId:v._id,status:'ACTIVE'}))throw err(400,'Vehicle is parked or reserved');
 v.active=false;v.deregisteredAt=new Date();await v.save();await Pass.updateMany({vehicleId:v._id,status:'ACTIVE'},{status:'REVOKED'});r.json({ok:true});});
exports.getVehiclesId=w(async(q,r)=>{const v=await Vehicle.findOne({_id:id(q.params.id),userId:q.session.uid}).lean();if(!v)throw err(404,'Not found');
 v.parked=!!await Session.exists({vehicleId:v._id,status:'ACTIVE'});v.pass=await Pass.findOne({vehicleId:v._id}).sort('-createdAt');
 v.history=await Session.find({vehicleId:v._id}).sort('-startTime').limit(20).populate('slotId','slotNumber');r.json(v);});
exports.putVehiclesId=w(async(q,r)=>{const v=await Vehicle.findOne({_id:id(q.params.id),userId:q.session.uid,active:true});if(!v)throw err(404,'Not found');
 for(const k of['model','color'])if(q.body[k]!==undefined)v[k]=String(q.body[k]).slice(0,60); // number/type are immutable after registration
 await v.save();r.json(v);});
