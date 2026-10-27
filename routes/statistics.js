const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/statisticsController');
router.get('/admin/statistics',auth,admin,c.getAdminStatistics);
router.get('/statistics/my',auth,c.getStatisticsMy);
module.exports=router;
