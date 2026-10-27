// ADMIN_EMAIL=a@x.edu ADMIN_PASSWORD=longpassword npm run create-admin  (creates or promotes an admin)
const mongoose=require('mongoose'),bcrypt=require('bcrypt');const {User,getSettings}=require('../models');
(async()=>{const email=(process.env.ADMIN_EMAIL||'').toLowerCase(),pw=process.env.ADMIN_PASSWORD||'';
 if(!email||pw.length<8){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars)');process.exit(1);}
 await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/campus-parking');await getSettings();
 const h=await bcrypt.hash(pw,10);let u=await User.findOne({email});
 if(u){u.userType='ADMIN';u.passwordHash=h;await u.save();}else await User.create({name:process.env.ADMIN_NAME||'Admin',email,passwordHash:h,userType:'ADMIN'});
 console.log('Admin ready:',email);process.exit(0);})();
