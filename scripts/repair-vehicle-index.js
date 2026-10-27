// Fixes the vehicle uniqueness index on existing databases. Run once after upgrading: npm run repair:vehicles
const mongoose=require('mongoose');const {Vehicle}=require('../models');const {normalize}=require('../utils/vehicleNumber');
(async()=>{await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/campus-parking');const col=Vehicle.collection;
 for(const ix of await col.indexes())if(ix.key&&ix.key.normalizedVehicleNumber){console.log('dropping index',ix.name);await col.dropIndex(ix.name);}
 await col.updateMany({vehicleType:'CYCLE'},{$unset:{normalizedVehicleNumber:''}});      // cycles carry no normalized number
 await col.updateMany({normalizedVehicleNumber:''},{$unset:{normalizedVehicleNumber:''}});  // empty strings would collide
 for(const v of await Vehicle.find({vehicleType:{$ne:'CYCLE'}})){const n=normalize(v.vehicleNumber);if(n&&n!==v.normalizedVehicleNumber){v.normalizedVehicleNumber=n;await v.save();}}
 const dup=await Vehicle.aggregate([{$match:{active:true,normalizedVehicleNumber:{$type:'string'}}},{$group:{_id:'$normalizedVehicleNumber',n:{$sum:1},ids:{$push:'$_id'}}},{$match:{n:{$gt:1}}}]);
 if(dup.length){console.error('Duplicate ACTIVE registrations exist. Deregister all but one, then rerun:\n'+JSON.stringify(dup,null,1));process.exit(1);}
 await Vehicle.createIndexes();console.log('Index one_active_vehicle_registration is ready');process.exit(0);})();
