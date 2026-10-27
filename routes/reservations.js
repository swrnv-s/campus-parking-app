const router=require('express').Router();const {auth,admin}=require('../middleware/auth');
const rateLimit=require('express-rate-limit');const lim=rateLimit({windowMs:6e4,max:20});
const c=require('../controllers/reservationController');
router.post('/reservations',auth,c.postReservations);
router.get('/reservations',auth,c.getReservations);
router.post('/reservations/:id/cancel',auth,c.postReservationsIdCancel);
module.exports=router;
