const {err}=require('../utils/http');
const id=v=>{if(!/^[a-f\d]{24}$/i.test(String(v)))throw err(400,'Bad id');return v;};
module.exports={id};
