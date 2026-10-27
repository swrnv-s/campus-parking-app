try{process.loadEnvFile()}catch(e){} // load .env (Node 20.12+); real env vars still win
const fs=require('fs'),path=require('path');
const express=require('express'),session=require('express-session'),MongoStore=require('connect-mongo'),mongoose=require('mongoose');
const {expireReservations}=require('./services/expiryService');
if(process.env.NODE_ENV==='production'&&(!process.env.SESSION_SECRET||process.env.SESSION_SECRET==='change-me')){console.error('Set a strong SESSION_SECRET in production');process.exit(1);}
const URI=process.env.MONGO_URI||'mongodb://127.0.0.1:27017/campus-parking';
const app=express();if(process.env.NODE_ENV==='production')app.set('trust proxy',1);app.use(express.json());
app.use(session({secret:process.env.SESSION_SECRET||'dev-secret',resave:false,saveUninitialized:false,
 store:MongoStore.create({mongoUrl:URI}),cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:864e5}}));
app.use('/api',require('./routes'));
// Serve front-end libraries from node_modules so pages render even when the CDNs are blocked/offline.
const PUB=path.join(__dirname,'public'),NM=path.join(__dirname,'node_modules');
const CDN={'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css':'/vendor/bootstrap/css/bootstrap.min.css',
 'https://code.jquery.com/jquery-3.7.1.min.js':'/vendor/jquery/jquery.min.js',
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css':'/vendor/leaflet/leaflet.css',
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js':'/vendor/leaflet/leaflet.js'};
app.use('/vendor/bootstrap',express.static(path.join(NM,'bootstrap/dist')));
app.use('/vendor/jquery',express.static(path.join(NM,'jquery/dist')));
app.use('/vendor/leaflet',express.static(path.join(NM,'leaflet/dist')));
app.use((q,r,n)=>{ // HTML pages: swap CDN URLs for the local copies (files in public/ stay unchanged)
 if(q.method!=='GET'&&q.method!=='HEAD')return n();
 let p;try{p=decodeURIComponent(q.path);}catch{return n();}
 if(p.endsWith('/'))p+='index';if(path.extname(p)==='')p+='.html';else if(path.extname(p)!=='.html')return n();
 const f=path.join(PUB,p);if(!f.startsWith(PUB+path.sep))return n();
 fs.readFile(f,'utf8',(e,h)=>{if(e)return n();for(const u in CDN)h=h.split(u).join(CDN[u]);r.type('html').send(h);});});
app.use(express.static(PUB,{extensions:['html']}));
app.use(require('./middleware/errorHandler'));
mongoose.connect(URI).then(()=>{setInterval(()=>expireReservations().catch(console.error),15000);
 app.listen(process.env.PORT||3000,()=>console.log('Running on http://localhost:'+(process.env.PORT||3000)));})
 .catch(e=>{console.error('Could not connect to MongoDB at '+URI+'\n'+e.message+'\nStart MongoDB first (see README), then run npm start again.');process.exit(1);});
