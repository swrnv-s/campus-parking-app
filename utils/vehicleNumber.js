const normalize=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,''); // "TN 23 ab-1234" -> "TN23AB1234"
// Motor vehicles need a plausible registration number; cycles have none (see vehicleController).
const validateMotorNumber=n=>!n?'Vehicle number is required for two- and four-wheelers':
 (n.length<4||n.length>15||!/[A-Z]/.test(n)||!/[0-9]/.test(n))?'Enter a valid registration number (letters and digits, e.g. TN 23 AB 1234)':null;
module.exports={normalize,validateMotorNumber};
