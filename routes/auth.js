const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/authController');
router.post('/auth/register',lim,c.postAuthRegister);
router.post('/auth/login',lim,c.postAuthLogin);
router.post('/auth/logout',c.postAuthLogout);
router.get('/auth/me',auth,c.getAuthMe);
module.exports=router;
