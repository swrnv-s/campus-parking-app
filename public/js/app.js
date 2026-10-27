/* ===== Core UI helpers: toasts, dialogs, motion utilities ===== */
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MS=ms=>REDUCED?0:ms;

const ui=(()=>{let box;const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const ICON={
  ok:'<svg class="ti-svg" viewBox="0 0 24 24" aria-hidden="true"><circle class="ti-c" cx="12" cy="12" r="10"/><path class="ti-p" d="M7.5 12.5l3 3 6-6.5"/></svg>',
  error:'<svg class="ti-svg" viewBox="0 0 24 24" aria-hidden="true"><circle class="ti-c" cx="12" cy="12" r="10"/><path class="ti-p" d="M12 7v6M12 16.6v.4"/></svg>',
  warn:'<svg class="ti-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="ti-c" d="M12 3.5l9.5 16.5h-19z"/><path class="ti-p" d="M12 10v4.5M12 17.2v.3"/></svg>'
 };
 // Non-blocking notification. Same message shown twice is merged, not stacked.
 const toast=(m,t='ok',o={})=>{
  box=box&&box.parent().length?box:$('<div id="toasts" aria-live="polite"></div>').appendTo('body');
  const key=t+'|'+m,dup=box.children('.toast-i').filter(function(){return $(this).data('k')===key&&!$(this).hasClass('out');});
  if(dup.length){dup.removeClass('bump');void dup[0].offsetWidth;dup.addClass('bump');dup.data('arm')(); return {dismiss:dup.data('kill')};}
  const el=$(`<div class="toast-i ${t}" role="${t==='error'?'alert':'status'}" data-k="${esc(key)}">
    <span class="ti-ic">${ICON[t]||ICON.ok}</span><span class="ti-m">${esc(m)}</span>
    ${o.action?`<button type="button" class="ti-a">${esc(o.action.label)}</button>`:''}
    <button type="button" class="ti-x" aria-label="Dismiss notification">×</button></div>`).data('k',key).appendTo(box);
  let timer,gone=false;
  const kill=()=>{if(gone)return;gone=true;clearTimeout(timer);el.addClass('out');setTimeout(()=>el.remove(),MS(260));if(o.onClose)o.onClose();};
  const arm=(ms=o.ttl||(t==='error'?6500:t==='warn'?5000:3800))=>{clearTimeout(timer);timer=setTimeout(kill,ms);};
  el.data('kill',kill).data('arm',arm);
  el.on('click','.ti-x',e=>{e.stopPropagation();kill();});
  el.on('click','.ti-a',e=>{e.stopPropagation();kill();o.action.fn();});
  el.on('mouseenter focusin',()=>clearTimeout(timer)).on('mouseleave focusout',()=>arm(1800));
  arm();
  return {dismiss:kill};
 };
 const dlg=(msg,{input,ok='Confirm',danger}={})=>new Promise(res=>{const d=$(`<dialog class="dlg"><p>${esc(msg)}</p>${input?'<input class="form-control">':''}<div class="dlg-b"><button type="button" class="btn btn-sm btn-outline-dark" value="no">Cancel</button><button type="button" class="btn btn-sm ${danger?'btn-danger':'btn-primary'}" value="yes">${ok}</button></div></dialog>`).appendTo('body');
  const done=v=>{d.addClass('closing');setTimeout(()=>{if(d[0].open)d[0].close();d.remove();},MS(140));res(v);};
  d.on('click','button',function(){done($(this).val()==='yes'?(input?d.find('input').val():true):(input?null:false));});
  d.on('cancel',e=>{e.preventDefault();done(input?null:false);});d.on('keydown','input',e=>{if(e.key==='Enter')done(d.find('input').val());});
  d[0].showModal();d.find('input').focus();});
 // Short horizontal shake (+ red outline) on the field(s) that caused an error.
 const shake=(sel)=>{const el=$(sel);el.removeClass('shake fx-bad');void(el[0]&&el[0].offsetWidth);el.addClass('shake fx-bad');
  el.one('animationend',()=>el.removeClass('shake'));setTimeout(()=>el.removeClass('shake'),MS(600)+50);el.one('input change',()=>el.removeClass('fx-bad'));};
 let last=null;$(document).on('pointerdown keydown',e=>{last=e.target;});
 // After a failed request, shake the inputs next to whatever the user just used.
 const shakeNear=()=>{let g=$(last).closest('.row,.col-md-5,.card-body,.input-group,.vc-b,dialog,section,#ep');
  let f=g.find('input:visible:not([type=hidden]):not(:disabled),select:visible:not(:disabled)');
  if(!f.length&&$(last).is('input,select'))f=$(last);
  if(!f.length)f=$(last).closest('button,.btn');if(f.length)shake(f);};
 return {toast,shake,shakeNear,esc,confirm:(m,o={})=>dlg(m,{danger:/deregister|deactivate|delete|revoke|reject/i.test(m),...o}),prompt:m=>dlg(m,{input:true,ok:'OK'})};})();

const api=(m,u,d)=>$.ajax({
  url:'/api'+u,
  method:m,
  contentType:'application/json',
  data:d?JSON.stringify(d):undefined
}).fail(x=>{
  if(u==='/auth/me')return;
  // A wrong password is also a 401: show the message, don't bounce the page.
  if(x.status===401&&!/^\/auth\/(login|register)/.test(u)){location='/login';return;}
  ui.toast(x.status===0?'Cannot reach the server. Check your connection.':(x.responseJSON?.error||'Something went wrong'),'error');
  ui.shakeNear();
});

/* Run an async action behind a button: disables it, shows a spinner, restores it afterwards.
   Failed requests are already reported by api(), so errors are swallowed here. */
const busy=async(btn,fn,min=380)=>{
  const b=$(btn);if(b.data('busy'))return;
  const label=b.html();b.data('busy',1).prop('disabled',true).addClass('is-busy').html('<span class="spin" aria-hidden="true"></span><span>'+label+'</span>');
  const t0=Date.now();let out;
  try{out=await fn();}catch(e){if(!(e&&e.status!==undefined))console.error(e);}
  const w=min-(Date.now()-t0);if(w>0)await sleep(w);
  if(document.contains(b[0]))b.data('busy',0).prop('disabled',false).removeClass('is-busy').html(label);
  return out;
};

/* Buttons that navigate (replaces link-styled buttons). */
$(document).on('click','[data-go]',function(){location=$(this).data('go');});

/* ===== "Find parking" start-the-car button =====
   driveBtn(url,label) returns the markup; the behaviour is delegated below.
   Hover/focus: headlights on, light engine vibration, exhaust puff (CSS only).
   Click: the car drives off along the button's top edge while the label changes, then we navigate.
   With reduced motion: the label changes and we navigate straight away. */
const CAR=`<svg class="car" viewBox="0 0 46 17.5" aria-hidden="true" focusable="false">
  <g class="tr"><path d="M-13 6.5h9M-16 9.5h12M-12 12.5h8"/></g>
  <g class="px"><circle cx="1.5" cy="13" r="1.5"/><circle cx="1.5" cy="13" r="1.1"/></g>
  <path class="beam" d="M34 10.2L46 6.6v7.2z"/>
  <g class="bd">
    <path class="cb" d="M2 14.2v-3.6c0-.9.6-1.5 1.5-1.7l5-1 3-3.2c.5-.5 1.1-.7 1.8-.7h9.2c.7 0 1.3.3 1.8.8l2.8 3.1 4.2.9c1 .2 1.7 1 1.7 2v3.4z"/>
    <path class="gl" d="M11.4 8.3l2.3-2.6c.2-.2.5-.4.8-.4h3.2v3z"/><path class="gl" d="M19.6 5.3h3c.4 0 .7.1 1 .4l2.4 2.6h-6.4z"/>
    <rect class="hl" x="32" y="10" width="2.2" height="1.7" rx=".8"/><rect class="tl" x="2" y="10.2" width="1.4" height="1.4" rx=".5"/>
  </g>
  <g class="wh"><circle class="wt" cx="9.5" cy="14.2" r="3.1"/><g class="sp"><path d="M9.5 12.2v4M7.5 14.2h4"/></g></g>
  <g class="wh"><circle class="wt" cx="26.5" cy="14.2" r="3.1"/><g class="sp"><path d="M26.5 12.2v4M24.5 14.2h4"/></g></g>
</svg>`;
const driveBtn=(url,label,{cls='btn-primary'}={})=>`<span class="drive"><button type="button" class="btn ${cls} drive-btn" data-drive="${url}"><span class="dl dl-a">${label}</span><span class="dl dl-b" aria-hidden="true">Finding parking…</span></button><span class="drive-lane" aria-hidden="true">${CAR}</span></span>`;
const driveReset=w=>{clearTimeout(w.data('t1'));clearTimeout(w.data('t2'));w.removeClass('go').data('go',0);
  w.find('.drive-btn').removeAttr('aria-busy aria-label');};
$(document).on('click','[data-drive]',function(){
  const b=$(this),w=b.closest('.drive'),url=b.data('drive');
  if(w.data('go'))return;                       // already driving: ignore repeat clicks
  w.data('go',1);b.attr({'aria-busy':'true','aria-label':'Finding parking'});
  if(REDUCED){w.addClass('go');location=url;return;}
  const lane=w.find('.drive-lane')[0],car=w.find('.car')[0];
  w[0].style.setProperty('--run',(lane.clientWidth-(parseFloat(getComputedStyle(car).left)||0)+16)+'px');
  w.addClass('go');
  w.data('t1',setTimeout(()=>{location=url;},880));       // navigate as the car leaves the button
  w.data('t2',setTimeout(()=>driveReset(w),4500));        // navigation blocked: return to idle
});
// Back/forward cache restores the page mid-animation: put the button back to idle.
window.addEventListener('pageshow',e=>{if(e.persisted)$('.drive').each(function(){driveReset($(this));});});

/* Skeleton placeholders sized like the real content. */
const skel={
  rows:(n=3,h=64)=>Array.from({length:n},()=>`<div class="sk sk-row" style="height:${h}px"></div>`).join(''),
  cards:(n=2)=>Array.from({length:n},()=>`<div class="sk-card"><div class="sk" style="width:30%;height:18px"></div><div class="sk" style="width:60%;height:12px"></div><div class="sk" style="width:20%;height:30px"></div></div>`).join(''),
  slots:(n=12)=>`<div class="parking-slot-grid">${Array.from({length:n},()=>'<div class="sk" style="height:56px"></div>').join('')}</div>`,
  table:(n=4)=>`<div class="sk" style="height:26px;margin-bottom:.5rem;width:100%"></div>${skel.rows(n,48)}`,
  occ:()=>`<div class="sk" style="width:45%;height:64px;margin-bottom:1rem"></div><div class="sk" style="height:12px;margin-bottom:1.2rem"></div>${skel.rows(2,70)}`
};

/* Update an element in place from an HTML string. Matching nodes (by data-key / data-id, else by position)
   are patched rather than replaced, so CSS transitions run for colour/position changes and
   focus, scroll and running animations are not lost. A slot that becomes AVAILABLE gets a pulse. */
const morph=(root,html)=>{const t=document.createElement('template');t.innerHTML=html;kids($(root)[0],t.content);};
const keyOf=n=>n.nodeType===1?(n.getAttribute('data-key')||n.getAttribute('data-id')):null;
function kids(a,b){
  const old=[...a.childNodes],nw=[...b.childNodes],pool=new Map(),loose=[];
  old.forEach(n=>{const k=keyOf(n);if(k)pool.set(k,n);else loose.push(n);});
  let li=0;const out=[],used=new Set();
  nw.forEach(n=>{
    const k=keyOf(n);let m=null;
    if(k){m=pool.get(k)||null;pool.delete(k);}
    else{while(li<loose.length&&!(loose[li].nodeName===n.nodeName&&!used.has(loose[li])))li++;if(li<loose.length){m=loose[li];li++;}}
    if(m&&m.nodeName===n.nodeName){used.add(m);patch(m,n);out.push(m);}else out.push(document.importNode(n,true));
  });
  out.forEach((el,i)=>{if(a.childNodes[i]!==el)a.insertBefore(el,a.childNodes[i]||null);});
  [...a.childNodes].slice(out.length).forEach(n=>n.remove());
}
function patch(el,n){
  if(el.nodeType!==1){if(el.nodeValue!==n.nodeValue)el.nodeValue=n.nodeValue;return;}
  const keep=el.classList.contains('pulse')?['pulse']:[],was=el.getAttribute('data-status');
  [...el.attributes].forEach(at=>{if(!n.hasAttribute(at.name))el.removeAttribute(at.name);});
  const stat=el.hasAttribute('data-static');
  [...n.attributes].forEach(at=>{if(el.getAttribute(at.name)!==at.value)el.setAttribute(at.name,at.value);});
  keep.forEach(c=>el.classList.add(c));
  const now=el.getAttribute('data-status');
  if(was&&now&&was!==now&&!REDUCED){
    el.classList.add('flip');setTimeout(()=>el.classList.remove('flip'),700);
    if(now==='AVAILABLE'){el.classList.add('pulse');setTimeout(()=>el.classList.remove('pulse'),2000);}
  }
  if(!stat)kids(el,n);
}

/* Collapse an element smoothly, then remove it. */
const collapse=(el,done)=>{const e=$(el);if(!e.length||REDUCED){e.remove();done&&done();return;}
  e.css({height:e[0].offsetHeight,overflow:'hidden'});void e[0].offsetHeight;
  e.addClass('collapsing').css({height:0,opacity:0,marginTop:0,marginBottom:0,paddingTop:0,paddingBottom:0});
  setTimeout(()=>{e.remove();done&&done();},430);};

/* Draw-in check mark used in confirmation states. */
const CHECK='<svg class="ck-big" viewBox="0 0 52 52" aria-hidden="true"><circle class="ck-c" cx="26" cy="26" r="23"/><path class="ck-p" d="M15 27l8 8 15-17"/></svg>';

let ME,V=[],map,pick,timer,poll,MODE='res';

const fmt=d=>new Date(d).toLocaleString();

const TYPES=[
  'TWO_WHEELER',
  'FOUR_WHEELER',
  'CYCLE'
];

const VEHICLE_TYPE_COLORS={
  FOUR_WHEELER:'#2563eb',
  TWO_WHEELER:'#f59e0b',
  CYCLE:'#16a34a'
};

const vehicleTypeClass=t=>({
  FOUR_WHEELER:'four-wheeler',
  TWO_WHEELER:'two-wheeler',
  CYCLE:'cycle'
})[t]||'unknown';

const vehicleTypeStyle=t=>
  `--vehicle-type-color:${VEHICLE_TYPE_COLORS[t]||'#64748b'}`;

const installVehicleTypeStyles=()=>{
  if(document.getElementById('vehicle-type-colors'))return;

  $('<style id="vehicle-type-colors">').text(`
    .type-four-wheeler{
      --vehicle-type-color:#2563eb
    }

    .type-two-wheeler{
      --vehicle-type-color:#f59e0b
    }

    .type-cycle{
      --vehicle-type-color:#16a34a
    }

    .plate.type-four-wheeler,
    .plate.type-two-wheeler,
    .plate.type-cycle{
      border-color:var(--vehicle-type-color)!important;
      color:var(--vehicle-type-color)!important;
    }

    .vrow.type-four-wheeler,
    .vrow.type-two-wheeler,
    .vrow.type-cycle{
      border-left:3px solid var(--vehicle-type-color)!important;
      padding-left:10px;
    }

    .vehicle-type-label{
      color:var(--vehicle-type-color)!important;
      font-weight:600
    }

    .slot.type-four-wheeler,
    .slot.type-two-wheeler,
    .slot.type-cycle{
      border:2px solid var(--vehicle-type-color)!important;
      box-shadow:
        inset 0 0 0 1px
        color-mix(
          in srgb,
          var(--vehicle-type-color) 30%,
          transparent
        );
    }

    .bay.type-four-wheeler,
    .bay.type-two-wheeler,
    .bay.type-cycle{
      border:1px solid var(--vehicle-type-color)!important;
      background:var(--vehicle-type-color)!important;
      box-shadow:none!important;
      opacity:.9;
    }

    .bay.AVAILABLE.type-four-wheeler{
      background:#2563eb!important;
      border-color:#2563eb!important
    }

    .bay.AVAILABLE.type-two-wheeler{
      background:#f59e0b!important;
      border-color:#f59e0b!important
    }

    .bay.AVAILABLE.type-cycle{
      background:#16a34a!important;
      border-color:#16a34a!important
    }

    .bay.RESERVED{
      background:#b58a3b!important;
      border-color:#b58a3b!important
    }

    .bay.OCCUPIED{
      background:#e74c3c!important;
      border-color:#e74c3c!important
    }

    .bay.MAINTENANCE{
      background:#111827!important;
      border-color:#111827!important
    }

    .parking-layout-shell{
      margin-top:1rem;
      max-width:760px
    }

    .parking-lot-card{
      background:#f7f8f6;
      border:1px solid #d9ddd8;
      padding:18px 18px 14px
    }

    .parking-lot-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin:0 0 16px
    }

    .parking-lot-title{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0
    }

    .parking-lot-badge{
      width:34px;
      height:34px;
      border-radius:50%;
      display:grid;
      place-items:center;
      background:#6f8fa4;
      color:#fff;
      font-weight:700;
      font-size:16px;
      flex:none
    }

    .parking-lot-title h5{
      margin:0 0 2px;
      font-size:16px;
      font-weight:700
    }

    .parking-lot-meta{
      font-size:12px;
      color:#778078
    }

    .parking-lot-percent{
      font-size:13px;
      color:#4d5550;
      white-space:nowrap
    }

    .parking-slots-wrap{
      display:flex;
      flex-direction:column;
      gap:0
    }

    .parking-slot-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:7px
    }

    .parking-slot{
      position:relative;
      min-width:0;
      height:56px;
      padding:7px 5px;
      background:#fff;
      border:1px solid #cbd1cc;
      border-radius:0;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      font:500 12px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;
      color:#202522;
      cursor:pointer;
      transition:
        transform .12s ease,
        border-color .12s ease,
        background .12s ease
    }

    .parking-slot:hover:not(.disabled){
      transform:translateY(-1px)
    }

    .parking-slot.disabled{
      cursor:default
    }

    .parking-slot.four-wheeler{
      --type:#2563eb;
      background:rgba(37,99,235,.035);
      border-color:rgba(37,99,235,.35)
    }

    .parking-slot.two-wheeler{
      --type:#f59e0b;
      background:rgba(245,158,11,.045);
      border-color:rgba(245,158,11,.38)
    }

    .parking-slot.cycle{
      --type:#16a34a;
      background:rgba(22,163,74,.045);
      border-color:rgba(22,163,74,.38)
    }

    .parking-slot-number{
      letter-spacing:.1px
    }

    .parking-slot-status-dot{
      width:9px;
      height:9px;
      border-radius:50%;
      margin-top:6px;
      border:1px solid currentColor
    }

    .parking-slot.status-available
    .parking-slot-status-dot{
      color:#6b9c82;
      background:transparent
    }

    .parking-slot.status-reserved
    .parking-slot-status-dot{
      color:#b58a3b;
      background:#b58a3b
    }

    .parking-slot.status-occupied
    .parking-slot-status-dot{
      color:#e86d4b;
      background:#e86d4b
    }

    .parking-slot.status-maintenance
    .parking-slot-status-dot{
      color:#777e79;
      background:#777e79
    }

    .parking-slot.status-occupied,
    .parking-slot.status-reserved{
      opacity:.92
    }

    .parking-slot.status-occupied{
      background:rgba(232,109,75,.08)
    }

    .parking-slot.status-reserved{
      background:rgba(181,138,59,.08)
    }

    .parking-pedestrian-walk{
      height:34px;
      background:#e7e9e6;
      color:#a4aaa5;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      letter-spacing:2px;
      margin:0 0 10px
    }

    .parking-legend{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:12px 14px;
      border-top:1px solid #d9ddd8;
      margin-top:14px;
      padding-top:12px;
      font-size:12px;
      color:#5f6761
    }

    .parking-legend-title{
      font-size:10px;
      letter-spacing:1.3px;
      color:#8b928d;
      margin-right:2px
    }

    .parking-legend>span:not(.parking-legend-title){
      display:inline-flex;
      align-items:center;
      gap:5px
    }

    .parking-status-dot{
      display:inline-block;
      width:9px;
      height:9px;
      border-radius:50%;
      border:1px solid currentColor
    }

    .parking-status-dot.available{
      color:#6b9c82;
      background:transparent
    }

    .parking-status-dot.reserved{
      color:#b58a3b;
      background:#b58a3b
    }

    .parking-status-dot.occupied{
      color:#e86d4b;
      background:#e86d4b
    }

    .parking-status-dot.maintenance{
      color:#777e79;
      background:#777e79
    }

    .parking-type-swatch{
      display:inline-block;
      width:10px;
      height:10px;
      border-radius:2px;
      border:1px solid currentColor
    }

    .parking-type-swatch.four-wheeler{
      color:#2563eb;
      background:rgba(37,99,235,.12)
    }

    .parking-type-swatch.two-wheeler{
      color:#f59e0b;
      background:rgba(245,158,11,.14)
    }

    .parking-type-swatch.cycle{
      color:#16a34a;
      background:rgba(22,163,74,.12)
    }

    .parking-type-legend{
      margin-top:8px
    }

    .parking-editor-legend{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:10px 14px;
      margin:8px 0 10px;
      padding:9px 10px;
      border:1px solid #d9ddd8;
      background:#f7f8f6;
      font-size:11px;
      color:#5f6761
    }

    .parking-editor-legend>span{
      display:inline-flex;
      align-items:center;
      gap:5px
    }

    .parking-editor-legend-title{
      font-size:10px;
      letter-spacing:1.2px;
      color:#8b928d;
      font-weight:700
    }

    .editor-status-title{
      margin-left:4px
    }

    .editor-swatch{
      display:inline-block;
      width:11px;
      height:11px;
      border:1px solid currentColor
    }

    /* Layout editor: every slot must remain completely inside
       the editor cell/canvas. */
    .editor-slot{
      position:absolute!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      color:#fff!important;
      font-weight:700!important;
      text-shadow:0 1px 1px rgba(0,0,0,.25);
      overflow:hidden!important;
      box-sizing:border-box!important;
      user-select:none!important;
      cursor:grab!important;
      margin:0!important;
      max-width:100%!important;
      max-height:100%!important;
    }

    .parking-editor-canvas-wrap{
      width:100%;
      max-width:100%;
      overflow:hidden;
      box-sizing:border-box;
    }

    #cv{
      position:relative!important;
      box-sizing:border-box!important;
      max-width:100%!important;
      overflow:auto!important;
      border:1px solid #d9ddd8;
      background:#fff;
      padding:0!important;
      overscroll-behavior:contain;
      touch-action:none;
    }

    #cv .slot-delete{
      width:18px!important;
      height:18px!important;
      min-width:18px!important;
      min-height:18px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      right:2px!important;
      top:2px!important;
      padding:0!important;
      margin:0!important;
      overflow:hidden!important;
      line-height:18px!important;
    }

    .editor-slot:active{
      cursor:grabbing!important
    }

    .editor-slot-number{
      pointer-events:none
    }

    .slot-delete{
      position:absolute;
      right:2px;
      top:1px;
      border:0;
      background:transparent;
      color:rgba(0,0,0,.55);
      font-size:13px;
      line-height:13px;
      padding:0 2px;
      cursor:pointer;
      font-weight:700;
      z-index:5
    }

    .slot-delete:hover{
      color:#000
    }

    .editor-slot.off{
      opacity:.45
    }

    .editor-slot.sel{
      outline:2px solid #f2c400;
      outline-offset:1px
    }

    @media(max-width:520px){
      .parking-lot-card{
        padding:14px 12px 12px
      }

      .parking-slot-grid{
        gap:5px
      }

      .parking-slot{
        height:52px;
        font-size:11px
      }

      .parking-legend{
        gap:9px 11px
      }
    }
  `).appendTo('head');
};

installVehicleTypeStyles();

/* ===== Form feedback helpers ===== */
const TICK='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>';

// Live validation for one input. fn(value) returns an error message or null.
// Shows a check mark when valid and a short inline explanation when not.
const check=(input,fn)=>{
  const i=$(input),w=i.closest('.fld');
  if(!w.find('.hint').length)w.append(`<span class="ok-ic">${TICK}</span><div class="hint" role="status"></div>`);
  const run=force=>{
    const v=i.val(),e=i.prop('disabled')?null:fn(v);
    if(!v&&!force){w.removeClass('ok bad');w.find('.hint').text('');return null;}
    w.toggleClass('ok',!e).toggleClass('bad',!!e);w.find('.hint').text(e||'');return e;
  };
  i.on('input blur',()=>run(false));
  i.data('run',run);
  return run;
};

const plateError=(n,type)=>{
  if(type==='CYCLE')return null;
  const x=String(n||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!x)return 'Enter the registration number';
  if(x.length<4||x.length>15||!/[A-Z]/.test(x)||!/[0-9]/.test(x))
    return 'Use 4–15 letters and digits, with at least one of each (e.g. TN 23 AB 1234)';
  return null;
};

/* ===== Vehicles: expandable cards ===== */
const PASSLABEL=v=>v.pass?`Active until ${fmt(v.pass.expiresAt)}`:'No active pass';

function vehicleCard(v,{open=false,fresh=false}={}){
  const t=vehicleTypeClass(v.vehicleType),ok=v.approvalStatus==='APPROVED';
  const summary=v.parked?'Parked now':v.pass?'Pass active':ok?'No pass yet':'—';
  return `<div class="vc${open?' open':''}${fresh?' fx-in':''}" data-id="${v._id}">
    <button type="button" class="vc-h" aria-expanded="${open}" aria-controls="vb-${v._id}">
      <span class="plate ${t}" style="${vehicleTypeStyle(v.vehicleType)}">${v.vehicleNumber}</span>
      <span class="vehicle-type-label ${t}" style="${vehicleTypeStyle(v.vehicleType)}">${TL[v.vehicleType]||v.vehicleType}</span>
      <span class="tag ${v.approvalStatus}">${v.approvalStatus}</span>
      <span class="vc-sum">${summary}</span>
      <svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5"/></svg>
    </button>
    <div class="vc-b" id="vb-${v._id}"><div><div class="vc-in">
      <dl class="vc-dl">
        <div><dt>Model</dt><dd>${v.model?ui.esc(v.model):'—'}</dd></div>
        <div><dt>Colour</dt><dd>${v.color?ui.esc(v.color):'—'}</dd></div>
        <div><dt>Registered</dt><dd>${v.createdAt?fmt(v.createdAt):'—'}</dd></div>
        <div><dt>Parked</dt><dd>${v.parked?'Yes':'No'}</dd></div>
      </dl>
      <div class="vc-pass">
        <b>Parking pass</b>
        <span>${PASSLABEL(v)}</span>
        ${!v.pass&&ok?`<button type="button" class="btn btn-sm btn-outline-primary gp" data-id="${v._id}">Get pass</button>`:''}
      </div>
      <div class="vc-hist"><b>Recent parking</b><div class="vc-hl" data-static="1"></div></div>
      <div class="vc-act"><button type="button" class="btn btn-sm btn-outline-danger dv" data-id="${v._id}">Deregister</button></div>
    </div></div></div>
  </div>`;
}

async function veh(){
  const types=ME.eligible;
  $('#pane').html(`
    <div class="card card-body mb-3 fx-in">
      <div class="row g-2 align-items-start">
        <div class="col plate-col fld">
          <input id="vn" class="form-control" placeholder="TN 23 AB 1234" autocomplete="off" aria-label="Registration number">
        </div>
        <div class="col">
          <select id="vt" class="form-select" aria-label="Vehicle type">${types.map(t=>`<option value="${t}">${TL[t]||t}</option>`).join('')}</select>
        </div>
        <div class="col">
          <input id="vm" class="form-control" placeholder="Model" autocomplete="off" aria-label="Model">
        </div>
        <div class="col-auto"><button type="button" id="va" class="btn btn-primary">Register</button></div>
      </div>
    </div>
    <div id="vl" class="vlist">${skel.rows(3,64)}</div>`);

  const runPlate=check('#vn',v=>plateError(v,$('#vt').val()));
  $('#vt').on('change',function(){
    const c=$(this).val()==='CYCLE';
    $('.plate-col').toggleClass('off',c);
    $('#vn').prop('disabled',c).attr('placeholder',c?'Not required for cycles':'TN 23 AB 1234');
    if(c)$('#vn').val('');
    runPlate(false);
  }).trigger('change');

  const submit=()=>busy('#va',async()=>{
    const type=$('#vt').val();
    const e=runPlate(true);
    if(e){ui.shake('#vn');$('#vn').trigger('focus');return;}
    await api('POST','/vehicles',{vehicleNumber:$('#vn').val(),vehicleType:type,model:$('#vm').val()});
    $('#vn,#vm').val('');runPlate(false);
    ui.toast('Vehicle registered. It can park once the office approves it.');
    await list(true);
  });
  $('#va').on('click',submit);
  $('#vn,#vm').on('keydown',e=>{if(e.key==='Enter')submit();});

  const known=new Set();
  const list=async(scrollNew)=>{
    V=await api('GET','/vehicles');
    const open=new Set($('#vl .vc.open').map(function(){return $(this).data('id');}).get());
    const html=V.map(v=>vehicleCard(v,{open:open.has(v._id),fresh:!known.has(v._id)})).join('')||
      '<p class="empty">No vehicles yet. Register your first one above.</p>';
    if($('#vl .sk').length)$('#vl').html(html);else morph('#vl',html);
    V.forEach(v=>known.add(v._id));
    if(scrollNew)$('#vl .vc').first();
  };
  await list();

  // Expand / collapse in place; only this card changes height.
  $('#vl').on('click','.vc-h',async function(){
    const c=$(this).closest('.vc'),o=!c.hasClass('open');
    c.toggleClass('open',o);$(this).attr('aria-expanded',o);
    if(o)loadHistory(c);
  });
  $('#vl .vc.open').each(function(){loadHistory($(this));});

  async function loadHistory(c){
    const box=c.find('.vc-hl');if(box.data('loaded')||box.data('loading'))return;
    box.data('loading',1).html(skel.rows(2,22));
    try{
      const d=await api('GET','/vehicles/'+c.data('id'));
      const rows=(d.history||[]).slice(0,5).map(s=>`<div class="vc-row"><span>Slot ${s.slotId?.slotNumber||'—'}</span><span>${fmt(s.startTime)}</span><span class="tag ${s.status}">${s.status}</span></div>`).join('');
      box.data('loaded',1).html(`<div class="fx-in">${rows||'<span class="text-muted">No parking sessions yet.</span>'}</div>`);
    }catch(e){box.html('<span class="text-muted">Could not load history.</span>');}
    box.data('loading',0);
  }

  $('#vl').on('click','.gp',function(ev){
    ev.stopPropagation();
    busy(this,async()=>{
      await api('POST','/passes',{vehicleId:$(this).data('id')});
      ui.toast('Parking pass issued.');
      await list();
    });
  });

  $('#vl').on('click','.dv',async function(ev){
    ev.stopPropagation();
    const btn=this,c=$(btn).closest('.vc');
    if(!await ui.confirm('Deregister this vehicle?',{ok:'Deregister'}))return;
    await busy(btn,async()=>{
      await api('DELETE','/vehicles/'+$(btn).data('id'));
      // Confirmation state, then the card folds away.
      c.addClass('done').find('.vc-h').attr('aria-expanded',false);
      c.append(`<div class="vc-done" role="status">${CHECK}<div><b>Vehicle deregistered</b><small>Its pass has been revoked.</small></div></div>`);
      c.removeClass('open');
      await sleep(MS(1500));
      await new Promise(r=>collapse(c,r));
      V=V.filter(x=>x._id!==c.data('id'));
      if(!$('#vl .vc').length)$('#vl').html('<p class="empty fx-in">No vehicles yet. Register your first one above.</p>');
    },0);
  });
}

/* ===== Find parking: map, zones, slots ===== */
let routeLayer,zoneLayer,spotEl,spotOff,lotPins={},lotsData=[],selLot=null,routeTok=0,headDot,endDot;

const levelOf=l=>{const f=l.counts.AVAILABLE,t=l.total||0;return !t||f===0?'full':f/t<=.25?'low':'ok';};

const flyTo=(ll,z)=>REDUCED?map.setView(ll,z,{animate:false}):map.flyTo(ll,z,{duration:1.15,easeLinearity:.25});
const reframe=(pts,animate=true)=>{
  if(!pts.length)return;
  const b=L.latLngBounds(pts);
  if(!animate||REDUCED)map.fitBounds(b,{padding:[50,50],maxZoom:18,animate:false});
  else map.flyToBounds(b,{padding:[50,50],maxZoom:18,duration:1.3,easeLinearity:.25});
};

// Spot-details card that grows out of the selected marker.
function closeSpot(instant){
  if(spotOff){spotOff();spotOff=null;}
  const el=spotEl;spotEl=null;if(!el)return;
  if(instant||REDUCED)return el.remove();
  el.classList.add('closing');setTimeout(()=>el.remove(),240);
}
function openSpot(l){
  closeSpot(true);
  const ll=L.latLng(l.location.latitude,l.location.longitude);
  const el=document.createElement('div');
  el.className='spot-card';
  const pct=l.total?Math.round(l.counts.AVAILABLE/l.total*100):0;
  el.innerHTML=`<button type="button" class="spot-x" aria-label="Close details">×</button>
    <b class="spot-n">${ui.esc(l.name)}</b>
    <small>${ui.esc(l.buildingId?.name||'')}</small>
    <div class="spot-m"><i class="${levelOf(l)}" style="width:${pct}%"></i></div>
    <div class="spot-s"><b>${l.counts.AVAILABLE}</b> free of ${l.total} · ${l.distanceMeters} m · ~${l.walkingMinutes} min walk</div>
    <div class="spot-b">
      <button type="button" class="btn btn-sm btn-primary vl" data-id="${l._id}">View slots</button>
      <button type="button" class="btn btn-sm btn-outline-dark rt" data-m="b" data-id="${l._id}">Route from destination</button>
      <button type="button" class="btn btn-sm btn-outline-dark rt" data-m="me" data-id="${l._id}">Route from me</button>
    </div>`;
  const host=map.getContainer();host.appendChild(el);spotEl=el;
  L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);
  const place=()=>{
    const pt=map.latLngToContainerPoint(ll),W=host.clientWidth,H=host.clientHeight,w=el.offsetWidth,h=el.offsetHeight;
    let x=Math.min(Math.max(pt.x-w/2,8),Math.max(8,W-w-8)),y=pt.y-h-26,below=false;
    if(y<8){y=pt.y+26;below=true;}
    el.style.left=x+'px';el.style.top=y+'px';
    el.style.setProperty('--ox',(pt.x-x)+'px');el.style.setProperty('--oy',(pt.y-y)+'px');
    el.classList.toggle('below',below);
  };
  place();map.on('move zoom',place);
  spotOff=()=>map.off('move zoom',place);
  // Closing only removes the card: the map keeps its current view and zoom.
  el.querySelector('.spot-x').addEventListener('click',()=>closeSpot());
}

function selectLot(id,{card=true}={}){
  const l=lotsData.find(x=>x._id===id);if(!l)return;
  selLot=id;
  $('#lots .lotc').removeClass('sel').filter(`[data-id="${id}"]`).addClass('sel');
  Object.entries(lotPins).forEach(([k,m])=>$(m.getElement()).find('.lot-pin').toggleClass('sel',k===id));
  const ll=[l.location.latitude,l.location.longitude];
  if(zoneLayer)map.removeLayer(zoneLayer);
  zoneLayer=L.circle(ll,{radius:24,className:'zone-ring',interactive:false}).addTo(map);
  closeSpot();
  // Glide to the zone; never zoom out, only in when the view is still wide.
  const z=Math.max(map.getZoom(),18);
  flyTo(ll,z);
  if(card){
    let shown=false;
    const show=()=>{if(shown||selLot!==id)return;shown=true;openSpot(l);};
    map.once('moveend',show);setTimeout(show,MS(1500));
  }
}

async function route(lotId,la,lo){
  const r=await api('GET',`/parking/route?lotId=${lotId}&fromLat=${la}&fromLng=${lo}`);
  const tok=++routeTok;
  if(routeLayer)map.removeLayer(routeLayer);
  if(headDot)map.removeLayer(headDot);if(endDot)map.removeLayer(endDot);endDot=null;
  const pts=r.geometry.map(c=>[c[1],c[0]]);
  routeLayer=L.polyline([],{color:'#1c7ed6',weight:5,opacity:.95,lineCap:'round',lineJoin:'round',className:'route-line'}).addTo(map);
  closeSpot();
  reframe(pts,true);

  // Draw the line progressively, by distance along the path.
  const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+map.distance(pts[i-1],pts[i]));
  const total=cum[cum.length-1]||1,T=REDUCED?0:Math.min(2600,Math.max(1100,total*3));
  headDot=L.circleMarker(pts[0],{radius:7,color:'#fff',weight:3,fillColor:'#1c7ed6',fillOpacity:1,interactive:false,className:'route-head'}).addTo(map);
  const t0=performance.now();
  const step=now=>{
    if(tok!==routeTok)return;
    const p=T?Math.min(1,(now-t0)/T):1,e=1-Math.pow(1-p,2),d=e*total;
    let i=1;while(i<cum.length-1&&cum[i]<d)i++;
    const seg=(cum[i]-cum[i-1])||1,f=Math.min(1,Math.max(0,(d-cum[i-1])/seg));
    const tip=[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f];
    routeLayer.setLatLngs([...pts.slice(0,i),tip]);headDot.setLatLng(tip);
    if(p<1)requestAnimationFrame(step);
    else{routeLayer.setLatLngs(pts);map.removeLayer(headDot);headDot=null;
      endDot=L.circleMarker(pts[pts.length-1],{radius:8,color:'#fff',weight:3,fillColor:'#16a34a',fillOpacity:1,interactive:false,className:'route-end'}).addTo(map);}
  };
  requestAnimationFrame(step);

  $('#steps').html(`
    <div class="card card-body mb-3 fx-in">
      <b>${Math.round(r.distanceMeters)} m · ~${r.durationMinutes} min walk</b>
      <small class="text-muted">${r.source==='osrm'?'OpenStreetMap walking route':'straight-line estimate — routing service unreachable'}</small>
      <ol class="mb-0 mt-2">${r.steps.map(s=>`<li>${s.instruction} <small class="text-muted">${Math.round(s.distance)} m</small></li>`).join('')}</ol>
    </div>`);
}

async function find(){
  $('#pane').html(`<div class="row g-2 mb-2">${skel.rows(1,42)}</div><div class="sk" style="height:300px;margin-bottom:1rem"></div>`);
  V=(await api('GET','/vehicles')).filter(v=>v.approvalStatus==='APPROVED');
  const B=await api('GET','/buildings');

  if(!V.length){
    return $('#pane').html('<p class="empty fx-in">You need an approved vehicle before you can look for parking.</p>'+
      '<button type="button" class="btn btn-outline-dark" data-go="/user/vehicles">Register a vehicle or check its approval</button>');
  }
  if(!B.length){
    return $('#pane').html('<p class="empty fx-in">No destinations have been set up yet. An administrator needs to add buildings and parking lots first.</p>');
  }

  $('#pane').html(`
    <div class="row g-2 mb-2 fx-in">
      <div class="col"><select id="fv" class="form-select" aria-label="Vehicle">${V.map(v=>`<option value="${v._id}" data-t="${v.vehicleType}" style="color:${VEHICLE_TYPE_COLORS[v.vehicleType]||'#64748b'}">${v.vehicleNumber} · ${TL[v.vehicleType]}</option>`).join('')}</select></div>
      <div class="col"><select id="fb" class="form-select" aria-label="Destination building">${B.map(b=>`<option value="${b._id}">${b.name}</option>`).join('')}</select></div>
      <div class="col-auto"><button type="button" id="fg" class="btn btn-primary">Find parking</button></div>
    </div>
    <div id="map" class="mb-3"></div>
    <div id="steps"></div>
    <div id="lots" class="row"></div>
    <div id="layout"></div>`);

  lotPins={};lotsData=[];selLot=null;routeLayer=zoneLayer=spotEl=spotOff=headDot=endDot=null;routeTok++;
  map=L.map('map',{zoomSnap:.5,zoomDelta:.5,wheelPxPerZoomLevel:90}).setView([12.969243,79.155883],17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
  const bMk={};
  B.forEach(b=>{bMk[b._id]=L.marker([b.location.latitude,b.location.longitude]).addTo(map).bindPopup('🏢 '+b.name);});

  let firstRun=true;
  const run=async()=>{
    $('#layout,#steps').empty();
    clearInterval(poll);
    closeSpot(true);routeTok++;
    if(routeLayer)map.removeLayer(routeLayer);if(headDot)map.removeLayer(headDot);if(endDot)map.removeLayer(endDot);if(zoneLayer)map.removeLayer(zoneLayer);
    routeLayer=headDot=endDot=zoneLayer=null;selLot=null;

    const vt=$('#fv option:selected').data('t'),bid=$('#fb').val();
    if(!vt||!bid)return;
    const bb=B.find(x=>x._id===bid);
    // Smoothly reframe on the chosen building right away; lots load meanwhile.
    const home=[bb.location.latitude,bb.location.longitude];
    if(firstRun){map.setView(home,18,{animate:false});}else flyTo(home,Math.max(17,Math.min(map.getZoom(),18)));
    $('#lots').html(Array.from({length:3},()=>`<div class="col-md-4"><div class="sk-card"><div class="sk" style="width:50%;height:18px"></div><div class="sk" style="width:70%;height:12px"></div><div class="sk" style="width:40%;height:28px"></div></div></div>`).join(''));

    let lots=await api('GET',`/parking/find?destinationBuildingId=${bid}&vehicleType=${vt}`);
    // Only show lots that actually have a compatible slot for this vehicle type.
    lots=lots.filter(l=>Number(l.total)>0);
    lotsData=lots;

    $('#lots').html(lots.map((l,i)=>`
      <div class="col-md-4 fx-in" style="animation-delay:${i*60}ms">
        <div class="card card-body mb-2 lotc" data-id="${l._id}" tabindex="0">
          <b>${l.name}</b>
          <div class="lot-meter"><i class="${levelOf(l)}" style="width:${l.total?Math.round(l.counts.AVAILABLE/l.total*100):0}%"></i></div>
          <div>${l.counts.AVAILABLE} available / ${l.total}</div>
          <div>${l.distanceMeters} m · ~${l.walkingMinutes} min walk</div>
          <div class="lot-btns">
            <button type="button" class="btn btn-sm btn-outline-primary vl" data-id="${l._id}">View slots</button>
            <button type="button" class="btn btn-sm btn-outline-success rt" data-m="b" data-id="${l._id}">Route from destination</button>
            <button type="button" class="btn btn-sm btn-outline-success rt" data-m="me" data-id="${l._id}">Route from me</button>
          </div>
        </div>
      </div>`).join('')||
      `<p class="empty fx-in">No parking lots have ${TL[vt]||'compatible'} slots for this vehicle type at the selected destination.</p>`);

    (window.lotMk||[]).forEach(m=>map.removeLayer(m));
    lotPins={};
    window.lotMk=lots.map(l=>{
      const m=L.marker([l.location.latitude,l.location.longitude],{
        icon:L.divIcon({className:'lot-pin-wrap',iconSize:[38,38],iconAnchor:[19,19],
          html:`<div class="lot-pin ${levelOf(l)}" style="--c:${VEHICLE_TYPE_COLORS[vt]||'#64748b'}"><b>${l.counts.AVAILABLE}</b></div>`}),
        title:`${l.name}: ${l.counts.AVAILABLE} free`,keyboard:true
      }).addTo(map);
      m.on('click',()=>selectLot(l._id));
      lotPins[l._id]=m;return m;
    });
    reframe([home,...lots.map(l=>[l.location.latitude,l.location.longitude])],!firstRun);
    firstRun=false;
  };

  $('#fg').on('click',function(){busy(this,run,300);});
  $('#fv,#fb').on('change',run);

  // Delegated so the map's spot card and the list share the same handlers.
  $('#pane').off('.find')
    .on('click.find','.lotc',function(ev){if($(ev.target).closest('button').length)return;selectLot($(this).data('id'));})
    .on('keydown.find','.lotc',function(ev){if(ev.key==='Enter'&&ev.target===this)selectLot($(this).data('id'));})
    .on('click.find','.vl',function(){
      const id=$(this).data('id');
      selectLot(id,{card:false});showLot(id);
      setTimeout(()=>document.getElementById('layout')?.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'}),120);
    })
    .on('click.find','.rt',function(){
      const lot=$(this).data('id'),btn=this;
      const go=(la,lo)=>busy(btn,()=>route(lot,la,lo),200);
      if($(this).data('m')==='me'){
        if(!navigator.geolocation)return ui.toast('This browser cannot share your location','warn');
        navigator.geolocation.getCurrentPosition(p=>go(p.coords.latitude,p.coords.longitude),()=>ui.toast('Could not get your location','warn'));
      }else{
        const bb=B.find(x=>x._id===$('#fb').val());go(bb.location.latitude,bb.location.longitude);
      }
    });

  await run();
}

function slotButton(s){
  const type=vehicleTypeClass(s.vehicleType),typeLabel=TL[s.vehicleType]||s.vehicleType;
  const statusLabel={AVAILABLE:'Available',RESERVED:'Reserved',OCCUPIED:'Occupied',MAINTENANCE:'Maintenance'}[s.status]||s.status;
  const av=s.status==='AVAILABLE';
  return `<button type="button" class="parking-slot ${type} status-${String(s.status).toLowerCase()}${av?'':' disabled'}" data-id="${s._id}" data-status="${s.status}" title="${s.slotNumber} · ${typeLabel} · ${statusLabel}" ${av?'':'disabled'}>
    <span class="parking-slot-number">${s.slotNumber}</span><span class="parking-slot-status-dot" aria-hidden="true"></span></button>`;
}

async function showLot(id){
  clearInterval(poll);
  $('#layout').html(`<section class="parking-layout-shell fx-in"><div class="parking-lot-card"><div class="sk" style="height:34px;width:40%;margin-bottom:16px"></div>${skel.slots(12)}</div></section>`);
  const lots=await api('GET','/parking/lots');
  const lotName=lots.find(x=>x._id===id)?.name||'Parking Lot';
  let first=true;

  const draw=async()=>{
    if(!$('#layout').length)return clearInterval(poll);
    const S=await api('GET',`/parking/lots/${id}/slots`);
    const active=S.filter(s=>s.active).sort((a,b)=>a.slotNumber.localeCompare(b.slotNumber,undefined,{numeric:true}));
    const total=active.length,cnt=k=>active.filter(s=>s.status===k).length,available=cnt('AVAILABLE');
    const pct=total?Math.round(available/total*100):0;
    const chunks=[];
    for(let i=0;i<active.length;i+=12){
      chunks.push(`<div class="parking-slot-grid" data-key="g${i}">${active.slice(i,i+12).map(slotButton).join('')}</div>`);
      if(i+12<active.length)chunks.push(`<div class="parking-pedestrian-walk" data-key="w${i}">PEDESTRIAN WALK</div>`);
    }
    const html=`<section class="parking-layout-shell${first?' fx-in':''}"><div class="parking-lot-card">
      <div class="parking-lot-header">
        <div class="parking-lot-title"><span class="parking-lot-badge" aria-hidden="true">P</span>
          <div><h5>${lotName}</h5><div class="parking-lot-meta">${total} spaces · ${available} available</div></div></div>
        <strong class="parking-lot-percent">${pct}%</strong>
      </div>
      <div class="parking-slots-wrap">${chunks.join('')||'<div class="empty">No active parking spaces in this lot.</div>'}</div>
      <div class="parking-legend"><span class="parking-legend-title">STATUS</span>
        <span><i class="parking-status-dot available"></i>Available</span><span><i class="parking-status-dot reserved"></i>Reserved</span>
        <span><i class="parking-status-dot occupied"></i>Occupied</span><span><i class="parking-status-dot maintenance"></i>Maintenance</span></div>
      <div class="parking-legend parking-type-legend"><span class="parking-legend-title">VEHICLE</span>
        <span><i class="parking-type-swatch four-wheeler"></i>4 Wheeler</span><span><i class="parking-type-swatch two-wheeler"></i>2 Wheeler</span><span><i class="parking-type-swatch cycle"></i>Cycle</span></div>
    </div></section>`;
    if(first)$('#layout').html(html);else morph('#layout',html);
    first=false;
  };

  // Delegated, so it keeps working as slots change state underneath it.
  $('#layout').off('click.slot').on('click.slot','.parking-slot.status-available',async function(){
    const b=$(this);
    if(b.hasClass('reserving'))return;
    if(!await ui.confirm(`Reserve slot ${b.find('.parking-slot-number').text()}?`,{ok:'Reserve'}))return;
    b.addClass('reserving');
    let r;
    try{r=await api('POST','/reservations',{vehicleId:$('#fv').val(),slotId:b.data('id')});}
    catch(e){b.removeClass('reserving');return;}
    b.removeClass('reserving');
    if(!r)return;
    // Available -> reserved right here (colour + indicator transition), then on to the countdown.
    b.removeClass('status-available').addClass('status-reserved flip').attr({'data-status':'RESERVED',disabled:true});
    b.addClass('has-car').append(`<span class="bay-car lit" aria-hidden="true">${CAR}</span>`);
    clearInterval(poll);
    ui.toast('Bay reserved. Scan its code when you arrive, before the hold runs out.');
    sessionStorage.setItem('flash','Bay reserved. Scan its code when you arrive, before the hold runs out.');
    setTimeout(()=>{location='/user/reservations';},MS(1100));
  });

  await draw();
  poll=setInterval(draw,5000);
}

/* ===== Reservations (countdown) and active parking ===== */
const RING=2*Math.PI*21;

function reservationCard(r){
  const t=vehicleTypeClass(r.vehicleId.vehicleType);
  const total=r.createdAt?Math.max(60,(new Date(r.expiresAt)-new Date(r.createdAt))/1000):600;
  return `<div class="cx" data-id="${r._id}" data-slot="${r.slotId._id}"><div class="card card-body mb-0 rc fx-in" data-e="${r.expiresAt}" data-total="${Math.round(total)}">
    <div class="rc-row">
      <div class="ring" role="timer" aria-label="Time left on your reservation">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle class="rg-bg" cx="24" cy="24" r="21"/><circle class="rg-fg" cx="24" cy="24" r="21" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="0"/></svg>
        <span class="rg-t">--:--</span>
      </div>
      <div class="rc-info">
        <div><span class="plate ${t}" style="${vehicleTypeStyle(r.vehicleId.vehicleType)}">${r.vehicleId.vehicleNumber}</span> → <b>${r.slotId.slotNumber}</b> <span class="text-muted">(${r.parkingLotId.name})</span></div>
        <small class="rc-sub">Scan the QR code at the bay to confirm your parking.</small>
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger cr" data-id="${r._id}">Cancel</button>
    </div></div></div>`;
}

function sessionCard(s){
  const t=vehicleTypeClass(s.vehicleId.vehicleType);
  return `<div class="cx" data-id="${s._id}"><div class="card card-body mb-0 fx-in">
    Vehicle: <span class="plate ${t}" style="${vehicleTypeStyle(s.vehicleId.vehicleType)}">${s.vehicleId.vehicleNumber}</span><br>
    ${s.parkingLotId.buildingId?.name||''} · Slot ${s.slotId.slotNumber}<br>
    Started ${fmt(s.startTime)} · <span class="du" data-s="${s.startTime}"></span>
    <div><button type="button" class="btn btn-danger mt-2 lv" data-id="${s._id}">LEAVE PARKING</button></div>
  </div></div>`;
}

async function act(){
  const res=MODE==='res';
  const EMPTY=res?'No bay held right now. Reserve one from Find parking.':'You are not parked anywhere.';
  $('#pane').html(res?`
    <div id="rsv"><h5>Reservations</h5><div id="rl" class="cxl">${skel.cards(2)}</div>
      <div class="card card-body mb-3 fx-in"><b>Verify slot QR</b>
        <div class="input-group fld-g"><input id="qt" class="form-control" placeholder="Paste QR link/token (or scan with phone camera)" aria-label="QR token">
        <button type="button" id="qb" class="btn btn-success">Verify</button></div></div>
    </div>`:`<div id="cur"><h5>Current parking</h5><div id="sl" class="cxl">${skel.cards(1)}</div></div>`);

  const list=$(res?'#rl':'#sl');
  let loaded=false;

  const reconcile=items=>{
    const ids=new Set(items.map(x=>x._id));
    if(!loaded){list.empty();loaded=true;}
    list.children('.cx').each(function(){
      const el=$(this);
      if(!ids.has(el.data('id'))&&!el.data('keep')&&!el.hasClass('collapsing'))collapse(el);
    });
    items.forEach(x=>{if(!list.children(`.cx[data-id="${x._id}"]`).length)list.append(res?reservationCard(x):sessionCard(x));});
    const has=list.children('.cx:not(.collapsing)').length>0;
    if(!has&&!list.children('.empty-msg').length)list.append(`<p class="empty empty-msg fx-in">${EMPTY}</p>`);
    if(has)list.children('.empty-msg').remove();
  };

  const sync=async()=>{
    try{reconcile(res?await api('GET','/reservations'):await api('GET','/parking/sessions/active'));}catch(e){}
  };

  // One animation loop drives every ring and clock on the page.
  let lastSec=-1;
  const tick=()=>{
    if(!document.contains(list[0]))return;
    const now=Date.now(),sec=Math.floor(now/1000);
    $('.rc:not(.ended)').each(function(){
      const el=$(this),left=(new Date(el.data('e'))-now)/1000,total=+el.data('total')||600;
      const frac=Math.max(0,Math.min(1,left/total));
      el.find('.rg-fg').attr('stroke-dashoffset',(RING*(1-frac)).toFixed(2));
      const warn=left<=120;
      el.toggleClass('warn',warn);
      if(sec!==lastSec){
        const s=Math.max(0,Math.ceil(left));
        el.find('.rg-t').text(`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`);
        el.find('.rc-sub').text(warn?`Less than 2 minutes left. Scan the QR code at the bay to keep it.`:'Scan the QR code at the bay to confirm your parking.');
      }
      if(left<=-1)expireCard(el);
    });
    if(sec!==lastSec){
      $('.du').each(function(){const m=Math.max(0,Math.floor((now-new Date($(this).data('s')))/6e4));$(this).text(`Duration ${Math.floor(m/60)}h ${m%60}m`);});
      lastSec=sec;
    }
    requestAnimationFrame(tick);
  };

  const expireCard=el=>{
    if(el.hasClass('ended'))return;
    el.addClass('ended expired');
    el.find('.rg-fg').attr('stroke-dashoffset',RING.toFixed(2));el.find('.rg-t').text('0:00');
    el.find('.rc-sub').text('Reservation expired. The bay has been released.');
    el.find('.cr').remove();
    ui.toast('Reservation expired. The bay is available again.','warn');
    setTimeout(()=>collapse(el.closest('.cx'),sync),MS(1400));
  };

  list.on('click','.cr',function(){
    const btn=this,cx=$(btn).closest('.cx');
    busy(btn,async()=>{
      await api('POST',`/reservations/${$(btn).data('id')}/cancel`);
      cx.find('.rc').addClass('ended');
      ui.toast('Reservation cancelled. The bay is available again.');
      collapse(cx,sync);
    },250);
  });
  list.on('click','.lv',function(){
    const btn=this,cx=$(btn).closest('.cx');
    busy(btn,async()=>{
      await api('POST',`/parking/sessions/${$(btn).data('id')}/leave`);
      ui.toast('Parking ended. The bay is free again.');
      await driveAway(cx);
      collapse(cx,sync);
    },250);
  });

  if(res){
    const verify=()=>busy('#qb',async()=>{
      const raw=$('#qt').val().trim();
      if(!raw){ui.shake('#qt');ui.toast('Paste the QR link or token first.','warn');return;}
      const s=await api('POST','/qr/verify',{token:(raw.match(/(\w{32})\s*$/)||[])[1]||raw});
      if(!s)return;
      $('#qt').val('');
      // Reservation card -> "Parking confirmed".
      const cx=list.children(`.cx[data-slot="${s.slotId}"]`).first();
      if(cx.length){
        cx.data('keep',1).find('.rc').addClass('ended confirmed').html(`<div class="rc-ok" role="status">${CHECK}
          <div><b>Parking confirmed</b><small>Your session started ${new Date(s.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. Enjoy your stay.</small></div>
          <button type="button" class="btn btn-sm btn-outline-dark" data-go="/user/active-parking">View active parking</button></div>`);
        if(!list.children('.cx:not(.collapsing)').not(cx).length)list.children('.empty-msg').remove();
      }else ui.toast('Parking confirmed.');
    },300);
    $('#qb').on('click',verify);
    $('#qt').on('keydown',e=>{if(e.key==='Enter')verify();});
  }

  await sync();
  requestAnimationFrame(tick);
  poll=setInterval(sync,res?6000:20000);
}

async function hist(){$('#pane').html(skel.table(5));

  const H=
    await api(
      'GET',
      '/parking/sessions'
    );

  const st=
    await api(
      'GET',
      '/statistics/my'
    );

  $('#pane').html(`
    <p>
      Total sessions:
      <b>${st.totalSessions}</b>
      ·
      Total minutes:
      <b>${st.totalMinutes}</b>
      ·
      Most used:
      <b>${st.mostUsedLot||'-'}</b>
    </p>

    <table class="table bg-white">

      <tr>
        <th>Vehicle
        <th>Building
        <th>Lot
        <th>Slot
        <th>Start
        <th>End
        <th>Min
        <th>Status
      </tr>

      ${
        H.map(s=>`
          <tr>

            <td>
              <span
                class="
                  plate
                  ${vehicleTypeClass(s.vehicleId?.vehicleType)}
                "
                style="${vehicleTypeStyle(s.vehicleId?.vehicleType)}">

                ${s.vehicleId?.vehicleNumber}

              </span>

            <td>
              ${s.parkingLotId?.buildingId?.name}

            <td>
              ${s.parkingLotId?.name}

            <td>
              ${s.slotId?.slotNumber}

            <td>
              ${fmt(s.startTime)}

            <td>
              ${s.endTime?fmt(s.endTime):'-'}

            <td>
              ${s.durationMinutes||'-'}

            <td>
              <span class="tag ${s.status}">
                ${s.status}
              </span>

          </tr>
        `).join('')
      }

    </table>
  `);
}

async function adm(){$('#pane').html(skel.cards(3));

  const st=
    await api(
      'GET',
      '/admin/statistics'
    );

  const P=
    await api(
      'GET',
      '/admin/vehicles/pending'
    );

  const se=
    await api(
      'GET',
      '/admin/settings'
    );

  const lots=
    await api(
      'GET',
      '/parking/lots'
    );

  $('#pane').html(`

    <div class="row mb-3">

      ${
        [
          ['Users',st.users],
          ['Vehicles',st.vehicles],
          ['Pending',st.pendingVehicles],
          ['Slots',st.totalSlots],
          ['Available',st.slots.AVAILABLE||0],
          ['Reserved',st.slots.RESERVED||0],
          ['Occupied',st.slots.OCCUPIED||0],
          ['Maintenance',st.slots.MAINTENANCE||0],
          ['Active sessions',st.activeSessions],
          ['Today',st.todaySessions],
          ['Avg min',st.avgDurationMinutes],
          ['Top lot',st.mostUsedLot||'-']
        ]
        .map(x=>`
          <div class="col-6 col-md-2">

            <div class="card card-body mb-2 text-center">

              <small>
                ${x[0]}
              </small>

              <b>
                ${x[1]}
              </b>

            </div>

          </div>
        `)
        .join('')
      }

    </div>

    <h6>
      Peak parking hours
    </h6>

    <div class="mb-3">

      ${
        st.peakHours.map(p=>`

          <div
            class="d-flex align-items-center mb-1">

            <span style="width:60px">
              ${p.hour}:00
            </span>

            <div
              class="bg-primary"
              style="
                height:16px;
                width:${Math.round(
                  p.sessions/
                  st.peakHours[0].sessions*
                  300
                )}px">
            </div>

            <span class="ms-2">
              ${p.sessions}
            </span>

          </div>

        `).join('')||
        '-'
      }

    </div>

    <h5>
      Pending vehicles
    </h5>

    <table class="table bg-white">

      ${
        P.map(v=>`
          <tr>

            <td>

              <span
                class="
                  plate
                  ${vehicleTypeClass(v.vehicleType)}
                "
                style="${vehicleTypeStyle(v.vehicleType)}">

                ${v.vehicleNumber}

              </span>

            <td>

              <span
                class="
                  vehicle-type-label
                  ${vehicleTypeClass(v.vehicleType)}
                "
                style="${vehicleTypeStyle(v.vehicleType)}">

                ${TL[v.vehicleType]||v.vehicleType}

              </span>

            <td>
              ${v.userId?.name}

            <td>

              <button type="button"
                class="btn btn-sm btn-success ap"
                data-id="${v._id}">
                Approve
              </button>

              <button type="button"
                class="btn btn-sm btn-danger rj"
                data-id="${v._id}">
                Reject
              </button>

          </tr>
        `).join('')
      }

    </table>

    <h5>
      Settings
    </h5>

    <div class="row g-2 mb-3">

      ${
        [
          ['maxVehiclesPerUser','Max vehicles'],
          ['guestPassValidityHours','Guest pass (h)'],
          ['parkingPassValidityHours','Parking pass (h)'],
          ['reservationWindowMinutes','Reservation (min)']
        ]
        .map(k=>`
          <div class="col">

            <label>
              ${k[1]}
            </label>

            <input
              class="form-control st"
              data-k="${k[0]}"
              type="number"
              min="1"
              value="${se[k[0]]}">

          </div>
        `)
        .join('')
      }

      <div class="col-auto align-self-end">

        <button type="button"
          id="ss"
          class="btn btn-primary">
          Save
        </button>

      </div>

    </div>

    <h5>
      Slot QR codes
    </h5>

    <select
      id="ql"
      class="form-select mb-2">

      ${
        lots.map(l=>`
          <option value="${l._id}">
            ${l.name}
          </option>
        `).join('')
      }

    </select>

    <div
      id="qrs"
      class="d-flex flex-wrap gap-2">
    </div>

  `);

  $('.ap').click(
    async function(){

      await api(
        'POST',
        `/admin/vehicles/${$(this).data('id')}/approve`
      );

      adm();
    }
  );

  $('.rj').click(
    async function(){

      await api(
        'POST',
        `/admin/vehicles/${$(this).data('id')}/reject`,
        {
          reason:
            await ui.prompt('Reason?')||
            ''
        }
      );

      adm();
    }
  );

  $('#ss').click(
    async()=>{

      const d={};

      $('.st').each(
        function(){
          d[$(this).data('k')] =
            $(this).val();
        }
      );

      await api(
        'PUT',
        '/admin/settings',
        d
      );

      ui.toast(
        'Settings saved'
      );
    }
  );

  $('#ql').change(
    async()=>{

      if(!$('#ql').val()){
        return $('#qrs').html(
          '<p class="empty">'+
          'No parking lots yet.'+
          '</p>'
        );
      }

      const S=
        await api(
          'GET',
          `/parking/lots/${$('#ql').val()}/slots`
        );

      $('#qrs').html('');

      for(const s of S){

        const q=
          await api(
            'GET',
            '/qr/'+s._id
          );

        $('#qrs').append(`
          <div class="card card-body text-center">

            <img
              src="${q.dataUrl}"
              width="120">

            <b>
              SLOT ${q.slot}
            </b>

          </div>
        `);
      }
    }
  ).change();
}

const tile=id=>{

  map=
    L.map(id)
    .setView(
      [12.969243,79.155883],
      17
    );

  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution:'© OpenStreetMap'
    }
  ).addTo(map);

  map.on(
    'click',
    e=>{

      $('#la').val(
        e.latlng.lat.toFixed(6)
      );

      $('#lo').val(
        e.latlng.lng.toFixed(6)
      );

      if(pick){
        map.removeLayer(pick);
      }

      pick=
        L.marker(
          e.latlng
        ).addTo(map);
    }
  );
};

const geo=`
  <div class="col-md-2">
    <input
      id="la"
      class="form-control"
      placeholder="Latitude">
  </div>

  <div class="col-md-2">
    <input
      id="lo"
      class="form-control"
      placeholder="Longitude">
  </div>
`;

const loc=()=>({
  latitude:+$('#la').val(),
  longitude:+$('#lo').val()
});

const geoErr=()=>{

  const a=$('#la').val();
  const o=$('#lo').val();

  return (
    !a||
    !o||
    isNaN(+a)||
    isNaN(+o)||
    Math.abs(+a)>90||
    Math.abs(+o)>180
      ? 'Enter a latitude and longitude, or click the map'
      : null
  );
};

async function b(){$('#pane').html(skel.rows(1,42)+'<div class="sk" style="height:260px;margin-top:.8rem"></div>');

  const B=
    await api(
      'GET',
      '/buildings'
    );

  $('#pane').html(`
    <p class="text-muted">
      Click the map to fill coordinates.
    </p>

    <div
      class="map mb-2"
      id="m">
    </div>

    <div class="row g-2 mb-3">

      <div class="col-md-3">

        <input
          id="n"
          class="form-control"
          placeholder="Name">

      </div>

      <div class="col-md-2">

        <input
          id="c"
          class="form-control"
          placeholder="Code">

      </div>

      ${geo}

      <div class="col">

        <button type="button"
          id="add"
          class="btn btn-primary">
          Add building
        </button>

      </div>

    </div>

    <table class="table bg-white">

      <tr>
        <th>Name
        <th>Code
        <th>Lat
        <th>Lng
        <th>
      </tr>

      ${
        B.map(x=>`
          <tr>

            <td>
              ${x.name}

            <td>
              ${x.code}

            <td>
              ${x.location.latitude}

            <td>
              ${x.location.longitude}

            <td>

              <button type="button"
                class="btn btn-sm btn-outline-secondary ed"
                data-id="${x._id}"
                data-v="${x.name}, ${x.location.latitude}, ${x.location.longitude}">
                Edit
              </button>

              <button type="button"
                class="btn btn-sm btn-outline-danger dl"
                data-id="${x._id}">
                Deactivate
              </button>

          </tr>
        `).join('')
      }

    </table>
  `);

  tile('m');

  B.forEach(x=>
    L.marker([
      x.location.latitude,
      x.location.longitude
    ])
    .addTo(map)
    .bindPopup(x.name)
  );

  $('#add').click(
    async()=>{

      if(
        !$('#n').val().trim()||
        !$('#c').val().trim()
      ){
        return ui.toast(
          'Building name and code are required',
          'warn'
        );
      }

      const ge=geoErr();

      if(ge){
        return ui.toast(
          ge,
          'warn'
        );
      }

      await api(
        'POST',
        '/admin/buildings',
        {
          name:$('#n').val(),
          code:$('#c').val(),
          location:loc()
        }
      );

      b();
    }
  );

  $('.ed').click(
    async function(){

      const v=
        await ui.prompt(
          'name, latitude, longitude',
          $(this).data('v')
        );

      if(v){

        const[
          n,
          la,
          lo
        ]=
          v.split(',')
           .map(x=>x.trim());

        await api(
          'PUT',
          '/admin/buildings/'+
          $(this).data('id'),
          {
            name:n,
            location:{
              latitude:+la,
              longitude:+lo
            }
          }
        );

        b();
      }
    }
  );

  $('.dl').click(
    async function(){

      if(
        await ui.confirm(
          'Deactivate building?'
        )
      ){

        await api(
          'DELETE',
          '/admin/buildings/'+
          $(this).data('id')
        );

        b();
      }
    }
  );
}

async function l(){$('#pane').html(skel.rows(1,42)+'<div class="sk" style="height:260px;margin-top:.8rem"></div>');

  const B=
    await api(
      'GET',
      '/buildings'
    );

  const Ls=
    await api(
      'GET',
      '/parking/lots'
    );

  const bn=
    Object.fromEntries(
      B.map(
        x=>[x._id,x.name]
      )
    );

  $('#pane').html(`
    ${
      B.length
        ? ''
        : '<div class="alert alert-danger">'+
          'No buildings exist yet. '+
          'Create a building before adding lots. '+
          '<button type="button" class="btn btn-sm btn-outline-dark ms-1" data-go="/admin/buildings">Go to buildings</button>'+
          '</div>'
    }

    <div
      class="map mb-2"
      id="m">
    </div>

    <div class="row g-2 mb-3">

      <div class="col-md-2">

        <select
          id="bs"
          class="form-select">

          <option value="">
            Choose building…
          </option>

          ${
            B.map(x=>`
              <option value="${x._id}">
                ${x.name}
              </option>
            `).join('')
          }

        </select>

      </div>

      <div class="col-md-3">

        <input
          id="n"
          class="form-control"
          placeholder="Lot name">

      </div>

      <div class="col-md-1">

        <input
          id="c"
          class="form-control"
          placeholder="Code">

      </div>

      ${geo}

      <div class="col">

        <button type="button"
          id="add"
          class="btn btn-primary">
          Add lot
        </button>

      </div>

    </div>

    <table class="table bg-white">

      <tr>
        <th>Lot
        <th>Building
        <th>Code
        <th>
      </tr>

      ${
        Ls.map(x=>`
          <tr>

            <td>
              ${x.name}

            <td>
              ${bn[x.buildingId]||'-'}

            <td>
              ${x.code}

            <td>

              <button type="button"
                class="btn btn-sm btn-outline-secondary ed"
                data-id="${x._id}"
                data-v="${x.name}, ${x.location.latitude}, ${x.location.longitude}">
                Edit
              </button>

              <button type="button"
                class="btn btn-sm btn-outline-danger dl"
                data-id="${x._id}">
                Deactivate
              </button>

          </tr>
        `).join('')
      }

    </table>
  `);

  tile('m');

  Ls.forEach(x=>
    L.circleMarker([
      x.location.latitude,
      x.location.longitude
    ])
    .addTo(map)
    .bindPopup(x.name)
  );

  $('#add').click(
    async()=>{

      if(!$('#bs').val()){
        return ui.toast(
          'Choose a building first. Create one under Buildings if the list is empty.',
          'warn'
        );
      }

      if(
        !$('#n').val().trim()||
        !$('#c').val().trim()
      ){
        return ui.toast(
          'Lot name and code are required',
          'warn'
        );
      }

      const ge=geoErr();

      if(ge){
        return ui.toast(
          ge,
          'warn'
        );
      }

      await api(
        'POST',
        '/admin/parking/lots',
        {
          buildingId:$('#bs').val(),
          name:$('#n').val(),
          code:$('#c').val(),
          location:loc()
        }
      );

      l();
    }
  );

  $('.ed').click(
    async function(){

      const v=
        await ui.prompt(
          'name, latitude, longitude',
          $(this).data('v')
        );

      if(v){

        const[
          n,
          la,
          lo
        ]=
          v.split(',')
           .map(x=>x.trim());

        await api(
          'PUT',
          '/admin/parking/lots/'+
          $(this).data('id'),
          {
            name:n,
            location:{
              latitude:+la,
              longitude:+lo
            }
          }
        );

        l();
      }
    }
  );

  $('.dl').click(
    async function(){

      if(
        await ui.confirm(
          'Deactivate lot?'
        )
      ){

        await api(
          'DELETE',
          '/admin/parking/lots/'+
          $(this).data('id')
        );

        l();
      }
    }
  );
}

// ---------- layout editor

let S=[],
    sel=null,
    dirty=new Set(),
    lot=null,
    addingSlot=false;

const slotStatusColor=s=>({
  OCCUPIED:'#e74c3c',
  MAINTENANCE:'#111827',
  RESERVED:'#b58a3b'
}[s.status]||
VEHICLE_TYPE_COLORS[s.vehicleType]||
'#64748b');

// Fixed 7-column grid.
// Slots fill left-to-right and then continue
// on the next row.

const EDITOR_GRID={
  startX:8,
  startY:8,
  slotW:64,
  slotH:54,
  gapX:8,
  gapY:8,
  columns:7,
  minRows:5
};

EDITOR_GRID.stepX=
  EDITOR_GRID.slotW+
  EDITOR_GRID.gapX;

EDITOR_GRID.stepY=
  EDITOR_GRID.slotH+
  EDITOR_GRID.gapY;

const slotOrder=(a,b)=>
  String(a.slotNumber||'')
    .localeCompare(
      String(b.slotNumber||''),
      undefined,
      {
        numeric:true,
        sensitivity:'base'
      }
    );

const gridPosition=index=>({
  x:
    EDITOR_GRID.startX+
    (index%EDITOR_GRID.columns)*
    EDITOR_GRID.stepX,

  y:
    EDITOR_GRID.startY+
    Math.floor(
      index/EDITOR_GRID.columns
    )*
    EDITOR_GRID.stepY
});

const gridIndexFromCell=(col,row)=>
  Math.max(0,row)*
  EDITOR_GRID.columns+
  Math.max(0,col);

const gridCellForPosition=pos=>{

  if(!pos)return null;

  const x=Number(pos.x);
  const y=Number(pos.y);

  if(
    !Number.isFinite(x)||
    !Number.isFinite(y)
  ){
    return null;
  }

  const col=
    Math.round(
      (
        x-
        EDITOR_GRID.startX
      )/
      EDITOR_GRID.stepX
    );

  const row=
    Math.round(
      (
        y-
        EDITOR_GRID.startY
      )/
      EDITOR_GRID.stepY
    );

  if(
    col<0||
    col>=EDITOR_GRID.columns||
    row<0
  ){
    return null;
  }

  const index=
    gridIndexFromCell(
      col,
      row
    );

  const p=
    gridPosition(index);

  return (
    Math.abs(x-p.x)<=3&&
    Math.abs(y-p.y)<=3
      ? {
          col,
          row,
          index
        }
      : null
  );
};

const slotAtGridIndex=(
  index,
  ignoreId=null
)=>
  S.find(
    s=>
      s._id!==ignoreId&&
      gridCellForPosition(
        s.position
      )?.index===index
  );

const firstFreeGridIndex=()=>{

  for(
    let i=0;
    i<S.length+1;
    i++
  ){

    if(
      !slotAtGridIndex(i)
    ){
      return i;
    }
  }

  return S.length;
};

// Detect old layouts.
//
// Older versions generated diagonal positions such as:
// 0, 8, 16, 24...
//
// Those positions are technically valid grid cells, so
// checking only whether a position is on the grid is
// not enough.

const needsGridMigration=()=>{

  const ordered=
    [...S].sort(
      slotOrder
    );

  if(
    ordered.length<1
  ){
    return false;
  }

  const cells=
    ordered.map(
      s=>
        gridCellForPosition(
          s.position
        )
    );

  if(
    cells.some(
      c=>!c
    )
  ){
    return true;
  }

  const indexes=
    cells.map(
      c=>c.index
    );

  if(
    new Set(indexes).size!==
    indexes.length
  ){
    return true;
  }

  // Specifically detect the old diagonal pattern.
  if(
    ordered.length>=2
  ){

    const deltas=[];

    for(
      let i=1;
      i<indexes.length;
      i++
    ){

      deltas.push(
        indexes[i]-
        indexes[i-1]
      );
    }

    const sameDelta=
      deltas.every(
        d=>d===deltas[0]
      );

    if(
      sameDelta&&
      deltas[0]>1
    ){
      return true;
    }
  }

  return false;
};

const migrateToRows=async()=>{

  if(
    !needsGridMigration()
  ){
    return false;
  }

  const ordered=
    [...S].sort(
      slotOrder
    );

  for(
    let i=0;
    i<ordered.length;
    i++
  ){

    const position=
      gridPosition(i);

    ordered[i].position=
      position;

    await api(
      'PUT',
      '/admin/parking/slots/'+
      ordered[i]._id,
      {
        position
      }
    );
  }

  ui.toast(
    'Existing slot positions were arranged into rows.'
  );

  return true;
};

const nextSlotInfo=()=>{

  const nums=
    S.map(s=>{

      const m=
        String(
          s.slotNumber||''
        ).match(
          /^(.*?)(?:[-\s]?)(\d+)$/
        );

      return m
        ? {
            prefix:m[1]||'A',
            n:+m[2]
          }
        : null;
    })
    .filter(Boolean);

  const prefix=
    nums.length
      ? nums
          .slice()
          .sort(
            (a,b)=>b.n-a.n
          )[0].prefix
      : 'A';

  const n=
    nums.length
      ? Math.max(
          ...nums.map(
            x=>x.n
          )
        )+1
      : 1;

  return {
    number:
      `${prefix}-${String(n).padStart(2,'0')}`
  };
};

const editorRows=()=>Math.max(
  EDITOR_GRID.minRows,
  Math.ceil(
    Math.max(
      S.length,
      1
    )/
    EDITOR_GRID.columns
  )
);

const sizeEditorCanvas=()=>{

  const rows=
    editorRows();

  const width=
    EDITOR_GRID.startX*2+
    EDITOR_GRID.columns*
    EDITOR_GRID.slotW+
    (
      EDITOR_GRID.columns-1
    )*
    EDITOR_GRID.gapX;

  const height=
    EDITOR_GRID.startY*2+
    rows*
    EDITOR_GRID.slotH+
    (
      rows-1
    )*
    EDITOR_GRID.gapY;

  const cv=$('#cv');

  cv.css({
    position:'relative',
    width:`${width}px`,
    height:`${height}px`,
    maxWidth:'100%',
    overflow:'auto',
    boxSizing:'border-box'
  });
};

async function e(){$('#pane').html(skel.rows(1,42)+'<div class="sk" style="height:300px;margin-top:.8rem"></div>');

  const Ls=
    await api(
      'GET',
      '/parking/lots'
    );

  if(!Ls.length){

    return $('#pane').html(
      '<p class="empty">'+
      'No parking lots yet. '+
      'Create a lot first, then lay out its bays here. '+
      '<button type="button" class="btn btn-sm btn-outline-dark ms-1" data-go="/admin/parking-lots">Go to parking lots</button>'+
      '</p>'
    );
  }

  $('#pane').html(`

    <div class="row g-2 mb-2">

      <div class="col-md-3">

        <select
          id="ls"
          class="form-select">

          ${
            Ls.map(x=>`
              <option value="${x._id}">
                ${x.name}
              </option>
            `).join('')
          }

        </select>

      </div>

      <div class="col-md-2">

        <select
          id="ast"
          class="form-select"
          title="Vehicle type for new slots">

          <option value="FOUR_WHEELER">
            4 Wheeler
          </option>

          <option value="TWO_WHEELER">
            2 Wheeler
          </option>

          <option value="CYCLE">
            Cycle
          </option>

        </select>

      </div>

      <div class="col-auto">

        <button type="button"
          id="as"
          class="btn btn-outline-primary">
          + Add slot
        </button>

        <button type="button"
          id="sv"
          class="btn btn-success">
          Save layout
        </button>

        <button type="button"
          id="pq"
          class="btn btn-outline-dark">
          Print QR codes
        </button>

      </div>

    </div>

    <div class="row">

      <div class="col-lg-8">

        <div
          class="parking-editor-canvas-wrap">
          <div id="cv"></div>
        </div>

        <div
          id="layout-legend"
          class="parking-editor-legend">
        </div>

        <small class="text-muted">
          Slots fill each row from left to right,
          then continue on the next row.
          Drag a slot to any cell.
          Occupied cells can be swapped.
        </small>

      </div>

      <div class="col-lg-4">

        <div
          class="card card-body"
          id="ep">
          Select a slot
        </div>

      </div>

    </div>

    <div
      id="qrp"
      class="d-flex flex-wrap gap-3 mt-3">
    </div>
  `);

  $('#ls').change(
    load
  );

  $('#as').click(
    async()=>{

      if(
        addingSlot
      ){
        return;
      }

      addingSlot=true;

      const btn=
        $('#as').prop(
          'disabled',
          true
        );

      try{

        // Repair old layouts before
        // calculating the next position.

        await migrateToRows();

        const vehicleType=
          $('#ast').val()||
          'FOUR_WHEELER';

        const info=
          nextSlotInfo();

        // Always use the first free
        // row-major grid cell.

        const index=
          firstFreeGridIndex();

        const position=
          gridPosition(
            index
          );

        const created=
          await api(
            'POST',
            `/admin/parking/lots/${lot}/slots`,
            {
              slotNumber:
                info.number,

              vehicleType,

              position
            }
          );

        if(created){

          ui.toast(
            `${TL[vehicleType]||vehicleType} slot ${info.number} added.`
          );

          await load();
        }

      }finally{

        addingSlot=false;

        btn.prop(
          'disabled',
          false
        );
      }
    }
  );

  $('#sv').click(
    function(){busy(this,async()=>{

      for(
        const id of dirty
      ){

        const s=
          S.find(
            x=>x._id===id
          );

        if(s){

          await api(
            'PUT',
            '/admin/parking/slots/'+
            id,
            {
              position:
                s.position
            }
          );
        }
      }

      dirty.clear();

      ui.toast(
        'Layout saved'
      );
    });}
  );

  $('#pq').click(
    async()=>{

      $('#qrp').html('');

      for(
        const s of S
      ){

        const q=
          await api(
            'GET',
            '/qr/'+s._id
          );

        $('#qrp').append(`
          <div
            class="card card-body text-center">

            <img
              src="${q.dataUrl}"
              width="140">

            <b>
              SLOT ${q.slot}
            </b>

          </div>
        `);
      }

      setTimeout(
        ()=>window.print(),
        400
      );
    }
  );

  renderEditorLegend();

  await load();
}

function renderEditorLegend(){

  $('#layout-legend').html(`

    <div class="parking-editor-legend-title">
      VEHICLE TYPE
    </div>

    <span>
      <i
        class="editor-swatch"
        style="background:#2563eb">
      </i>
      4 Wheeler
    </span>

    <span>
      <i
        class="editor-swatch"
        style="background:#f59e0b">
      </i>
      2 Wheeler
    </span>

    <span>
      <i
        class="editor-swatch"
        style="background:#16a34a">
      </i>
      Cycle
    </span>

    <div
      class="parking-editor-legend-title editor-status-title">
      STATUS
    </div>

    <span>
      <i
        class="editor-swatch"
        style="background:#b58a3b">
      </i>
      Reserved
    </span>

    <span>
      <i
        class="editor-swatch"
        style="background:#e74c3c">
      </i>
      Occupied
    </span>

    <span>
      <i
        class="editor-swatch"
        style="background:#111827">
      </i>
      Maintenance
    </span>

  `);
}

async function load(){
  await flushDeletes();
  lot=
    $('#ls').val();

  sel=null;

  dirty.clear();

  if(!lot){
    return;
  }

  S=
    await api(
      'GET',
      `/parking/lots/${lot}/slots`
    );

  // Convert old diagonal positions
  // before rendering.

  await migrateToRows();

  sizeEditorCanvas();

  draw();

  panel();
}

function draw(){

  sizeEditorCanvas();

  // Never render multiple invalid/duplicate slots on top
  // of the first cell. If the API contains an old position
  // format, give that slot the first unused row-major cell.
  // This keeps every slot visible and draggable even before
  // the layout is saved.
  const used=new Set();
  const known=new Set($('#cv .editor-slot').map(function(){return $(this).data('id');}).get());

  morph('#cv',
    S.map(
      (s,index)=>{

        const color=
          slotStatusColor(
            s
          );

        const type=
          vehicleTypeClass(
            s.vehicleType
          );

        const inactive=
          s.active
            ? ''
            : ' off';

        let cell=
          gridCellForPosition(
            s.position
          );

        if(
          !cell||
          used.has(cell.index)
        ){
          let fallback=0;

          while(
            used.has(fallback)
          ){
            fallback++;
          }

          cell={
            ...(()=>{
              const col=fallback%EDITOR_GRID.columns;
              const row=Math.floor(fallback/EDITOR_GRID.columns);
              return {
                col,
                row,
                index:fallback
              };
            })()
          };

          s.position=
            gridPosition(
              fallback
            );
        }

        used.add(cell.index);

        const pos=
          gridPosition(
            cell.index
          );

        return `
          <div
            class="
              slot
              ${s.status}
              ${inactive}
              ${s._id===sel?'sel':''}
              ${type}
              editor-slot
              ${known.size&&!known.has(s._id)?'enter':''}
            "
            data-id="${s._id}"

            style="
              position:absolute!important;
              left:${pos.x}px;
              top:${pos.y}px;
              width:${EDITOR_GRID.slotW}px;
              height:${EDITOR_GRID.slotH}px;
              background:${color}!important;
              border-color:${color}!important;
              --vehicle-type-color:
                ${VEHICLE_TYPE_COLORS[s.vehicleType]||'#64748b'}
            "

            title="
              ${TL[s.vehicleType]||s.vehicleType}
              ·
              ${s.status}
            "
          >

            <span
              class="editor-slot-number">
              ${s.slotNumber}
            </span>

            <button
              type="button"
              class="slot-delete"
              data-id="${s._id}"
              aria-label="Delete ${s.slotNumber}"
              title="Delete slot">

              ×

            </button>

          </div>
        `;
      }
    ).join('')
  );
}

/* ===== Layout editor: delete with undo, drag & drop with feedback ===== */
const pendingDel=new Map();
const commitDel=async id=>{
  const p=pendingDel.get(id);if(!p)return;
  pendingDel.delete(id);clearTimeout(p.timer);
  let ok=true;
  try{await api('DELETE','/admin/parking/slots/'+id);}catch(e){ok=false;}
  if(!ok)await load();
};
const flushDeletes=()=>Promise.all([...pendingDel.keys()].map(commitDel));
// If the admin leaves while an undo window is open, finish the delete.
window.addEventListener('pagehide',()=>{
  pendingDel.forEach((p,id)=>{try{fetch('/api/admin/parking/slots/'+id,{method:'DELETE',keepalive:true,credentials:'same-origin'});}catch(e){}});
});

$(document).on('click','.slot-delete',function(ev){
  ev.preventDefault();ev.stopPropagation();
  const id=$(this).data('id'),s=S.find(x=>x._id===id);
  if(!s)return;
  const node=$(`.editor-slot[data-id="${id}"]`);
  if(['RESERVED','OCCUPIED'].includes(s.status)){
    ui.shake(node);
    return ui.toast(`Slot ${s.slotNumber} is ${s.status.toLowerCase()} and cannot be deleted.`,'warn');
  }
  const idx=S.indexOf(s),wasDirty=dirty.has(id);
  S.splice(idx,1);dirty.delete(id);
  if(sel===id){sel=null;panel();}
  node.addClass('removing');
  setTimeout(draw,MS(260));
  pendingDel.set(id,{timer:setTimeout(()=>commitDel(id),6000)});
  ui.toast(`Slot ${s.slotNumber} deleted.`,'ok',{ttl:6000,action:{label:'Undo',fn:()=>{
    if(!pendingDel.has(id))return ui.toast('Too late to undo that delete.','warn');
    clearTimeout(pendingDel.get(id).timer);pendingDel.delete(id);
    S.splice(Math.min(idx,S.length),0,s);if(wasDirty)dirty.add(id);
    draw();ui.toast(`Slot ${s.slotNumber} restored.`);
  }}});
});

$(document).on('pointerdown','.editor-slot',function(ev){
  if(ev.button!==undefined&&ev.button!==0)return;
  if($(ev.target).closest('.slot-delete').length)return;
  ev.preventDefault();
  const el=this,$el=$(el),id=$el.data('id'),s=S.find(x=>x._id===id),cv=$('#cv')[0];
  if(!s||!cv)return;
  const G=EDITOR_GRID,startIdx=gridCellForPosition(s.position)?.index??firstFreeGridIndex();
  const startPos=gridPosition(startIdx),before={pos:{...s.position},dirty:dirty.has(id)};
  let target=startIdx,other=null,otherBefore=null,otherDirty=false,started=false,bad=false,vx=startPos.x,vy=startPos.y;
  const sx=ev.clientX,sy=ev.clientY;

  sel=id;$('.editor-slot.sel').removeClass('sel');$el.addClass('sel');panel();
  const hint=$('<div class="drop-hint"></div>').css({left:startPos.x,top:startPos.y,width:G.slotW,height:G.slotH}).appendTo(cv);

  // Which grid cell is under the pointer? number = cell, undefined = gap between cells, null = outside the grid.
  const cellAt=(cx,cy)=>{
    const r=cv.getBoundingClientRect(),lx=cx-r.left+cv.scrollLeft,ly=cy-r.top+cv.scrollTop,rows=editorRows();
    const w=G.columns*G.stepX-G.gapX,h=rows*G.stepY-G.gapY;
    if(lx<G.startX||ly<G.startY||lx>G.startX+w||ly>G.startY+h)return null;
    const col=Math.floor((lx-G.startX)/G.stepX),row=Math.floor((ly-G.startY)/G.stepY);
    if(col<0||col>=G.columns||row<0||row>=rows)return null;
    if(lx>G.startX+col*G.stepX+G.slotW||ly>G.startY+row*G.stepY+G.slotH)return undefined;
    return gridIndexFromCell(col,row);
  };
  const nodeOf=sl=>$(`.editor-slot[data-id="${sl._id}"]`);
  const css=p=>({left:p.x,top:p.y});
  const undoSwapPreview=()=>{
    if(!other)return;
    other.position=otherBefore;nodeOf(other).css(css(otherBefore));
    if(!otherDirty)dirty.delete(other._id);
    other=null;
  };

  const mv=m=>{
    if(!started){
      if(Math.hypot(m.clientX-sx,m.clientY-sy)<4)return;
      started=true;$el.addClass('dragging');$(cv).addClass('drag-on');
    }
    vx=startPos.x+(m.clientX-sx);vy=startPos.y+(m.clientY-sy);
    $el.css('transform',`translate(${vx-startPos.x}px,${vy-startPos.y}px) scale(1.08)`);
    const r=cellAt(m.clientX,m.clientY);
    if(r===undefined)return;
    if(r===null){
      if(!bad){bad=true;hint.addClass('bad');$(cv).addClass('invalid');}
      return;
    }
    if(bad){bad=false;hint.removeClass('bad');$(cv).removeClass('invalid');}
    if(r===target)return;
    undoSwapPreview();
    target=r;
    const tp=gridPosition(r),o=slotAtGridIndex(r,id);
    hint.css(css(tp));
    if(o){
      // The neighbour slides into the cell we are leaving.
      other=o;otherBefore={...o.position};otherDirty=dirty.has(o._id);
      o.position={...startPos};nodeOf(o).css(css(startPos));
      hint.addClass('swap');
    }else hint.removeClass('swap');
  };

  const up=()=>{
    $(document).off('pointermove',mv).off('pointerup',up).off('pointercancel',up);
    hint.remove();$(cv).removeClass('invalid drag-on');
    if(!started){return;}      // plain click: just selects the slot
    const settle=(pos)=>{
      // Glide from where the pointer let go to the final cell, then let draw() clear the inline styles.
      $el.css({transition:'none',left:pos.x,top:pos.y,transform:`translate(${vx-pos.x}px,${vy-pos.y}px) scale(1.08)`});
      void el.offsetWidth;
      $el.removeClass('dragging');draw();
    };
    if(bad||target===startIdx){
      undoSwapPreview();s.position={...before.pos};
      settle(startPos);
      if(bad){
        setTimeout(()=>ui.shake($(`.editor-slot[data-id="${id}"]`)),MS(250));
        ui.toast('Drop the slot on a cell inside the grid.','warn');
      }
      return;
    }
    const tp=gridPosition(target);
    s.position=tp;dirty.add(id);if(other)dirty.add(other._id);
    const o=other,oBefore=otherBefore,oDirty=otherDirty;
    settle(tp);
    const label=o?`Swapped ${s.slotNumber} and ${o.slotNumber}.`:`Moved ${s.slotNumber}.`;
    ui.toast(label+' Save layout to keep it.','ok',{ttl:6000,action:{label:'Undo',fn:()=>{
      s.position={...before.pos};if(!before.dirty)dirty.delete(id);
      if(o){o.position={...oBefore};if(!oDirty)dirty.delete(o._id);}
      draw();
    }}});
  };
  $(document).on('pointermove',mv).on('pointerup',up).on('pointercancel',up);
});

function panel(){

  const s=
    S.find(
      x=>x._id===sel
    );

  if(!s){
    return $('#ep').text(
      'Select a slot'
    );
  }

  const lock=
    [
      'RESERVED',
      'OCCUPIED'
    ].includes(
      s.status
    );

  $('#ep').html(`

    <label>
      Slot number
    </label>

    <input
      id="sn"
      class="form-control mb-2"
      value="${s.slotNumber}">

    <label>
      Vehicle type
    </label>

    <select
      id="sty"
      class="form-select mb-2">

      ${
        TYPES.map(
          t=>`
            <option
              ${t===s.vehicleType?'selected':''}>
              ${t}
            </option>
          `
        ).join('')
      }

    </select>

    <label>
      Status
    </label>

    <select
      id="sst"
      class="form-select mb-2"
      ${lock?'disabled':''}>

      ${
        lock
          ? `<option>
               ${s.status}
             </option>`

          : [
              'AVAILABLE',
              'MAINTENANCE'
            ]
            .map(
              t=>`
                <option
                  ${t===s.status?'selected':''}>
                  ${t}
                </option>
              `
            )
            .join('')
      }

    </select>

    <div
      class="form-check mb-2">

      <input
        type="checkbox"
        id="sac"
        class="form-check-input"
        ${s.active?'checked':''}>

      <label
        class="form-check-label">
        Active
      </label>

    </div>

    <button type="button"
      id="ap"
      class="btn btn-primary mb-2">
      Apply
    </button>

    <button type="button"
      id="dl"
      class="btn btn-outline-danger mb-2">
      Delete slot
    </button>

    <div id="qi"></div>

  `);

  $('#ap').click(
    async()=>{

      const b={
        slotNumber:
          $('#sn').val(),

        vehicleType:
          $('#sty').val(),

        active:
          $('#sac').prop(
            'checked'
          )
      };

      if(!lock){
        b.status=
          $('#sst').val();
      }

      Object.assign(
        s,
        await api(
          'PUT',
          '/admin/parking/slots/'+
          s._id,
          b
        )
      );

      draw();

      panel();
    }
  );

  $('#dl').click(
    async()=>{

      if(
        await ui.confirm(
          `Delete slot ${s.slotNumber}?`
        )
      ){

        await api(
          'DELETE',
          '/admin/parking/slots/'+
          s._id
        );

        await load();
      }
    }
  );

  api(
    'GET',
    '/qr/'+s._id
  ).then(
    q=>
      $('#qi').html(`
        <img
          src="${q.dataUrl}"
          width="140">

        <br>

        <a
          class="btn btn-sm btn-outline-dark mt-2"
          download="slot-${q.slot}.png"
          href="${q.dataUrl}">
          Download QR
        </a>
      `)
  );
}

// -----------------------------------------------------------------------------
// Shared user/admin pages restored from the project
// -----------------------------------------------------------------------------

async function p(){$('#pane').html(skel.table(4));const P=await api('GET','/passes');$('#pane').html(`<table class="table bg-white"><tr><th>Vehicle<th>Type<th>Issued<th>Expires<th>Status<th></tr>${P.map(x=>`<tr><td><span class="plate ${vehicleTypeClass(x.vehicleId?.vehicleType)}" style="${vehicleTypeStyle(x.vehicleId?.vehicleType)}">${x.vehicleId?.vehicleNumber||'-'}</span><td>${x.passType}<td>${fmt(x.issuedAt)}<td>${fmt(x.expiresAt)}<td><span class="tag ${x.status}">${x.status}</span><td>${x.status==='ACTIVE'?`<button type="button" class="btn btn-sm btn-outline-danger rp" data-id="${x._id}">Revoke</button>`:''}</tr>`).join('')}</table>`);
 $('.rp').click(async function(){if(await ui.confirm('Revoke pass?')){await api('POST',`/admin/passes/${$(this).data('id')}/revoke`);p();}});}
async function v(){$('#pane').html(skel.table(5));const V=await api('GET','/admin/vehicles');$('#pane').html(`<table class="table bg-white"><tr><th>Vehicle<th>Type<th>Owner<th>Status<th>Decided by<th>When<th>Note<th></tr>${V.map(x=>`<tr class="${x.active?'':'text-muted'}"><td><span class="plate ${vehicleTypeClass(x.vehicleType)}" style="${vehicleTypeStyle(x.vehicleType)}">${x.vehicleNumber}</span>${x.active?'':' (deregistered)'}<td><span class="vehicle-type-label ${vehicleTypeClass(x.vehicleType)}" style="${vehicleTypeStyle(x.vehicleType)}">${TL[x.vehicleType]||x.vehicleType}</span><td>${x.userId?.name||'-'} (${x.userId?.userType||''})<td><span class="tag ${x.approvalStatus}">${x.approvalStatus}</span><td>${x.approvedBy?.name||'-'}<td>${x.approvedAt?fmt(x.approvedAt):'-'}<td>${x.rejectionReason||''}<td>${x.active&&x.approvalStatus==='APPROVED'?`<button type="button" class="btn btn-sm btn-outline-danger rv" data-id="${x._id}">Revoke approval</button>`:''}</tr>`).join('')}</table>`);
 $('.rv').click(async function(){const reason=await ui.prompt('Reason?');if(reason===null)return;await api('POST',`/admin/vehicles/${$(this).data('id')}/revoke`,{reason});v();});}
async function h(){$('#pane').html(skel.table(6));const H=await api('GET','/admin/sessions');$('#pane').html(`<table class="table bg-white"><tr><th>User<th>Vehicle<th>Building<th>Lot<th>Slot<th>Start<th>End<th>Min<th>Status</tr>${H.map(s=>`<tr><td>${s.userId?.name||'-'}<td><span class="plate ${vehicleTypeClass(s.vehicleId?.vehicleType)}" style="${vehicleTypeStyle(s.vehicleId?.vehicleType)}">${s.vehicleId?.vehicleNumber||'-'}</span><td>${s.parkingLotId?.buildingId?.name||'-'}<td>${s.parkingLotId?.name||'-'}<td>${s.slotId?.slotNumber||'-'}<td>${fmt(s.startTime)}<td>${s.endTime?fmt(s.endTime):'-'}<td>${s.durationMinutes||'-'}<td><span class="tag ${s.status}">${s.status}</span></tr>`).join('')}</table>`);}

function home(){if(ME)return location=ME.userType==='ADMIN'?'/admin/dashboard':'/user/dashboard';
 $('#title').hide();$('#pane').html(`<div class="row g-5 pt-4 fx-in"><div class="col-lg-7"><h1 class="hero">Reserve the exact bay.<br>Walk in.<br>Park.</h1><p class="lede">Choose the building you are heading to, see which lots have space and how far each one is from its door, then hold one specific bay while you drive over. Scan the code at the bay to start your session; press Leave when you go and the bay is free for the next person.</p><button type="button" class="btn btn-primary me-2" data-go="/register">Register</button><button type="button" class="btn btn-outline-dark" data-go="/login">Log in</button></div>
 <div class="col-lg-5"><ol class="flow">${['Register your vehicle','Wait for the office to approve it','Pick a lot, then a bay','Reserve it: the bay is held for you','Scan the code at the bay when you arrive','Press Leave when you go'].map(t=>`<li>${t}</li>`).join('')}</ol></div></div>`);
 $('#pane .col-lg-7').append(`<div class="road" aria-hidden="true"><span class="road-p">P</span><span class="road-car">${CAR}</span></div>`);
 $('.road-car').one('animationend',function(){$(this).addClass('arrived');});}

function login(){if(ME)return after();
 $('#pane').html(`<div class="col-md-5 mx-auto fx-in">
  <div class="fld mb-2"><input id="le" type="email" class="form-control" placeholder="Email" autocomplete="username" aria-label="Email"></div>
  <div class="fld mb-3"><input id="lp" type="password" class="form-control" placeholder="Password" autocomplete="current-password" aria-label="Password"></div>
  <div class="d-flex gap-2 flex-wrap"><button type="button" id="li" class="btn btn-primary">Login</button><button type="button" class="btn btn-outline-dark" data-go="/register">Create account</button></div></div>`);
 const runE=check('#le',v=>/^\S+@\S+\.\S+$/.test(v.trim())?null:'Enter a valid email address');
 const submit=()=>busy('#li',async()=>{
  const bad=[];if(runE(true))bad.push('#le');if(!$('#lp').val())bad.push('#lp');
  if(bad.length){ui.shake(bad.join(','));ui.toast('Enter your email and password.','warn');return;}
  await api('POST','/auth/login',{email:$('#le').val().trim(),password:$('#lp').val()});
  await after();});
 $('#li').on('click',submit);$('#le,#lp').on('keydown',e=>{if(e.key==='Enter')submit();});}

function register(){if(ME)return after();
 $('#pane').html(`<div class="col-md-5 mx-auto fx-in">
  <div class="fld mb-2"><input id="rn" class="form-control" placeholder="Name" autocomplete="name" aria-label="Name"></div>
  <div class="fld mb-2"><input id="re" type="email" class="form-control" placeholder="Email" autocomplete="email" aria-label="Email"></div>
  <div class="mb-2"><input id="rph" class="form-control" placeholder="Phone" autocomplete="tel" aria-label="Phone"></div>
  <div class="mb-2"><input id="rc" class="form-control" placeholder="College ID" aria-label="College ID"></div>
  <div class="fld mb-2"><input id="rp" type="password" class="form-control" placeholder="Password (6+)" autocomplete="new-password" aria-label="Password"></div>
  <select id="rt" class="form-select mb-3" aria-label="I am a"><option>STUDENT</option><option>FACULTY</option><option>GUEST</option></select>
  <div class="d-flex gap-2 flex-wrap"><button type="button" id="rg" class="btn btn-success">Register</button><button type="button" class="btn btn-outline-dark" data-go="/login">Have an account?</button></div></div>`);
 const runs=[['#rn',v=>v.trim().length>=2?null:'Enter your full name'],['#re',v=>/^\S+@\S+\.\S+$/.test(v.trim())?null:'Enter a valid email address'],
  ['#rp',v=>v.length>=6?null:'Use at least 6 characters']].map(([s,f])=>[s,check(s,f)]);
 const submit=()=>busy('#rg',async()=>{
  const bad=runs.filter(([s,r])=>r(true)).map(([s])=>s);
  if(bad.length){ui.shake(bad.join(','));$(bad[0]).trigger('focus');return;}
  await api('POST','/auth/register',{name:$('#rn').val().trim(),email:$('#re').val().trim(),phone:$('#rph').val(),collegeId:$('#rc').val(),password:$('#rp').val(),userType:$('#rt').val()});
  await after();});
 $('#rg').on('click',submit);$('#pane input').on('keydown',e=>{if(e.key==='Enter')submit();});}

const TL={TWO_WHEELER:'Two-wheeler',FOUR_WHEELER:'Four-wheeler',CYCLE:'Cycle'};
async function dash(){$('#title').hide();
 const D=new Date(),h=D.getHours(),g=h<12?'Good morning':h<17?'Good afternoon':'Good evening',
  date=D.toLocaleDateString('en-GB',{weekday:'long'})+' · '+D.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}),
  AL={APPROVED:'Approved',PENDING:'Awaiting approval',REJECTED:'Rejected',REVOKED:'Approval revoked'},
  fm=d=>new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const QA=[['/user/parking','Find parking','See open bays now'],['/user/vehicles','Register vehicle','Add a campus vehicle'],['/user/vehicles','Get parking pass','Issue or check a pass'],['/user/reservations','My reservations','Manage held bays']];
 // Shell first: each section fills in on its own as its data arrives.
 $('#pane').html(`<div class="dh fx-in"><div><div class="date">${date}</div><h1>${g}, ${ME.name.split(' ')[0]}</h1><p>Your parking status, at a glance.</p></div>${driveBtn('/user/parking','Find parking')}</div>
 <div class="row g-5"><div class="col-lg-7"><h5 class="mt-0">Your vehicles</h5>
 <div id="vl">${skel.rows(2,64)}</div>
 <h5>Quick actions</h5><div class="qa">${QA.map(a=>`<a href="${a[0]}"><span><b>${a[1]}</b><small>${a[2]}</small></span><i>→</i></a>`).join('')}</div></div>
 <div class="col-lg-5"><h5 class="mt-0">Campus occupancy <span class="live">Live</span></h5><div id="occ">${skel.occ()}</div></div></div>`);
 clearInterval(poll);
 const occP=occ().then(()=>{poll=setInterval(occ,10000);});
 const loadVehicles=async()=>{
  const[vs,ac,rs]=await Promise.all([api('GET','/vehicles'),api('GET','/parking/sessions/active'),api('GET','/reservations')]);
  const rows=vs.map(v=>{const ok=v.approvalStatus==='APPROVED',pass=v.pass&&new Date(v.pass.expiresAt)>new Date(),
    s=ac.find(x=>x.vehicleId._id===v._id),r=rs.find(x=>x.vehicleId._id===v._id);
   return `<div class="vrow ${vehicleTypeClass(v.vehicleType)}" style="${vehicleTypeStyle(v.vehicleType)}"><div><span class="plate ${vehicleTypeClass(v.vehicleType)}" style="${vehicleTypeStyle(v.vehicleType)}">${v.vehicleNumber}</span><small>${[v.model,`<span class="vehicle-type-label ${vehicleTypeClass(v.vehicleType)}" style="${vehicleTypeStyle(v.vehicleType)}">${TL[v.vehicleType]||v.vehicleType}</span>`].filter(Boolean).join(' · ')}</small></div>
   <div><span class="tag ${v.approvalStatus}">${AL[v.approvalStatus]||v.approvalStatus}</span></div>
   <div>${!ok?'<span class="text-muted">—</span>':pass?`<span class="tag ACTIVE">Pass active</span><small>until ${fm(v.pass.expiresAt)}</small>`:`<button type="button" class="btn btn-sm btn-outline-dark gp" data-id="${v._id}">Get pass</button>`}</div>
   <div>${s?`<b>${s.slotId.slotNumber}</b> · ${s.parkingLotId.name} <button type="button" class="btn btn-sm btn-outline-dark ms-1" data-go="/user/active-parking">View</button>`:r?`Held <b>${r.slotId.slotNumber}</b> <button type="button" class="btn btn-sm btn-outline-dark ms-1" data-go="/user/reservations">View</button>`:'<span class="text-muted">Not parked</span>'}</div></div>`;}).join('');
  $('#vl').html(`<div class="fx-in">${vs.length?`<div class="vhead"><span>Vehicle</span><span>Registration</span><span>Parking pass</span><span>Parking</span></div>${rows}`:'<p class="empty">No vehicles yet.</p><button type="button" class="btn btn-sm btn-outline-dark" data-go="/user/vehicles">Register your first one</button>'}</div>`);
 };
 $('#vl').on('click','.gp',function(){busy(this,async()=>{await api('POST','/passes',{vehicleId:$(this).data('id')});ui.toast('Parking pass issued.');await loadVehicles();});});
 await Promise.all([loadVehicles(),occP]);}
async function occ(){if(!$('#occ').length)return clearInterval(poll);
 const av=await api('GET','/parking/availability'),sl=await Promise.all(av.map(l=>api('GET',`/parking/lots/${l._id}/slots`)));
 const tot={AVAILABLE:0,RESERVED:0,OCCUPIED:0,MAINTENANCE:0};av.forEach(l=>Object.keys(tot).forEach(k=>tot[k]+=l.counts[k]||0));
 const T=Object.values(tot).reduce((a,b)=>a+b,0),lv=(f,t)=>!t?'':f/t<=.15?'low':f/t<=.4?'mid':'ok',   // red: full/almost full, amber: filling up, green: plenty
  LB={low:f=>f===0?'Full':'Almost full',mid:()=>'Filling up',ok:()=>'Plenty free'},L0=lv(tot.AVAILABLE,T),pc=k=>T?(tot[k]/T*100).toFixed(1):0;
 const html=`<div class="occ-big"><b class="lvl-${L0}">${tot.AVAILABLE}</b><span> / ${T}</span></div><div>bays free right now${L0?` · <b class="lvl-${L0}">${LB[L0](tot.AVAILABLE)}</b>`:''}</div>
 <div class="occbar" title="free · held · occupied · out of service">${['AVAILABLE','RESERVED','OCCUPIED','MAINTENANCE'].map(k=>`<i class="${k}" data-key="o${k}" style="width:${pc(k)}%"></i>`).join('')}</div>
 <small>${T?Math.round((tot.OCCUPIED+tot.RESERVED)/T*100):0}% in use</small>
 ${av.map((l,i)=>{const bays=sl[i].filter(s=>s.active),lc=lv(l.counts.AVAILABLE,l.total),ty=[...new Set(bays.map(s=>s.vehicleType))].map(t=>`<span class="vehicle-type-label ${vehicleTypeClass(t)}" style="${vehicleTypeStyle(t)}">${TL[t]||t}</span>`).join(', ');
  return `<div class="lotrow" data-key="lot-${l._id}"><div class="d-flex justify-content-between"><span><b>${l.name}</b><small>${l.buildingId?.name||''}${ty?' · '+ty:''}</small></span><span class="text-end lvl-${lc}"><b>${l.counts.AVAILABLE} free</b><small>${lc?LB[lc](l.counts.AVAILABLE):'No bays'}</small></span></div>
  <div class="bays">${bays.sort((a,b)=>a.slotNumber.localeCompare(b.slotNumber,undefined,{numeric:true})).map(s=>{
   const statusColor={OCCUPIED:'#e74c3c',MAINTENANCE:'#111827',RESERVED:'#b58a3b'}[s.status];
   const availableColor=VEHICLE_TYPE_COLORS[s.vehicleType]||'#64748b';
   const bayColor=statusColor||availableColor;
   return `<span class="bay ${s.status} ${vehicleTypeClass(s.vehicleType)}" data-id="${s._id}" data-vehicle-type="${s.vehicleType||''}" data-status="${s.status}" style="background:${bayColor}!important;border-color:${bayColor}!important;--vehicle-type-color:${availableColor}" title="${s.slotNumber} · ${TL[s.vehicleType]||s.vehicleType} · ${s.status.toLowerCase()}"></span>`;
 }).join('')}</div></div>`;}).join('')||'<p class="empty">No parking lots have been set up yet.</p>'}
 <div class="key"><span class="bay AVAILABLE" style="background:#2563eb!important;border-color:#2563eb!important"></span>4-wheeler <span class="bay AVAILABLE" style="background:#f59e0b!important;border-color:#f59e0b!important"></span>2-wheeler <span class="bay AVAILABLE" style="background:#16a34a!important;border-color:#16a34a!important"></span>cycle <span class="bay RESERVED"></span>held <span class="bay OCCUPIED"></span>occupied <span class="bay MAINTENANCE"></span>closed</div>`;
 // First paint replaces the skeleton; later refreshes patch in place so bays change colour smoothly.
 if($('#occ .sk').length)$('#occ').html(`<div class="fx-in">${html}</div>`).data('live',1);
 else morph($('#occ>div').first(),html);}
function profile(){$('#pane').html(`<div class="card card-body col-md-6"><div>Name: <b>${ME.name}</b></div><div>Email: ${ME.email}</div><div>Role: ${ME.userType}</div><div>Eligible parking: ${ME.eligible.join(', ')}</div></div>`);}
async function settingsPg(){$('#pane').html(skel.cards(2));const se=await api('GET','/admin/settings');
 $('#pane').html(`<div class="card card-body col-md-6">${[['maxVehiclesPerUser','Maximum vehicles per user'],['guestPassValidityHours','Guest pass validity (hours)'],['parkingPassValidityHours','Parking pass validity (hours)'],['reservationWindowMinutes','Reservation window (minutes)']].map(k=>`<label>${k[1]}</label><input class="form-control mb-2 st" data-k="${k[0]}" type="number" min="1" value="${se[k[0]]}">`).join('')}<button type="button" id="ss" class="btn btn-primary">Save settings</button></div>`);
 $('#ss').click(async()=>{const d={};$('.st').each(function(){d[$(this).data('k')]=$(this).val();});await api('PUT','/admin/settings',d);ui.toast('Settings saved');});}
async function statsPg(){$('#pane').html(skel.cards(3));const st=await api('GET','/admin/statistics');
 $('#pane').html(`<div class="row mb-3">${[['Users',st.users],['Vehicles',st.vehicles],['Pending',st.pendingVehicles],['Slots',st.totalSlots],['Available',st.slots.AVAILABLE||0],['Reserved',st.slots.RESERVED||0],['Occupied',st.slots.OCCUPIED||0],['Maintenance',st.slots.MAINTENANCE||0],['Active sessions',st.activeSessions],['Today',st.todaySessions],['Avg min',st.avgDurationMinutes],['Top lot',st.mostUsedLot||'-']].map(x=>`<div class="col-6 col-md-2"><div class="card card-body mb-2 text-center"><small>${x[0]}</small><b>${x[1]}</b></div></div>`).join('')}</div>
 <h6>Peak parking hours</h6>${st.peakHours.map(p=>`<div class="d-flex align-items-center mb-1"><span style="width:60px">${p.hour}:00</span><div class="bg-primary" style="height:16px;width:${Math.round(p.sessions/st.peakHours[0].sessions*300)}px"></div><span class="ms-2">${p.sessions}</span></div>`).join('')||'-'}`);}
async function avh(){await v();const P=await api('GET','/admin/vehicles/pending');
 $('#pane').prepend(`<h5>Pending approval</h5><table class="table bg-white mb-4">${P.map(x=>`<tr><td><span class="plate ${vehicleTypeClass(x.vehicleType)}" style="${vehicleTypeStyle(x.vehicleType)}">${x.vehicleNumber}</span><td><span class="vehicle-type-label ${vehicleTypeClass(x.vehicleType)}" style="${vehicleTypeStyle(x.vehicleType)}">${TL[x.vehicleType]||x.vehicleType}</span><td>${x.userId?.name}<td><button type="button" class="btn btn-sm btn-success ap2" data-id="${x._id}">Approve</button> <button type="button" class="btn btn-sm btn-danger rj2" data-id="${x._id}">Reject</button></tr>`).join('')||'<tr><td>None</tr>'}</table><h5>All vehicles</h5>`);
 $('.ap2').click(async function(){await api('POST',`/admin/vehicles/${$(this).data('id')}/approve`);avh();});
 $('.rj2').click(async function(){await api('POST',`/admin/vehicles/${$(this).data('id')}/reject`,{reason:await ui.prompt('Reason?')||''});avh();});}
async function qrv(){const t=Q('token')||'';
 $('#pane').html(`<div class="col-md-6 mx-auto card card-body"><p>Confirm you are at your reserved slot. Scanning never creates a reservation.</p><input id="qt" class="form-control mb-2" value="${t}" placeholder="QR token"><button type="button" id="qb" class="btn btn-success">Verify</button><div id="qm" class="mt-3"></div></div>`);
 const go=async()=>{try{await $.ajax({url:'/api/qr/verify',method:'POST',contentType:'application/json',data:JSON.stringify({token:$('#qt').val().trim()})});
  $('#qm').html('<div class="alert alert-success">Verified! Parking session started.</div><button type="button" class="btn btn-sm btn-outline-dark mt-2" data-go="/user/active-parking">View active parking</button>');}
  catch(x){$('#qm').html(`<div class="alert alert-danger">${x.responseJSON?.error||'Verification failed'}</div>`);}};
 $('#qb').click(go);if(t)go();}

const PAGES={
  home,
  login,
  register,
  dash,
  veh,
  find,
  res:()=>{
    MODE='res';
    return act();
  },
  act:()=>{
    MODE='act';
    return act();
  },
  hist,
  profile,
  adm,
  avh,
  b,
  l,
  e,
  p,
  h,
  settingsPg,
  statsPg,
  qrv
};

// -----------------------------------------------------------------------------
// Application bootstrap / routing
// -----------------------------------------------------------------------------

const Q=k=>new URLSearchParams(location.search).get(k);

function nav(){
  const P=location.pathname;
  const isA=P.startsWith('/admin');

  const U=[
    ['/user/dashboard','Dashboard'],
    ['/user/vehicles','Vehicles'],
    ['/user/parking','Find parking'],
    ['/user/reservations','Reservations'],
    ['/user/active-parking','Active'],
    ['/user/history','History'],
    ['/user/profile','Profile']
  ];

  const A=[
    ['/admin/dashboard','Admin'],
    ['/admin/vehicles','Vehicles'],
    ['/admin/passes','Passes'],
    ['/admin/buildings','Buildings'],
    ['/admin/parking-lots','Lots'],
    ['/admin/parking-layout','Layout'],
    ['/admin/statistics','Stats'],
    ['/admin/settings','Settings']
  ];

  const L=ME
    ? (isA?A:U)
    : [['/login','Login'],['/register','Register']];

  $('#nav').html(`
    <header class="topbar">
      <a class="brand" href="/">
        <span class="pmark">P</span>
        <span>Campus Parking</span>
      </a>
      <nav>
        ${L.map(l=>`
          <a class="${P===l[0]?'on':''}" href="${l[0]}">${l[1]}</a>
        `).join('')}
      </nav>
      <div class="who">
        ${ME?`
          <span>
            ${ME.name}
            <small>${ME.userType.toLowerCase()}</small>
          </span>
          ${ME.userType==='ADMIN'?`
            <button type="button" class="btn btn-sm btn-outline-light" data-go="${isA?'/user/dashboard':'/admin/dashboard'}">
              ${isA?'User view':'Admin view'}
            </button>
          `:''}
          <button type="button" class="btn btn-sm btn-outline-light" id="out">Log out</button>
        `:''}
      </div>
    </header>
  `);

  $('#out').click(function(){
    busy(this,async()=>{
      await api('POST','/auth/logout');
      location='/login';
    });
  });
}

async function Page(name,title,role){
  try{
    ME=await api('GET','/auth/me');
  }catch(e){
    ME=null;
  }

  if(!ME&&role!=='public'){
    return location=
      '/login?next='+
      encodeURIComponent(location.pathname+location.search);
  }

  if(ME&&role==='admin'&&ME.userType!=='ADMIN'){
    return location='/user/dashboard';
  }

  nav();
  $('#title').text(title);

  const flash=sessionStorage.getItem('flash');
  if(flash){
    sessionStorage.removeItem('flash');
    ui.toast(flash);
  }

  const page=PAGES[name];
  if(typeof page!=='function'){
    console.error('Unknown page:',name);
    $('#pane').html('<p class="empty">Unable to load this page.</p>');
    return;
  }

  try{
    await page();
  }catch(e){
    // The failed request has already been reported by api(). Replace any leftover
    // skeleton with a clear state and a way to try again.
    if(!(e&&e.status!==undefined))console.error(e);
    if($('#pane .sk, #pane .sk-card').length||!$('#pane').children().length){
      $('#pane').html('<div class="fx-in"><p class="empty">This page could not be loaded.</p>'+
        '<button type="button" class="btn btn-outline-dark" id="retry">Try again</button></div>');
      $('#retry').on('click',()=>location.reload());
    }
  }
}

async function after(){
  const u=await api('GET','/auth/me');
  location=
    Q('next')||
    (u.userType==='ADMIN'?'/admin/dashboard':'/user/dashboard');
}


/* ===== Scroll reveal =====
   Blocks that start below the fold fade up once as they scroll into view. Anything already visible is left
   alone (no double animation), nothing is hidden without a way back, and reduced motion skips it entirely. */
(()=>{
  if(REDUCED||!('IntersectionObserver' in window))return;
  const SEL='#pane h5,#pane table,#pane .qa,#pane .vc,#pane .vrow,#pane .lotrow,#pane .lotc,#pane .parking-lot-card,#pane .card.mb-3,#pane .row.mb-3 .card';
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
  }),{rootMargin:'0px 0px -6% 0px',threshold:.04});
  let t;
  const scan=()=>{
    let n=0;const vh=innerHeight;
    document.querySelectorAll(SEL).forEach(el=>{
      if(el.__rv)return;el.__rv=1;
      if(el.getBoundingClientRect().top<vh*.94)return;     // already on screen
      el.style.setProperty('--rd',Math.min(n++,4)*60+'ms');  // gentle stagger, capped
      el.classList.add('rv');io.observe(el);
    });
  };
  const start=()=>new MutationObserver(()=>{clearTimeout(t);t=setTimeout(scan,80);}).observe(document.body,{childList:true,subtree:true});
  document.body?start():addEventListener('DOMContentLoaded',start);
})();


/* ===== Parking-themed motion: bay drive-in, leaving, hero road, count-ups ===== */
// The car leaves the session card to the right, then the caller collapses the card.
const driveAway=cx=>new Promise(res=>{
  const card=$(cx).find('.card').first();
  if(REDUCED||!card.length)return res();
  card.addClass('leaving')[0].style.setProperty('--run',card.outerWidth()+'px');
  $(`<span class="leave-car lit" aria-hidden="true">${CAR}</span>`).appendTo(card);
  setTimeout(res,MS(1000));
});

// Numbers count up once when they first appear (dashboard occupancy, admin statistics).
(()=>{
  if(REDUCED)return;
  const ease=t=>1-Math.pow(1-t,3);
  const run=el=>{
    const n=parseInt(el.textContent,10);if(!(n>0)||String(n)!==el.textContent.trim())return;
    const t0=performance.now(),D=Math.min(1100,500+n*8);
    const step=now=>{const p=Math.min(1,(now-t0)/D);el.textContent=Math.round(n*ease(p));if(p<1)requestAnimationFrame(step);else el.textContent=n;};
    el.textContent='0';requestAnimationFrame(step);
  };
  let t;
  const scan=()=>document.querySelectorAll('.occ-big b,#pane .card.text-center b').forEach(el=>{if(el.__cu)return;el.__cu=1;run(el);});
  const start=()=>new MutationObserver(()=>{clearTimeout(t);t=setTimeout(scan,40);}).observe(document.body,{childList:true,subtree:true});
  document.body?start():addEventListener('DOMContentLoaded',start);
})();
