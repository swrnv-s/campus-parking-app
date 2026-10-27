const m=require('mongoose'),S=m.Schema,O=S.Types.ObjectId,ref=r=>({type:O,ref:r});
const T={timestamps:true};
const {normalize:norm}=require('../utils/vehicleNumber');
const User=m.model('User',new S({name:String,email:{type:String,unique:true,lowercase:true},passwordHash:String,phone:String,
 userType:{type:String,enum:['STUDENT','FACULTY','GUEST','ADMIN'],default:'STUDENT'},collegeId:String},T));
const vs=new S({userId:ref('User'),vehicleNumber:String,normalizedVehicleNumber:String,
 vehicleType:{type:String,enum:['TWO_WHEELER','FOUR_WHEELER','CYCLE']},model:String,color:String,
 approvalStatus:{type:String,enum:['PENDING','APPROVED','REJECTED','REVOKED'],default:'PENDING'},approvedBy:ref('User'),approvedAt:Date,rejectionReason:String,
 registeredAt:{type:Date,default:Date.now},deregisteredAt:Date,active:{type:Boolean,default:true}},T);
// Unique only among ACTIVE motor vehicles: cycles have no normalized number, and deregistered vehicles free their number.
vs.index({normalizedVehicleNumber:1},{name:'one_active_vehicle_registration',unique:true,partialFilterExpression:{active:true,normalizedVehicleNumber:{$type:'string'}}});
const Vehicle=m.model('Vehicle',vs);
const Pass=m.model('ParkingPass',new S({userId:ref('User'),vehicleId:ref('Vehicle'),passType:String,issuedAt:Date,expiresAt:Date,
 status:{type:String,enum:['ACTIVE','EXPIRED','REVOKED'],default:'ACTIVE'},approvedBy:ref('User')},T));
const loc={latitude:Number,longitude:Number};
const Building=m.model('Building',new S({name:String,code:String,location:loc,active:{type:Boolean,default:true}},T));
const Lot=m.model('ParkingLot',new S({buildingId:ref('Building'),name:String,code:String,location:loc,active:{type:Boolean,default:true}},T));
const Slot=m.model('ParkingSlot',new S({parkingLotId:ref('ParkingLot'),slotNumber:String,vehicleType:String,position:{x:{type:Number,default:0},y:{type:Number,default:0}},
 status:{type:String,enum:['AVAILABLE','RESERVED','OCCUPIED','MAINTENANCE'],default:'AVAILABLE'},qrToken:{type:String,unique:true},active:{type:Boolean,default:true}},T));
const rs=new S({userId:ref('User'),vehicleId:ref('Vehicle'),parkingLotId:ref('ParkingLot'),slotId:ref('ParkingSlot'),expiresAt:Date,cancelledAt:Date,
 status:{type:String,enum:['ACTIVE','CONFIRMED','CANCELLED','EXPIRED'],default:'ACTIVE'}},T);
rs.index({slotId:1},{unique:true,partialFilterExpression:{status:'ACTIVE'}});
const Reservation=m.model('Reservation',rs);
const ss=new S({userId:ref('User'),vehicleId:ref('Vehicle'),parkingLotId:ref('ParkingLot'),slotId:ref('ParkingSlot'),startTime:Date,endTime:Date,durationMinutes:Number,
 status:{type:String,enum:['ACTIVE','COMPLETED'],default:'ACTIVE'}},T);
ss.index({vehicleId:1},{unique:true,partialFilterExpression:{status:'ACTIVE'}});
const Session=m.model('ParkingSession',ss);
const Settings=m.model('SystemSettings',new S({maxVehiclesPerUser:{type:Number,default:5},guestPassValidityHours:{type:Number,default:24},
 parkingPassValidityHours:{type:Number,default:72},reservationWindowMinutes:{type:Number,default:10},updatedBy:ref('User')},{timestamps:{createdAt:false,updatedAt:true}}));
const getSettings=async()=>(await Settings.findOne())||Settings.create({});
module.exports={User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm};
