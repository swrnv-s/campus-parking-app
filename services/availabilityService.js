const {Lot,Slot}=require('../models');
async function availability(filter){const lots=await Lot.find({active:true,...filter.lot}).populate('buildingId').lean(),out=[];
 for(const l of lots){const q={parkingLotId:l._id,active:true,...(filter.vt&&{vehicleType:filter.vt})},c={AVAILABLE:0,RESERVED:0,OCCUPIED:0,MAINTENANCE:0};
  (await Slot.aggregate([{$match:q},{$group:{_id:'$status',n:{$sum:1}}}])).forEach(x=>c[x._id]=x.n);
  out.push({...l,counts:c,total:Object.values(c).reduce((a,b)=>a+b,0)});}return out;}
module.exports={availability};
