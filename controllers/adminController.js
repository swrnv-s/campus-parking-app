const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.getAdminVehiclesPending=w(async(q,r)=>r.json(await Vehicle.find({approvalStatus:'PENDING',active:true}).populate('userId','name email userType')));
exports.postAdminVehiclesIdApprove=w(async(q,r)=>{const v=await Vehicle.findOneAndUpdate({_id:id(q.params.id),active:true,approvalStatus:'PENDING'},{approvalStatus:'APPROVED',approvedBy:q.session.uid,approvedAt:new Date()});
 if(!v)throw err(400,'Not pending');r.json({ok:true});});
exports.postAdminVehiclesIdReject=w(async(q,r)=>{const v=await Vehicle.findOneAndUpdate({_id:id(q.params.id),active:true,approvalStatus:'PENDING'},{approvalStatus:'REJECTED',rejectionReason:q.body.reason||''});
 if(!v)throw err(400,'Not pending');r.json({ok:true});});
exports.deleteAdminBuildingsId=w(async(q,r)=>{await Building.findByIdAndUpdate(id(q.params.id),{active:false});r.json({ok:true});});
exports.deleteAdminParkingLotsId=w(async(q,r)=>{await Lot.findByIdAndUpdate(id(q.params.id),{active:false});r.json({ok:true});});
exports.deleteAdminParkingSlotsId=w(async(q,r)=>{const s=await Slot.findById(id(q.params.id));if(!s)throw err(404,'Not found');
 if(['RESERVED','OCCUPIED'].includes(s.status))throw err(400,'Slot is in use');await s.deleteOne();r.json({ok:true});});
exports.getAdminVehicles=w(async(q,r)=>r.json(await Vehicle.find({...(q.query.status&&{approvalStatus:q.query.status})}).sort('-updatedAt').limit(200).populate('userId','name email userType').populate('approvedBy','name')));
exports.postAdminVehiclesIdRevoke=w(async(q,r)=>{const v=await Vehicle.findOneAndUpdate({_id:id(q.params.id),active:true,approvalStatus:'APPROVED'},{approvalStatus:'REVOKED',rejectionReason:q.body.reason||''});
 if(!v)throw err(400,'Not an approved vehicle');await Pass.updateMany({vehicleId:v._id,status:'ACTIVE'},{status:'REVOKED'});
 const rs=await Reservation.find({vehicleId:v._id,status:'ACTIVE'});for(const x of rs){await Reservation.updateOne({_id:x._id},{status:'CANCELLED',cancelledAt:new Date()});await Slot.updateOne({_id:x.slotId,status:'RESERVED'},{status:'AVAILABLE'});}
 r.json({ok:true});});
exports.postAdminPassesIdRevoke=w(async(q,r)=>{const p=await Pass.findOneAndUpdate({_id:id(q.params.id),status:'ACTIVE'},{status:'REVOKED'});if(!p)throw err(400,'Pass not active');r.json({ok:true});});
exports.getAdminSessions=w(async(q,r)=>r.json(await Session.find().sort('-startTime').limit(200).populate('userId','name').populate('vehicleId slotId').populate({path:'parkingLotId',populate:'buildingId'})));
exports.getAdminSettings=w(async(q,r)=>r.json(await getSettings()));
exports.putAdminSettings=w(async(q,r)=>{const s=await getSettings();
 for(const k of['maxVehiclesPerUser','guestPassValidityHours','parkingPassValidityHours','reservationWindowMinutes']){
  if(q.body[k]!==undefined){const n=Number(q.body[k]);if(!(n>=1))throw err(400,k+' must be >= 1');s[k]=n;}}
 s.updatedBy=q.session.uid;await s.save();r.json(s);});

// ---- validated create/update for buildings, lots and slots
const str=(v,n=80)=>typeof v==='string'&&v.trim()?v.trim().slice(0,n):null;
const geo=l=>l&&l.latitude!==''&&l.longitude!==''&&Number.isFinite(+l.latitude)&&Number.isFinite(+l.longitude)&&Math.abs(+l.latitude)<=90&&Math.abs(+l.longitude)<=180?{latitude:+l.latitude,longitude:+l.longitude}:null;
const TYPES=['TWO_WHEELER','FOUR_WHEELER','CYCLE'];
exports.postAdminBuildings=w(async(q,r)=>{const name=str(q.body.name),code=str(q.body.code,20),location=geo(q.body.location);
 if(!name||!code||!location)throw err(400,'Name, code and valid coordinates are required');r.json(await Building.create({name,code,location}));});
exports.putAdminBuildingsId=w(async(q,r)=>{const b=await Building.findById(id(q.params.id));if(!b)throw err(404,'Not found');const d=q.body;
 if(d.name!==undefined){if(!str(d.name))throw err(400,'Name required');b.name=str(d.name);}
 if(d.code!==undefined){if(!str(d.code,20))throw err(400,'Code required');b.code=str(d.code,20);}
 if(d.location!==undefined){const g=geo(d.location);if(!g)throw err(400,'Invalid coordinates');b.location=g;}await b.save();r.json(b);});
exports.postAdminParkingLots=w(async(q,r)=>{const bl=await Building.findOne({_id:id(q.body.buildingId),active:true});if(!bl)throw err(400,'Choose an existing building');
 const name=str(q.body.name),code=str(q.body.code,20),location=geo(q.body.location);if(!name||!code||!location)throw err(400,'Name, code and valid coordinates are required');
 r.json(await Lot.create({buildingId:bl._id,name,code,location}));});
exports.putAdminParkingLotsId=w(async(q,r)=>{const l=await Lot.findById(id(q.params.id));if(!l)throw err(404,'Not found');const d=q.body;
 if(d.name!==undefined){if(!str(d.name))throw err(400,'Name required');l.name=str(d.name);}
 if(d.code!==undefined){if(!str(d.code,20))throw err(400,'Code required');l.code=str(d.code,20);}
 if(d.location!==undefined){const g=geo(d.location);if(!g)throw err(400,'Invalid coordinates');l.location=g;}await l.save();r.json(l);});
exports.postAdminParkingLotsIdSlots=w(async(q,r)=>{const lot=await Lot.findOne({_id:id(q.params.id),active:true});if(!lot)throw err(404,'Lot not found');const out=[];
 for(const it of [].concat(q.body)){const n=(str(it.slotNumber,12)||'').toUpperCase();if(!n||!TYPES.includes(it.vehicleType))throw err(400,'Slot number and a valid vehicle type are required');
  if(await Slot.exists({parkingLotId:lot._id,slotNumber:n}))throw err(409,`Slot ${n} already exists in this lot`);const p=it.position||{};
  out.push(await Slot.create({parkingLotId:lot._id,slotNumber:n,vehicleType:it.vehicleType,position:{x:Math.max(0,+p.x||0),y:Math.max(0,+p.y||0)},qrToken:crypto.randomBytes(16).toString('hex')}));}
 r.json(out);});
exports.putAdminParkingSlotsId=w(async(q,r)=>{const s=await Slot.findById(id(q.params.id));if(!s)throw err(404,'Not found');const b=q.body,busy=['RESERVED','OCCUPIED'].includes(s.status);
 if(b.status!==undefined&&b.status!==s.status){if(busy||!['AVAILABLE','MAINTENANCE'].includes(b.status))throw err(400,'A slot in use cannot be changed; only AVAILABLE and MAINTENANCE can be set');s.status=b.status;}
 if(b.slotNumber!==undefined){const n=(str(b.slotNumber,12)||'').toUpperCase();if(!n)throw err(400,'Slot number required');
  if(n!==s.slotNumber&&await Slot.exists({parkingLotId:s.parkingLotId,slotNumber:n}))throw err(409,'Slot number already used in this lot');s.slotNumber=n;}
 if(b.vehicleType!==undefined&&b.vehicleType!==s.vehicleType){if(!TYPES.includes(b.vehicleType))throw err(400,'Invalid vehicle type');if(busy)throw err(400,'Slot is in use');s.vehicleType=b.vehicleType;}
 if(b.position!==undefined){const x=+b.position.x,y=+b.position.y;if(!Number.isFinite(x)||!Number.isFinite(y))throw err(400,'Invalid position');s.position={x,y};}
 if(b.active!==undefined){if(!b.active&&busy)throw err(400,'Slot is in use');s.active=!!b.active;}
 await s.save();r.json(s);});
