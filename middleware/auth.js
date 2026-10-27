const {User}=require('../models');const {err,w}=require('../utils/http');
const auth=(q,r,n)=>q.session.uid?n():n(err(401,'Login required'));
const admin=w(async(q,r,n)=>{const u=await User.findById(q.session.uid);if(!u||u.userType!=='ADMIN')throw err(403,'Admin only');n();});
const me=async q=>{const u=await User.findById(q.session.uid);if(!u)throw err(401,'Login required');return u;};
module.exports={auth,admin,me};
