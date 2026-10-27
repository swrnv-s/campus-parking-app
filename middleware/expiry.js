const {expireReservations}=require('../services/expiryService');
module.exports=(q,r,n)=>expireReservations().then(()=>n(),n); // lazy server-side expiry before every API call
