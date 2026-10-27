const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/passController');
router.post('/passes',auth,c.postPasses);
router.get('/passes',auth,c.getPasses);
module.exports=router;
