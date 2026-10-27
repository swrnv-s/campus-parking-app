const err=(s,m)=>Object.assign(new Error(m),{status:s});
const w=f=>(q,r,n)=>Promise.resolve(f(q,r,n)).catch(n);
module.exports={err,w};
