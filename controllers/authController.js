const bcrypt=require('bcrypt'),QR=require('qrcode'),crypto=require('crypto');
const {User,Vehicle,Pass,Building,Lot,Slot,Reservation,Session,Settings,getSettings,norm}=require('../models');
const {err,w}=require('../utils/http');const {me}=require('../middleware/auth');const {id}=require('../middleware/validation');
const {ELIGIBLE}=require('../config/constants');const {hav,walkMin}=require('../utils/distance');
const {availability}=require('../services/availabilityService');const {walkingRoute}=require('../services/routingService');
exports.postAuthRegister=w(async(q,r)=>{const {name,email,password,phone,userType,collegeId}=q.body;
 if(!name||!/^\S+@\S+$/.test(email||'')||!password||password.length<6)throw err(400,'Name, valid email, password(6+) required');
 if(!['STUDENT','FACULTY','GUEST'].includes(userType))throw err(400,'Invalid user type'); // admins are created via script
 const u=await User.create({name,email,phone,collegeId,userType,passwordHash:await bcrypt.hash(password,10)});q.session.uid=u._id;r.json({ok:true});});
exports.postAuthLogin=w(async(q,r)=>{const u=await User.findOne({email:String(q.body.email||'').toLowerCase()});
 if(!u||!await bcrypt.compare(q.body.password||'',u.passwordHash))throw err(401,'Invalid credentials');q.session.uid=u._id;r.json({ok:true});});
exports.postAuthLogout=(q,r)=>q.session.destroy(()=>r.json({ok:true}));
exports.getAuthMe=w(async(q,r)=>{const u=await me(q);r.json({id:u._id,name:u.name,email:u.email,userType:u.userType,eligible:ELIGIBLE[u.userType]});});
