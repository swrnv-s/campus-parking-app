const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/vehicleController');
router.get('/vehicles',auth,c.getVehicles);
router.post('/vehicles',auth,c.postVehicles);
router.delete('/vehicles/:id',auth,c.deleteVehiclesId);
router.get('/vehicles/:id',auth,c.getVehiclesId);
router.put('/vehicles/:id',auth,c.putVehiclesId);
module.exports=router;
