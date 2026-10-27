const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/qrController');
router.get('/qr/:slotId',auth,admin,c.getQrSlotid);
router.post('/qr/verify',auth,rateLimit({windowMs:6e4,max:30}),c.postQrVerify);
module.exports=router;
