module.exports=(e,req,res,next)=>{if(!e.status||e.status>=500)console.error(e);
 // expected 4xx errors are not logged
 res.status(e.status||(e.code===11000?409:500)).json({error:e.status?e.message:(e.code===11000?'Already exists (duplicate vehicle number?)':'Server error')});};
