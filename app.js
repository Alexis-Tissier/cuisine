(() => {
  'use strict';

  const USER_KEY = id => `cuisine_user_v1_${id}`;
  const $ = sel => document.querySelector(sel);
  const app = $('#app');
  const toastEl = $('#toast');
  const fileInput = $('#recipe-file-input');

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const round = (n, d = 0) => Number(Number(n).toFixed(d));
  const fmt = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: Number(n) < 10 ? 1 : 0 }).format(Number(n));
  const fmtMeasure = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n));
  const formatDate = iso => iso ? new Intl.DateTimeFormat('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(`${iso}T12:00:00`)) : '';
  const todayISO = () => new Date().toISOString().slice(0,10);
  const daysUntil = iso => {
    if (!iso) return Infinity;
    const a = new Date(`${todayISO()}T12:00:00`);
    const b = new Date(`${iso}T12:00:00`);
    return Math.ceil((b-a)/86400000);
  };

  const AISLE_ORDER = ['fruits-legumes','viandes','poissons','frais','epicerie','surgeles','boulangerie','autre'];
  const AISLE_LABEL = {
    'fruits-legumes':'Fruits & légumes', viandes:'Viandes', poissons:'Poissons', frais:'Produits frais',
    epicerie:'Épicerie', surgeles:'Surgelés', boulangerie:'Boulangerie', autre:'Autres'
  };

  const ALLOWED_UNITS = ['g','ml','unit','tbsp','tsp','pinch'];
  const UNIT_META = {
    g:     { base:'g',    factor:1 },
    ml:    { base:'ml',   factor:1 },
    unit:  { base:'unit', factor:1 },
    tbsp:  { base:'ml',   factor:15 },
    tsp:   { base:'ml',   factor:5 },
    pinch: { base:'g',    factor:0.3 }
  };
  const baseUnit = unit => UNIT_META[unit]?.base || unit;
  const unitFactor = unit => UNIT_META[unit]?.factor || 1;
  const toBaseQty = (qty, unit) => Number(qty) * unitFactor(unit);
  const fromBaseQty = (qty, unit) => Number(qty) / unitFactor(unit);
  const unitsCompatible = (a, b) => baseUnit(a) === baseUnit(b);
  const inputStep = unit => ['unit','tbsp','tsp'].includes(unit) ? 0.25 : unit === 'pinch' ? 0.5 : 1;
  const unitShortLabel = unit => ({unit:'u',tbsp:'c. à soupe',tsp:'c. à café',pinch:'pincée'}[unit] || unit);
  function estimatedPriceInBase(ingredient){
    const price = Number(ingredient.estimatedPrice) || 0;
    if (!price) return 0;
    if (ingredient.unit === 'g' || ingredient.unit === 'ml' || ingredient.unit === 'unit') return price;
    const factor = unitFactor(ingredient.unit);
    if (baseUnit(ingredient.unit) === 'g' || baseUnit(ingredient.unit) === 'ml') return factor > 0 ? price / factor * 1000 : 0;
    return price;
  }

  const DEMO_RECIPES = [
    {
      version:1, id:'risotto-poulet-champignons', name:'Risotto poulet & champignons', image:null,
      ingredients:[
        {id:'rice-arborio', name:'Riz arborio', quantity:80, unit:'g', aisle:'epicerie', packageQty:500, estimatedPrice:4.6},
        {id:'chicken-breast', name:'Blanc de poulet', quantity:150, unit:'g', aisle:'viandes', packageQty:300, estimatedPrice:12.9},
        {id:'mushroom', name:'Champignons', quantity:100, unit:'g', aisle:'fruits-legumes', packageQty:250, estimatedPrice:6.8},
        {id:'onion-yellow', name:'Oignon jaune', quantity:45, unit:'g', aisle:'fruits-legumes', packageQty:500, estimatedPrice:2.4},
        {id:'parmesan', name:'Parmesan', quantity:25, unit:'g', aisle:'frais', packageQty:150, estimatedPrice:24},
        {id:'chicken-stock', name:'Bouillon de volaille', quantity:260, unit:'ml', aisle:'epicerie', packageQty:1000, estimatedPrice:1.6},
        {id:'olive-oil', name:"Huile d'olive", quantity:10, unit:'ml', aisle:'epicerie', packageQty:750, estimatedPrice:10.5}
      ],
      steps:[
        {text:"Émincer {{onion-yellow}} d'oignon et {{mushroom}} de champignons. Couper {{chicken-breast}} de poulet en morceaux.", timers:[]},
        {text:"Faire revenir l'oignon avec {{olive-oil}} d'huile, puis ajouter le riz et le nacrer 2 minutes.", timers:[2]},
        {text:"Ajouter progressivement {{chicken-stock}} de bouillon chaud au riz en mélangeant régulièrement.", timers:[16]},
        {text:"Pendant la cuisson du riz, faire dorer le poulet et les champignons dans une autre poêle.", timers:[8]},
        {text:"Réunir le tout, incorporer {{parmesan}} de parmesan puis servir immédiatement.", timers:[]}
      ]
    },
    {
      version:1, id:'riz-cantonais', name:'Riz cantonais au poulet', image:null,
      ingredients:[
        {id:'rice-basmati', name:'Riz basmati', quantity:85, unit:'g', aisle:'epicerie', packageQty:1000, estimatedPrice:2.7},
        {id:'chicken-breast', name:'Blanc de poulet', quantity:110, unit:'g', aisle:'viandes', packageQty:300, estimatedPrice:12.9},
        {id:'egg', name:'Œuf', quantity:1, unit:'unit', aisle:'frais', packageQty:6, estimatedPrice:0.38},
        {id:'peas', name:'Petits pois', quantity:60, unit:'g', aisle:'surgeles', packageQty:600, estimatedPrice:3.5},
        {id:'carrot', name:'Carotte', quantity:45, unit:'g', aisle:'fruits-legumes', packageQty:500, estimatedPrice:2.2},
        {id:'soy-sauce', name:'Sauce soja', quantity:12, unit:'ml', aisle:'epicerie', packageQty:150, estimatedPrice:9},
        {id:'olive-oil', name:"Huile d'olive", quantity:8, unit:'ml', aisle:'epicerie', packageQty:750, estimatedPrice:10.5}
      ],
      steps:[
        {text:"Cuire {{rice-basmati}} de riz dans l'eau puis l'égoutter. Il doit rester légèrement ferme.", timers:[10]},
        {text:"Couper {{chicken-breast}} de poulet et {{carrot}} de carotte en petits dés.", timers:[]},
        {text:"Faire dorer le poulet et la carotte avec {{olive-oil}} d'huile.", timers:[6]},
        {text:"Pousser la garniture sur le côté, casser {{egg}} œuf et le brouiller rapidement dans la poêle.", timers:[2]},
        {text:"Ajouter le riz, {{peas}} de petits pois et {{soy-sauce}} de sauce soja. Mélanger à feu vif.", timers:[4]}
      ]
    },
    {
      version:1, id:'poulet-champignons', name:'Poulet crémeux aux champignons', image:null,
      ingredients:[
        {id:'chicken-breast', name:'Blanc de poulet', quantity:170, unit:'g', aisle:'viandes', packageQty:300, estimatedPrice:12.9},
        {id:'mushroom', name:'Champignons', quantity:130, unit:'g', aisle:'fruits-legumes', packageQty:250, estimatedPrice:6.8},
        {id:'cream', name:'Crème', quantity:80, unit:'ml', aisle:'frais', packageQty:200, estimatedPrice:5.8},
        {id:'onion-yellow', name:'Oignon jaune', quantity:40, unit:'g', aisle:'fruits-legumes', packageQty:500, estimatedPrice:2.4},
        {id:'potato', name:'Pommes de terre', quantity:260, unit:'g', aisle:'fruits-legumes', packageQty:1000, estimatedPrice:2.5},
        {id:'olive-oil', name:"Huile d'olive", quantity:8, unit:'ml', aisle:'epicerie', packageQty:750, estimatedPrice:10.5}
      ],
      steps:[
        {text:"Couper {{potato}} de pommes de terre et les cuire dans l'eau salée.", timers:[18]},
        {text:"Pendant ce temps, émincer {{onion-yellow}} d'oignon et {{mushroom}} de champignons. Couper {{chicken-breast}} de poulet.", timers:[]},
        {text:"Faire dorer le poulet avec {{olive-oil}} d'huile puis réserver.", timers:[6]},
        {text:"Faire revenir l'oignon et les champignons dans la même poêle.", timers:[6]},
        {text:"Remettre le poulet, ajouter {{cream}} de crème et laisser épaissir doucement.", timers:[4]}
      ]
    }
  ];

  const defaultUserData = name => ({
    recipes: JSON.parse(JSON.stringify(DEMO_RECIPES)),
    cart: [],
    purchaseOverrides: {},
    pantry: {
      permanent: ['olive-oil'],
      lots: [
        {id:uid('lot'), ingredientId:'rice-basmati', name:'Riz basmati', quantity:420, unit:'g', expiry:null, addedAt:todayISO()},
        {id:uid('lot'), ingredientId:'mushroom', name:'Champignons', quantity:170, unit:'g', expiry:new Date(Date.now()+2*86400000).toISOString().slice(0,10), addedAt:todayISO()},
        {id:uid('lot'), ingredientId:'parmesan', name:'Parmesan', quantity:90, unit:'g', expiry:null, addedAt:todayISO()}
      ]
    },
    history: [],
    settings: { name }
  });

  function normalizeUserData(data, name='Utilisateur') {
    data ||= defaultUserData(name);
    data.settings ||= {};
    data.settings.name ||= name;
    data.settings.seenNotifications ||= [];
    data.settings.browserNotified ||= [];
    data.cart ||= [];
    data.purchaseOverrides ||= {};
    data.pantry ||= {permanent:[],lots:[]};
    data.pantry.permanent ||= [];
    data.pantry.lots ||= [];
    data.history ||= [];
    data.recipes ||= [];
    return data;
  }
  function loadUser(id, name='Utilisateur') {
    const saved = localStorage.getItem(USER_KEY(id));
    if (saved) return normalizeUserData(JSON.parse(saved), name);
    const data = normalizeUserData(defaultUserData(name), name);
    localStorage.setItem(USER_KEY(id), JSON.stringify(data));
    return data;
  }

  // En production, cette identité est remplacée par /api/me, lui-même alimenté
  // uniquement par les headers Authentik transmis par Caddy.
  let sessionUser = {id:'local-alexis', username:'alexis', name:'Alexis', email:'', groups:['local-development'], authentik:false};
  let serverAvailable = false;
  let userData = loadUser(sessionUser.id, sessionUser.name);
  let ui = { page:'home', search:'', recipeId:null, servings:1, modal:null, cookSession:null, timer:null, timerInterval:null, stockExpanded:{}, menuOpen:false };

  function apiPost(url, state){
    if(!serverAvailable) return;
    fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})}).catch(()=>{});
  }
  function saveUser(){
    localStorage.setItem(USER_KEY(sessionUser.id), JSON.stringify(userData));
    apiPost('/api/me/state',userData);
  }

  async function syncFromServer(){
    try{
      const health=await fetch('/api/health',{cache:'no-store'});
      if(!health.ok) return;
      serverAvailable=true;

      const meResponse=await fetch('/api/me',{cache:'no-store'});
      if(!meResponse.ok) throw new Error('Identité Authentik indisponible');
      sessionUser=await meResponse.json();
      sessionUser.name ||= sessionUser.username || 'Utilisateur';

      // Le cache local est maintenant lui aussi isolé par identité Authentik.
      userData=loadUser(sessionUser.id,sessionUser.name);

      const stateResponse=await fetch('/api/me/state',{cache:'no-store'});
      if(stateResponse.ok){
        const payload=await stateResponse.json();
        if(payload.state){
          userData=normalizeUserData(payload.state,sessionUser.name);
          localStorage.setItem(USER_KEY(sessionUser.id),JSON.stringify(userData));
        }else{
          apiPost('/api/me/state',userData);
        }
      }
      render();
    }catch(_){
      serverAvailable=false;
      render();
    }
  }

  function activeUser(){ return sessionUser; }
  function recipeById(id){ return userData.recipes.find(r => r.id === id); }
  function ingredientQtyLabel(qty, unit){
    const n = Number(qty);
    if (unit === 'unit') return `${fmtMeasure(n)} ${Math.abs(n) > 1 ? 'unités' : 'unité'}`;
    if (unit === 'tbsp') return `${fmtMeasure(n)} c. à soupe`;
    if (unit === 'tsp') return `${fmtMeasure(n)} c. à café`;
    if (unit === 'pinch') return `${fmtMeasure(n)} ${Math.abs(n) > 1 ? 'pincées' : 'pincée'}`;
    return `${fmt(n)} ${unit}`;
  }
  function ingredientLookup(){
    const map = {};
    userData.recipes.forEach(r => r.ingredients.forEach(i => { map[i.id] ||= i; }));
    userData.pantry.lots.forEach(l => { map[l.ingredientId] ||= {id:l.ingredientId,name:l.name,unit:l.unit,aisle:'autre',packageQty:l.quantity,estimatedPrice:0}; });
    return map;
  }
  function permanentSet(){ return new Set(userData.pantry.permanent); }
  function stockTotals(){
    const totals = {};
    userData.pantry.lots.forEach(l => {
      const displayUnit = baseUnit(l.unit);
      const k = `${l.ingredientId}__${displayUnit}`;
      totals[k] ||= {ingredientId:l.ingredientId,name:l.name,unit:displayUnit,quantity:0,lots:[]};
      totals[k].quantity += toBaseQty(l.quantity,l.unit);
      totals[k].lots.push(l);
    });
    return totals;
  }
  function availableQty(id, unit){
    const targetBase = baseUnit(unit);
    const baseTotal = userData.pantry.lots
      .filter(l => l.ingredientId===id && baseUnit(l.unit)===targetBase)
      .reduce((sum,l)=>sum+toBaseQty(l.quantity,l.unit),0);
    return fromBaseQty(baseTotal,unit);
  }
  function expiryForIngredient(id){
    const dates = userData.pantry.lots.filter(l=>l.ingredientId===id && l.quantity>0 && l.expiry).map(l=>l.expiry).sort();
    return dates[0] || null;
  }
  function calcRecipeCost(recipe, servings=1){
    return recipe.ingredients.reduce((sum,i)=>{
      const q = Number(i.quantity)*servings;
      if (!i.estimatedPrice) return sum;
      if (i.unit==='g') return sum + q/1000*Number(i.estimatedPrice);
      if (i.unit==='ml') return sum + q/1000*Number(i.estimatedPrice);
      // unit/tbsp/tsp/pinch use an estimated price per displayed measure.
      return sum + q*Number(i.estimatedPrice);
    },0);
  }
  function recipeAvailability(recipe){
    const permanent = permanentSet();
    let needed=0, covered=0, missing=[];
    let urgency=0;
    recipe.ingredients.forEach(i=>{
      if (permanent.has(i.id)) return;
      needed += 1;
      const have = availableQty(i.id,i.unit);
      const ratio = Math.min(1, have/Number(i.quantity));
      covered += ratio;
      if (have < Number(i.quantity)) missing.push({ingredient:i,missing:Number(i.quantity)-have});
      const exp = expiryForIngredient(i.id);
      const d = daysUntil(exp);
      if (d <= 3 && have > 0) urgency += (4 - Math.max(0,d));
    });
    return { coverage: needed ? covered/needed : 1, missing, urgency };
  }
  function shoppingData(){
    const req = {};
    const permanent = permanentSet();
    userData.cart.forEach(entry=>{
      const recipe = recipeById(entry.recipeId);
      if (!recipe) return;
      recipe.ingredients.forEach(i=>{
        const normalizedUnit = baseUnit(i.unit);
        const k=`${i.id}__${normalizedUnit}`;
        const normalizedPackage = toBaseQty(Number(i.packageQty)||Number(i.quantity)||1,i.unit);
        req[k] ||= {
          ...i,
          unit:normalizedUnit,
          packageQty:normalizedPackage,
          estimatedPrice:estimatedPriceInBase(i),
          required:0
        };
        req[k].required += toBaseQty(Number(i.quantity)*Number(entry.servings),i.unit);
      });
    });
    return Object.values(req).map(i=>{
      const have = permanent.has(i.id) ? Infinity : availableQty(i.id,i.unit);
      const missing = permanent.has(i.id) ? 0 : Math.max(0, i.required-have);
      const p = Number(i.packageQty)||missing||1;
      const suggested = missing > 0 ? Math.ceil(missing/p)*p : 0;
      const key=`${i.id}__${i.unit}`;
      const buy = userData.purchaseOverrides[key] ?? suggested;
      return { ...i, have, missing, suggested, buy:Number(buy), permanent:permanent.has(i.id), key };
    });
  }
  function shoppingCount(){ return shoppingData().filter(i=>i.buy>0).length; }

  function currentNotifications(){
    const notes=[];
    userData.pantry.lots
      .filter(l=>Number(l.quantity)>0 && l.expiry)
      .forEach(l=>{
        const d=daysUntil(l.expiry);
        if(d>3) return;
        const when=d<0?'date dépassée':d===0?'à utiliser aujourd’hui':d===1?'à utiliser demain':`à utiliser dans ${d} jours`;
        notes.push({
          id:`expiry:${l.id}:${l.expiry}`,
          type:d<=0?'urgent':'expiry', icon:'calendar', title:l.name,
          detail:`${ingredientQtyLabel(l.quantity,l.unit)} · ${when}`,
          page:'stock', sort:d
        });
      });
    const count=shoppingCount();
    if(count>0){
      notes.push({
        id:`shopping:${count}:${userData.cart.length}`, type:'shopping', icon:'cart', title:'Courses en attente',
        detail:`${count} produit${count>1?'s':''} à acheter pour ${userData.cart.length} repas ajouté${userData.cart.length>1?'s':''}`,
        page:'shopping', sort:10
      });
    }
    return notes.sort((a,b)=>a.sort-b.sort);
  }
  function seenNotificationSet(){ return new Set(userData.settings?.seenNotifications||[]); }
  function unreadNotifications(){ const seen=seenNotificationSet(); return currentNotifications().filter(n=>!seen.has(n.id)); }
  function notificationCount(){ return unreadNotifications().length; }
  function markNotificationSeen(id){
    userData.settings ||= {};
    const seen=seenNotificationSet(); seen.add(id);
    userData.settings.seenNotifications=[...seen].slice(-100); saveUser();
  }
  function markAllNotificationsSeen(){
    userData.settings ||= {};
    const seen=seenNotificationSet(); currentNotifications().forEach(n=>seen.add(n.id));
    userData.settings.seenNotifications=[...seen].slice(-100); saveUser();
  }
  function renderStepText(text, ingredients){
    let out = esc(text);
    ingredients.forEach(i=>{
      const token = `{{${i.id}}}`;
      out = out.split(token).join(`<strong>${esc(ingredientQtyLabel(i.quantity, i.unit))}</strong>`);
    });
    return out;
  }

  function icon(name, cls=''){
    const icons = {
      menu:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
      home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10 12 3.5 20.5 10"/><path d="M6.5 9.5V20h11V9.5"/></svg>`,
      recipes:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
      cart:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 11H7L6 8Z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>`,
      stock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9l8-4Z"/><path d="M12 20.5v-9"/><path d="M20 7.5l-8 4-8-4"/></svg>`,
      user:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.25"/><path d="M5 19a7 7 0 0 1 14 0"/></svg>`,
      add:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
      eat:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
      back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
      close:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
      scale:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M6 8h12"/><path d="M8 8l-3 5h6l-3-5Z"/><path d="M16 8l-3 5h6l-3-5Z"/></svg>`,
      search:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
      arrow:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`,
      clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
      spark:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 13.7 8.3 17.5 10l-3.8 1.7L12 15.5l-1.7-3.8L6.5 10l3.8-1.7L12 4.5Z"/><path d="M18.5 14.5 19.2 16l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z"/></svg>`,
      bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 6.5H4S6.5 15 6.5 9Z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/></svg>`,
      calendar:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/></svg>`,
      checkCircle:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>`,
      chevronDown:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
      info:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>`
    };
    return `<span class="icon-svg ${cls}" aria-hidden="true">${icons[name]||''}</span>`;
  }

  function renderMenu(){
    if(!ui.menuOpen) return '';
    const navItems=[
      ['home','home','Accueil'],
      ['recipes','recipes','Mes recettes'],
      ['shopping','cart','Mes courses'],
      ['stock','stock','Mon stock'],
      ['profile','user','Profil']
    ];
    const user = activeUser();
    const notifCount=notificationCount();
    return `<div class="menu-backdrop" data-action="close-menu"><aside class="side-menu" data-stop-menu>
      <div class="menu-head"><div class="menu-account"><div class="profile-avatar menu-avatar">${esc(user.name[0].toUpperCase())}</div><div><div class="eyebrow">Compte actif</div><h3>${esc(user.name)}</h3></div></div><button class="icon-btn" data-action="close-menu">${icon('close')}</button></div>
      <button class="menu-notification" data-action="notifications">${icon('bell')}<span><strong>Notifications</strong><small>${notifCount?`${notifCount} nouvelle${notifCount>1?'s':''}`:'Tout est à jour'}</small></span>${notifCount?`<span class="menu-count">${notifCount}</span>`:''}</button>
      <div class="menu-list">${navItems.map(([id,ico,label])=>`<button class="menu-link ${ui.page===id?'active':''}" data-nav="${id}">${icon(ico)}<span>${label}</span>${id==='shopping'&&shoppingCount()?`<span class="menu-count">${shoppingCount()}</span>`:''}</button>`).join('')}</div>
      <div class="menu-footer"><button class="ghost-btn" data-action="import-recipe">Importer une recette</button><div class="auth-account-note">${icon('checkCircle')}<span>${user.authentik?'Identité vérifiée par Authentik':'Mode local'}</span></div><div class="menu-version">Cuisine · Premium V3.3</div></div>
    </aside></div>`;
  }

  function renderDesktopNav(){
    const user=activeUser();
    const notifCount=notificationCount();
    const navItems=[
      ['home','home','Accueil'],
      ['recipes','recipes','Mes recettes'],
      ['shopping','cart','Mes courses'],
      ['stock','stock','Mon stock'],
      ['profile','user','Profil']
    ];
    return `<aside class="desktop-nav">
      <div class="desktop-brand"><span class="desktop-mark">C</span><div><strong>Cuisine</strong><small>Premium</small></div></div>
      <nav class="desktop-nav-list">${navItems.map(([id,ico,label])=>`<button class="desktop-nav-link ${ui.page===id?'active':''}" data-nav="${id}">${icon(ico)}<span>${label}</span>${id==='shopping'&&shoppingCount()?`<span class="desktop-count">${shoppingCount()}</span>`:''}</button>`).join('')}</nav>
      <button class="desktop-notification ${notifCount?'has-notifications':''}" data-action="notifications">${icon('bell')}<span><strong>Notifications</strong><small>${notifCount?`${notifCount} nouvelle${notifCount>1?'s':''}`:'Tout est à jour'}</small></span>${notifCount?`<span class="desktop-count alert">${notifCount}</span>`:''}</button>
      <div class="desktop-nav-bottom">
        <button class="desktop-import" data-action="import-recipe">${icon('add')}<span>Importer une recette</span></button>
        <button class="desktop-user" data-nav="profile"><span class="profile-avatar desktop-avatar">${esc(user.name[0].toUpperCase())}</span><span><strong>${esc(user.name)}</strong><small>${user.email?esc(user.email):user.authentik?'Compte Authentik':'Compte local'}</small></span>${icon('arrow')}</button>
      </div>
    </aside>`;
  }

  function shell(content, opts={}){
    const user=activeUser();
    const notifCount=notificationCount();
    return `<div class="app-frame">
      ${renderDesktopNav()}
      <div class="shell">
        <header class="topbar">
          <div class="brand-wrap">
            <button class="menu-btn" data-action="toggle-menu" aria-label="Ouvrir le menu">${icon('menu')}</button>
            <div class="brand"><h1>Cuisine</h1><span>${esc(user.name)}</span></div>
          </div>
          <button class="notification-btn ${notifCount?'has-notifications':''}" data-action="notifications" aria-label="Notifications">${icon('bell')}${notifCount?`<span class="notification-badge">${notifCount>9?'9+':notifCount}</span>`:''}</button>
        </header>
        <main class="content">${content}</main>
      </div>
    </div>
    ${renderMenu()}`;
  }

  function renderHome(){
    const ranked = userData.recipes.map(r=>({r,...recipeAvailability(r)})).sort((a,b)=>(b.urgency-a.urgency)||(b.coverage-a.coverage));
    const urgent = ranked.filter(x=>x.urgency>0);
    const ready = ranked.filter(x=>x.coverage>=.999);
    const almost = ranked.filter(x=>x.coverage<.999).sort((a,b)=>b.coverage-a.coverage);
    const featured = (urgent[0] || ready[0] || ranked[0]);
    const featuredId = featured?.r?.id;
    const readyRest = ready.filter(x=>x.r.id!==featuredId).slice(0,6).map(x=>x.r);
    const almostRest = almost.filter(x=>x.r.id!==featuredId).slice(0,6).map(x=>x.r);
    return shell(`
      <section class="home-intro">
        <div class="eyebrow">Bonjour ${esc(activeUser().name)}</div>
        <h2>Qu'est-ce qu'on mange ?</h2>
        <p>Selon ton stock et ce qui doit être utilisé bientôt.</p>
      </section>
      <div class="quick-strip">
        <button class="quick-action" data-action="what-can-eat"><span class="quick-icon">${icon('eat')}</span><span><strong>Je peux manger quoi ?</strong><small>Voir les meilleurs choix</small></span>${icon('arrow','action-arrow')}</button>
        <button class="quick-action" data-nav="shopping"><span class="quick-icon">${icon('cart')}</span><span><strong>Courses</strong><small>${shoppingCount()?`${shoppingCount()} produit${shoppingCount()>1?'s':''} à acheter`:'Aucune course en attente'}</small></span>${icon('arrow','action-arrow')}</button>
        <button class="quick-action" data-nav="stock"><span class="quick-icon">${icon('stock')}</span><span><strong>Stock</strong><small>${Object.keys(stockTotals()).length} produit${Object.keys(stockTotals()).length>1?'s':''} suivi${Object.keys(stockTotals()).length>1?'s':''}</small></span>${icon('arrow','action-arrow')}</button>
      </div>
      ${featured?featuredRecipeCard(featured):''}
      ${readyRest.length?recipeRail('Prêt à cuisiner','Tu as déjà tout ce qu’il faut.',readyRest):''}
      ${almostRest.length?recipeRail('Presque prêt','Il ne manque que quelques produits.',almostRest):''}
    `);
  }

  function featuredRecipeCard(item){
    const r=item.r;
    const a=recipeAvailability(r);
    const exp = r.ingredients.map(i=>({i,d:daysUntil(expiryForIngredient(i.id))})).filter(x=>x.d<=3).sort((x,y)=>x.d-y.d)[0];
    const label = item.urgency>0 ? 'À cuisiner en priorité' : a.coverage>=.999 ? 'Suggestion du jour' : 'Meilleur choix';
    const note = item.urgency>0 && exp ? `${exp.i.name} à utiliser ${exp.d<=0?'aujourd’hui':exp.d===1?'demain':`dans ${exp.d} jours`}` : a.coverage>=.999 ? 'Tout est déjà dans ton stock' : `${a.missing.length} ingrédient${a.missing.length>1?'s':''} à compléter`;
    return `<section class="section featured-section"><div class="section-head"><div><div class="eyebrow">${esc(label)}</div></div></div><button class="featured-recipe" data-recipe="${esc(r.id)}">${r.image?`<img src="${esc(r.image)}" alt="">`:`<div class="featured-art"><span>${esc(r.name.slice(0,1))}</span>${icon('spark')}</div>`}<div class="featured-overlay"></div><div class="featured-content"><span class="featured-kicker">${esc(note)}</span><h3>${esc(r.name)}</h3><div class="featured-meta"><span>≈ ${calcRecipeCost(r).toFixed(2).replace('.',',')} € / personne</span><span class="featured-open">Voir la recette ${icon('arrow')}</span></div></div></button></section>`;
  }

  function recipeRail(title, subtitle, recipes){
    return `<section class="section"><div class="section-head"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><button class="text-btn" data-nav="recipes">Tout voir</button></div><div class="recipe-rail">${recipes.map(r=>recipeCard(r)).join('')}</div></section>`;
  }

  function recipeCard(r, urgent=false){
    const a=recipeAvailability(r);
    const expIngredients = r.ingredients.map(i=>({i,d:daysUntil(expiryForIngredient(i.id))})).filter(x=>x.d<=3).sort((a,b)=>a.d-b.d);
    const status = a.coverage>=.999 ? '<span class="pill good">Disponible</span>' : `<span class="pill">${a.missing.length} manque${a.missing.length>1?'nt':''}</span>`;
    const exp = urgent && expIngredients.length ? `<span class="pill warn">À utiliser vite</span>` : '';
    return `<button class="recipe-card" data-recipe="${esc(r.id)}">
      ${r.image?`<img class="recipe-photo" src="${esc(r.image)}" alt="">`:`<div class="recipe-placeholder">${esc(r.name.slice(0,1))}</div>`}
      <div class="recipe-body"><div class="recipe-title">${esc(r.name)}</div><div class="recipe-meta">${status}${exp}<span class="pill">≈ ${calcRecipeCost(r).toFixed(2).replace('.',',')} €</span></div></div>
    </button>`;
  }

  function renderRecipes(){
    const q=ui.search.trim().toLowerCase();
    const recipes=userData.recipes.filter(r=>r.name.toLowerCase().includes(q)||r.ingredients.some(i=>i.name.toLowerCase().includes(q)));
    return shell(`
      <section class="hero"><div class="eyebrow">Bibliothèque</div><h2>Mes recettes</h2><p>${userData.recipes.length} recette${userData.recipes.length>1?'s':''}, toutes enregistrées pour une personne.</p></section>
      <div class="searchbar">${icon('search')}<input id="recipe-search" placeholder="Chercher une recette ou un aliment" value="${esc(ui.search)}"></div>
      <section class="section"><div class="recipe-grid">${recipes.length?recipes.map(r=>recipeCard(r)).join(''):'<div class="empty" style="grid-column:1/-1">Aucune recette trouvée.</div>'}</div></section>
    `);
  }

  function renderRecipeDetail(){
    const r=recipeById(ui.recipeId);
    if(!r){ ui.page='recipes'; return renderRecipes(); }
    const servings=Math.max(1,ui.servings||1);
    const a=recipeAvailability(r);
    return shell(`
      <div class="detail-hero">
        ${r.image?`<img src="${esc(r.image)}" alt="">`:`<div class="recipe-placeholder">${esc(r.name.slice(0,1))}</div>`}
        <button class="icon-btn back-floating" data-action="back-recipes">${icon('back')}</button>
      </div>
      <section class="detail-title">
        <div class="row"><div><h2>${esc(r.name)}</h2><div class="recipe-meta"><span class="pill ${a.coverage>=.999?'good':''}">${a.coverage>=.999?'Disponible avec ton stock':`${a.missing.length} ingrédient${a.missing.length>1?'s':''} à compléter`}</span><span class="pill">≈ ${(calcRecipeCost(r,servings)).toFixed(2).replace('.',',')} €</span></div></div></div>
      </section>
      <section class="section"><div class="row"><div><strong>Portions</strong><div class="small muted">La recette de base reste pour 1 personne.</div></div><div class="servings"><button data-action="servings-minus">−</button><strong>${servings} personne${servings>1?'s':''}</strong><button data-action="servings-plus">+</button></div></div></section>
      <div class="detail-columns">
        <section class="section card detail-panel"><div class="section-head"><div><h3>Ingrédients</h3><p>Quantités calculées pour ${servings}.</p></div><button class="text-btn" data-action="edit-base">Modifier la base</button></div>
          ${r.ingredients.map(i=>`<div class="ingredient-row"><div><strong>${esc(i.name)}</strong><div class="small muted">${esc(AISLE_LABEL[i.aisle]||'Autres')}</div></div><div class="qty">${esc(ingredientQtyLabel(Number(i.quantity)*servings,i.unit))}</div></div>`).join('')}
        </section>
        <section class="section card detail-panel"><div class="section-head"><div><h3>Préparation</h3><p>${r.steps.length} étapes</p></div></div>
          ${r.steps.map((s,idx)=>`<div class="ingredient-row" style="grid-template-columns:30px 1fr"><div class="pill">${idx+1}</div><div class="small" style="font-size:13px;line-height:1.5">${renderStepText(s.text,r.ingredients.map(i=>({...i,quantity:Number(i.quantity)*servings})))}</div></div>`).join('')}
        </section>
      </div>
      <div class="action-stack two detail-actions"><button class="secondary" data-action="add-cart">Ajouter aux courses</button><button class="primary" data-action="start-cook">Cuisiner</button></div>
    `);
  }

  function renderShopping(){
    const items=shoppingData();
    const byAisle={};
    items.filter(i=>!i.permanent && (i.missing>0 || i.buy>0)).forEach(i=>{ (byAisle[i.aisle] ||= []).push(i); });
    const cartSummary=userData.cart.map((e,idx)=>{const r=recipeById(e.recipeId);return r?`<div class="row card"><div><strong>${esc(r.name)}</strong><div class="small muted">${e.servings} personne${e.servings>1?'s':''}</div></div><button class="icon-btn compact-icon-btn" data-remove-cart="${idx}" aria-label="Retirer">${icon('close')}</button></div>`:''}).join('');
    const nothingToBuy = Object.values(byAisle).flat().length===0;
    return shell(`
      <section class="hero"><div class="eyebrow">Panier</div><h2>Les courses</h2><p>Les besoins de toutes les recettes sont additionnés, puis ton stock est déduit automatiquement.</p></section>
      ${userData.cart.length?`<section class="section"><div class="section-head"><div><h3>Repas ajoutés</h3><p>${userData.cart.length} ajout${userData.cart.length>1?'s':''}</p></div><button class="text-btn" data-action="clear-cart">Vider</button></div><div class="list">${cartSummary}</div></section>`:''}
      ${!userData.cart.length?`<div class="empty section">Ajoute des recettes depuis ta bibliothèque. Les ingrédients seront regroupés ici.</div>`:
        nothingToBuy?`<div class="card section"><strong>Tu as déjà tout.</strong><p class="muted small">Ton stock couvre les recettes ajoutées.</p></div>`:
        `${AISLE_ORDER.filter(a=>byAisle[a]?.length).map(a=>`<section class="section card"><div class="section-head"><div><h3>${esc(AISLE_LABEL[a]||'Autres')}</h3></div></div>${byAisle[a].map(i=>shoppingRow(i)).join('')}</section>`).join('')}
        <div class="action-stack"><button class="primary" data-action="shopping-done">Les courses sont faites</button><div class="small muted" style="text-align:center">Tu peux modifier chaque quantité achetée juste au-dessus avant de valider.</div></div>`}
    `);
  }
  function shoppingRow(i){
    const price = i.unit==='unit' ? i.buy*i.estimatedPrice : (i.buy/1000)*i.estimatedPrice;
    return `<div class="shopping-item"><div><strong>${esc(i.name)}</strong><div class="need">Besoin ${ingredientQtyLabel(i.required,i.unit)} · chez toi ${i.have===Infinity?'permanent':ingredientQtyLabel(i.have,i.unit)}</div><span class="package-chip">conditionnement suggéré ${ingredientQtyLabel(i.packageQty,i.unit)}</span></div><div style="text-align:right"><div class="buy">À acheter</div><div class="row" style="justify-content:flex-end;margin-top:6px"><input class="qty-input" type="number" min="0" step="${i.unit==='unit'?1:10}" value="${esc(i.buy)}" data-purchase-key="${esc(i.key)}"><span class="small muted">${esc(unitShortLabel(i.unit))}</span></div><div class="small muted" style="margin-top:5px">≈ ${price.toFixed(2).replace('.',',')} €</div></div></div>`;
  }

  function renderStock(){
    const totals=Object.values(stockTotals()).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    const lookup=ingredientLookup();
    const permanentIds=[...new Set([...userData.pantry.permanent])];
    return shell(`
      <section class="hero"><div class="eyebrow">Garde-manger</div><h2>Mon stock</h2><p>Chaque achat reste un lot séparé en interne pour consommer ce qui périme en premier.</p></section>
      <section class="section"><div class="section-head"><div><h3>Produits permanents</h3><p>Ils sont considérés comme toujours disponibles.</p></div><button class="text-btn" data-action="manage-permanent">Gérer</button></div>
        <div class="card">${permanentIds.length?permanentIds.map(id=>`<span class="pill good" style="margin:4px">${esc(lookup[id]?.name||id)}</span>`).join(''):'<span class="muted small">Aucun produit permanent.</span>'}</div>
      </section>
      <section class="section"><div class="section-head"><div><h3>Produits suivis</h3><p>${totals.length} produit${totals.length>1?'s':''}</p></div><button class="text-btn" data-action="add-stock">Ajouter</button></div>
        <div class="list">${totals.length?totals.map(stockCard).join(''):'<div class="empty">Ton garde-manger est vide.</div>'}</div>
      </section>
    `);
  }
  function stockCard(t){
    const expanded=!!ui.stockExpanded[t.ingredientId];
    const sorted=[...t.lots].sort((a,b)=>(a.expiry||'9999-12-31').localeCompare(b.expiry||'9999-12-31'));
    const next=sorted.find(l=>l.expiry);
    const d=next?daysUntil(next.expiry):Infinity;
    return `<div class="card"><button class="row" style="width:100%;border:0;background:transparent;text-align:left;padding:0" data-toggle-stock="${esc(t.ingredientId)}"><div><strong>${esc(t.name)}</strong>${next?`<div class="expiry ${d<=2?'urgent':''}">${d<0?'Périmé':d===0?'Périme aujourd’hui':d===1?'Périme demain':`Prochaine péremption ${formatDate(next.expiry)}`}</div>`:''}</div><div style="text-align:right"><div class="stock-total">${esc(ingredientQtyLabel(t.quantity,t.unit))}</div><div class="stock-lot-count"><span>${t.lots.length} lot${t.lots.length>1?'s':''}</span><span class="stock-chevron ${expanded?'open':''}">${icon('chevronDown')}</span></div></div></button>${expanded?`<div>${sorted.map(l=>`<div class="lot"><span>${ingredientQtyLabel(l.quantity,l.unit)}${l.expiry?` · ${formatDate(l.expiry)}`:' · sans date'}</span><button class="text-btn" data-delete-lot="${esc(l.id)}">Supprimer</button></div>`).join('')}</div>`:''}</div>`;
  }

  function renderProfile(){
    const u=activeUser();
    const stockCount=Object.keys(stockTotals()).length;
    const notifCount=notificationCount();
    return shell(`
      <section class="hero profile-hero"><div class="eyebrow">Compte</div><h2>${esc(u.name)}</h2><p>Tes recettes, ton stock et ton historique restent séparés des autres comptes.</p></section>
      <section class="profile-summary">
        <div class="profile-main-card"><div class="profile-avatar profile-avatar-lg">${esc(u.name[0].toUpperCase())}</div><div><strong>${esc(u.name)}</strong><span>${u.email?esc(u.email):u.authentik?'Compte Authentik':'Compte local'}</span></div><span class="auth-badge">${icon('checkCircle')} ${u.authentik?'Authentik':'Local'}</span></div>
        <div class="profile-stats"><div><strong>${userData.recipes.length}</strong><span>recettes</span></div><div><strong>${stockCount}</strong><span>produits</span></div><div><strong>${userData.history.length}</strong><span>préparations</span></div></div>
      </section>
      <section class="section settings-list">
        <button class="settings-row" data-action="notifications"><span class="settings-icon">${icon('bell')}</span><span><strong>Notifications</strong><small>Péremptions et courses en attente</small></span><span class="settings-tail">${notifCount?`<span class="settings-badge">${notifCount}</span>`:icon('checkCircle')}</span></button>
        <button class="settings-row" data-action="import-recipe"><span class="settings-icon">${icon('add')}</span><span><strong>Importer une recette</strong><small>Fichier .txt / JSON généré par l’agent Cuisine</small></span><span class="settings-tail">${icon('arrow')}</span></button>
      </section>
      <section class="section"><div class="section-head"><div><h3>Historique</h3><p>Les versions réellement cuisinées.</p></div></div><div class="list">${userData.history.length?userData.history.slice().reverse().map(historyCard).join(''):`<div class="empty premium-empty"><span class="empty-icon">${icon('recipes')}</span><strong>Pas encore d’historique</strong><span>Les plats terminés apparaîtront ici.</span></div>`}</div></section>
      <div class="app-footnote"><span class="sync-dot ${serverAvailable?'online':'local'}"></span>${serverAvailable?(u.authentik?'Synchronisé · identité Authentik':'Synchronisé avec le serveur'):'Mode local'} · Cuisine Premium V3.3</div>
    `);
  }
  function historyCard(h){
    return `<div class="card history-card"><div class="row"><div><strong>${esc(h.recipeName)}</strong><div class="small muted">${new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(h.date))} · ${h.servings} personne${h.servings>1?'s':''}</div></div></div><div class="version-list">${h.ingredients.slice(0,4).map(i=>`${esc(i.name)} ${esc(ingredientQtyLabel(i.quantity,i.unit))}`).join(' · ')}${h.ingredients.length>4?'…':''}</div><div class="action-stack"><button class="secondary" data-redo-history="${esc(h.id)}">Refaire exactement cette version</button></div></div>`;
  }

  function renderCook(){
    const s=ui.cookSession;
    if(!s) return '';
    const step=s.steps[s.stepIndex];
    const next=s.steps.slice(s.stepIndex+1,s.stepIndex+3);
    const pct=(s.stepIndex/Math.max(1,s.steps.length))*100;
    return `<div class="cook-shell"><div class="cook-top"><div><div class="small muted">${esc(s.recipeName)}</div><strong>${s.servings} personne${s.servings>1?'s':''}</strong></div><div class="row"><button class="icon-btn" data-action="cook-weights">${icon('scale')}</button><button class="icon-btn" data-action="exit-cook">${icon('close')}</button></div></div><div class="progress"><div style="width:${pct}%"></div></div><main class="cook-main"><div class="step-count">Étape ${s.stepIndex+1} / ${s.steps.length}</div><div class="current-step">${renderStepText(step.text,s.ingredients)}</div>${step.timers?.length?`<div class="timer-grid">${step.timers.map(m=>`<button class="timer-btn" data-timer-minutes="${m}">Minuteur ${m} min</button>`).join('')}</div>`:''}<div class="next-steps"><div class="eyebrow">Ensuite</div>${next.length?next.map((n,idx)=>`<div class="next-step"><b>${s.stepIndex+idx+2}</b><span>${renderStepText(n.text,s.ingredients)}</span></div>`).join(''):'<div class="next-step"><b>✓</b><span>Dernière étape. Tu pourras ensuite enregistrer les quantités réellement utilisées.</span></div>'}</div></main><div class="cook-actions"><button class="ghost-btn" data-action="cook-prev" ${s.stepIndex===0?'disabled':''}>Précédent</button><button class="primary" data-action="cook-next">${s.stepIndex===s.steps.length-1?'Terminer':'Étape terminée'}</button></div>${renderFloatingTimer()}</div>`;
  }
  function renderFloatingTimer(){
    if(!ui.timer) return '';
    const remaining=Math.max(0,ui.timer.endsAt-Date.now());
    const sec=Math.ceil(remaining/1000); const m=Math.floor(sec/60); const s=String(sec%60).padStart(2,'0');
    return `<button class="timer-floating" data-action="cancel-timer">${m}:${s}</button>`;
  }

  function modal(content){ return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" data-stop-modal>${content}</div></div>`; }
  function renderModal(){
    if(!ui.modal) return '';
    const m=ui.modal;
    if(m.type==='notifications'){
      const notes=currentNotifications();
      const seen=seenNotificationSet();
      return modal(`<div class="modal-head notification-head"><div><div class="eyebrow">Centre</div><h3>Notifications</h3></div><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div>
        ${notes.length?`<div class="notification-list">${notes.map(n=>`<button class="notification-row ${seen.has(n.id)?'is-read':'is-unread'} ${n.type==='urgent'?'is-urgent':''}" data-notification-id="${esc(n.id)}" data-notification-page="${esc(n.page)}"><span class="notification-icon">${icon(n.icon)}</span><span class="notification-copy"><strong>${esc(n.title)}</strong><small>${esc(n.detail)}</small></span>${seen.has(n.id)?'':`<span class="unread-dot"></span>`}${icon('arrow','notification-arrow')}</button>`).join('')}</div><button class="text-btn notification-read-all" data-action="mark-all-notifications">Tout marquer comme lu</button>`:
        `<div class="empty premium-empty notification-empty"><span class="empty-icon">${icon('checkCircle')}</span><strong>Tout est à jour</strong><span>Aucune péremption proche ni course en attente.</span></div>`}`);
    }
    if(m.type==='what-can-eat'){
      const ranked=userData.recipes.map(r=>({r,...recipeAvailability(r)})).sort((a,b)=>(b.urgency-a.urgency)||(b.coverage-a.coverage));
      return modal(`<div class="modal-head"><h3>Je peux manger quoi ?</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><div class="list">${ranked.map(x=>`<button class="card row" style="text-align:left" data-recipe-modal="${esc(x.r.id)}"><div><strong>${esc(x.r.name)}</strong><div class="small muted">${x.coverage>=.999?'Tout est disponible':`${Math.round(x.coverage*100)} % couvert · ${x.missing.length} manque${x.missing.length>1?'nt':''}`}</div></div>${x.urgency?'<span class="pill warn">Prioritaire</span>':x.coverage>=.999?'<span class="pill good">Prêt</span>':''}</button>`).join('')}</div>`);
    }
    if(m.type==='purchase-expiry'){
      return modal(`<div class="modal-head"><h3>Ajouter les achats au stock</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><p class="small muted">Les quantités sont celles que tu viens de confirmer. La péremption est facultative et chaque produit devient un lot distinct.</p><div class="list">${m.items.map((i,idx)=>`<div class="card"><div class="row"><div><strong>${esc(i.name)}</strong><div class="small muted">${ingredientQtyLabel(i.buy,i.unit)}</div></div></div><div class="field"><label>Péremption facultative</label><input type="date" data-expiry-index="${idx}"></div></div>`).join('')}</div><div class="action-stack"><button class="primary" data-action="confirm-purchases">Tout ajouter au garde-manger</button></div>`);
    }
    if(m.type==='add-stock'){
      const lookup=Object.values(ingredientLookup()).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
      return modal(`<div class="modal-head"><h3>Ajouter au stock</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><div class="field"><label>Produit</label><select id="stock-ing">${lookup.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></div><div class="row"><div class="field" style="flex:1"><label>Quantité</label><input id="stock-qty" type="number" min="0" value="100"></div><div class="field" style="width:105px"><label>Unité</label><select id="stock-unit"><option value="g">g</option><option value="ml">ml</option><option value="unit">unité</option><option value="tbsp">c. à soupe</option><option value="tsp">c. à café</option><option value="pinch">pincée</option></select></div></div><div class="field"><label>Péremption facultative</label><input id="stock-expiry" type="date"></div><div class="action-stack"><button class="primary" data-action="confirm-add-stock">Ajouter</button></div>`);
    }
    if(m.type==='permanent'){
      const lookup=Object.values(ingredientLookup()).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
      const perm=permanentSet();
      return modal(`<div class="modal-head"><h3>Produits permanents</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><p class="small muted">Cuisine ne les décomptera pas et ne les ajoutera pas aux courses.</p><div class="list">${lookup.map(i=>`<label class="card row"><span>${esc(i.name)}</span><input class="switch" type="checkbox" data-permanent-id="${esc(i.id)}" ${perm.has(i.id)?'checked':''}></label>`).join('')}</div>`);
    }
    if(m.type==='cook-weights'){
      const s=ui.cookSession;
      return modal(`<div class="modal-head"><h3>Quantités réellement utilisées</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><p class="small muted">Tu peux corriger une pesée sans modifier la recette originale.</p>${s.ingredients.map((i,idx)=>`<div class="shopping-item"><div><strong>${esc(i.name)}</strong><div class="need">prévu ${ingredientQtyLabel(i.plannedQuantity,i.unit)}</div></div><div class="row"><input class="qty-input" type="number" min="0" step="${inputStep(i.unit)}" value="${esc(i.quantity)}" data-cook-qty="${idx}"><span class="small muted">${esc(unitShortLabel(i.unit))}</span></div></div>`).join('')}<div class="action-stack"><button class="primary" data-action="save-cook-weights">Enregistrer</button></div>`);
    }
    if(m.type==='finish-cook'){
      const s=ui.cookSession; const changes=s.ingredients.filter(i=>Math.abs(i.quantity-i.plannedQuantity)>.0001);
      return modal(`<div class="modal-head"><h3>Plat terminé</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><p>Les quantités réellement utilisées seront retirées du garde-manger et cette version sera gardée dans l'historique.</p>${changes.length?`<div class="card"><strong>${changes.length} modification${changes.length>1?'s':''} aujourd'hui</strong>${changes.map(i=>`<div class="small muted" style="margin-top:7px">${esc(i.name)} : ${ingredientQtyLabel(i.plannedQuantity,i.unit)} → <strong>${ingredientQtyLabel(i.quantity,i.unit)}</strong></div>`).join('')}</div>`:''}<div class="checkline section"><input class="checkbox" id="apply-base" type="checkbox"><label for="apply-base"><strong>Modifier aussi la recette de base</strong><div class="small muted">Les quantités actuelles seront divisées par ${s.servings} et deviendront la nouvelle base pour 1 personne.</div></label></div><div class="action-stack"><button class="primary" data-action="confirm-finish-cook">Terminer et mettre le stock à jour</button></div>`);
    }
    if(m.type==='edit-base'){
      const r=recipeById(ui.recipeId);
      return modal(`<div class="modal-head"><h3>Modifier la recette de base</h3><button class="icon-btn" data-action="close-modal">${icon('close')}</button></div><p class="small muted">Toutes les quantités ci-dessous sont pour 1 personne.</p>${r.ingredients.map((i,idx)=>`<div class="shopping-item"><div><strong>${esc(i.name)}</strong></div><div class="row"><input class="qty-input" type="number" min="0" step="${inputStep(i.unit)}" value="${esc(i.quantity)}" data-base-qty="${idx}"><span class="small muted">${esc(unitShortLabel(i.unit))}</span></div></div>`).join('')}<div class="action-stack"><button class="primary" data-action="save-base">Enregistrer la recette</button></div>`);
    }
    return '';
  }

  function render(){
    if(ui.cookSession){ app.innerHTML=renderCook()+renderModal(); return; }
    let html='';
    if(ui.page==='home') html=renderHome();
    else if(ui.page==='recipes') html=renderRecipes();
    else if(ui.page==='recipe') html=renderRecipeDetail();
    else if(ui.page==='shopping') html=renderShopping();
    else if(ui.page==='stock') html=renderStock();
    else if(ui.page==='profile') html=renderProfile();
    app.innerHTML=html+renderModal();
    const search=$('#recipe-search'); if(search) { search.focus({preventScroll:true}); search.setSelectionRange(search.value.length,search.value.length); }
  }

  function showToast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toastEl.classList.remove('show'),2200); }
  function nav(page){ ui.page=page; ui.modal=null; ui.recipeId=null; ui.menuOpen=false; window.scrollTo({top:0,behavior:'smooth'}); render(); }
  function openRecipe(id){ ui.recipeId=id; ui.servings=1; ui.page='recipe'; ui.modal=null; ui.menuOpen=false; window.scrollTo({top:0,behavior:'smooth'}); render(); }

  function addToCart(recipeId, servings, exactIngredients=null){
    if(exactIngredients){
      // Add a transient recipe clone so shopping quantities exactly match an historical version.
      const source=recipeById(recipeId); if(!source) return;
      const cloneId=uid('variant');
      userData.recipes.push({...JSON.parse(JSON.stringify(source)), id:cloneId, name:`${source.name} · version historique`, ingredients:exactIngredients.map(i=>({...i,quantity:Number(i.quantity)/servings}))});
      userData.cart.push({recipeId:cloneId,servings});
    } else userData.cart.push({recipeId,servings});
    saveUser(); showToast('Ajouté aux courses'); render();
  }

  function validateRecipe(r){
    const errors=[];
    if(!r || typeof r!=='object') errors.push('Le fichier ne contient pas un objet JSON.');
    if(!r?.id || !/^[a-z0-9-]+$/.test(r.id)) errors.push('id absent ou invalide (a-z, 0-9 et tirets uniquement).');
    if(!r?.name) errors.push('name est obligatoire.');
    if(!Array.isArray(r?.ingredients)||!r.ingredients.length) errors.push('ingredients doit contenir au moins un ingrédient.');
    else r.ingredients.forEach((i,idx)=>{
      if(!i.id||!i.name||!ALLOWED_UNITS.includes(i.unit)||!(Number(i.quantity)>0)) errors.push(`Ingrédient ${idx+1} invalide.`);
      if(!(Number(i.packageQty)>0)) errors.push(`Conditionnement manquant pour ${i.name||`ingrédient ${idx+1}`}.`);
    });
    if(!Array.isArray(r?.steps)||!r.steps.length) errors.push('steps doit contenir au moins une étape.');
    return errors;
  }

  async function importRecipeFile(file){
    try{
      const text=await file.text(); const r=JSON.parse(text); const errors=validateRecipe(r);
      if(errors.length){ alert(`Recette refusée :\n\n${errors.join('\n')}`); return; }
      r.version ||=1; r.image ||=null;
      r.ingredients=r.ingredients.map(i=>({...i, aisle:i.aisle||'autre', packageQty:Number(i.packageQty)||Number(i.quantity), estimatedPrice:Number(i.estimatedPrice)||0, quantity:Number(i.quantity)}));
      r.steps=r.steps.map(s=>({text:String(s.text||''),timers:Array.isArray(s.timers)?s.timers.map(Number):[]}));
      const existing=userData.recipes.findIndex(x=>x.id===r.id);
      if(existing>=0){ if(!confirm('Une recette avec cet identifiant existe déjà. La remplacer ?')) return; userData.recipes[existing]=r; }
      else userData.recipes.push(r);
      saveUser(); ui.page='recipes'; ui.search=''; showToast('Recette importée'); render();
    }catch(e){ alert(`Impossible de lire cette recette.\n\n${e.message}`); }
    finally{ fileInput.value=''; }
  }

  function startCook(recipe, servings, exact=null){
    const ingredients=(exact||recipe.ingredients.map(i=>({...i,quantity:Number(i.quantity)*servings}))).map(i=>({...JSON.parse(JSON.stringify(i)),plannedQuantity:Number(i.quantity),quantity:Number(i.quantity)}));
    ui.cookSession={recipeId:recipe.id,recipeName:recipe.name,servings,ingredients,steps:JSON.parse(JSON.stringify(recipe.steps)),stepIndex:0,startedAt:new Date().toISOString()};
    ui.modal=null; render();
  }
  function deductFromPantry(ingredient){
    if(permanentSet().has(ingredient.id)) return;
    const targetBase = baseUnit(ingredient.unit);
    let leftBase = toBaseQty(ingredient.quantity,ingredient.unit);
    const lots=userData.pantry.lots
      .filter(l=>l.ingredientId===ingredient.id&&baseUnit(l.unit)===targetBase&&l.quantity>0)
      .sort((a,b)=>{
        const ea=a.expiry||'9999-12-31', eb=b.expiry||'9999-12-31';
        if(ea!==eb) return ea.localeCompare(eb);
        return (a.addedAt||'').localeCompare(b.addedAt||'');
      });
    for(const lot of lots){
      if(leftBase<=0) break;
      const lotBase=toBaseQty(lot.quantity,lot.unit);
      const takeBase=Math.min(leftBase,lotBase);
      lot.quantity=Math.max(0,Number(lot.quantity)-fromBaseQty(takeBase,lot.unit));
      leftBase-=takeBase;
    }
    userData.pantry.lots=userData.pantry.lots.filter(l=>Number(l.quantity)>.0001);
  }
  function finishCook(applyBase){
    const s=ui.cookSession; const r=recipeById(s.recipeId);
    s.ingredients.forEach(deductFromPantry);
    if(applyBase && r){ r.ingredients.forEach(i=>{ const current=s.ingredients.find(x=>x.id===i.id&&x.unit===i.unit); if(current) i.quantity=round(current.quantity/s.servings,2); }); }
    userData.history.push({id:uid('history'),recipeId:s.recipeId,recipeName:s.recipeName,date:new Date().toISOString(),servings:s.servings,ingredients:s.ingredients.map(i=>({id:i.id,name:i.name,quantity:Number(i.quantity),unit:i.unit,aisle:i.aisle,packageQty:i.packageQty,estimatedPrice:i.estimatedPrice})),steps:JSON.parse(JSON.stringify(s.steps))});
    saveUser(); ui.cookSession=null; ui.modal=null; ui.page='home'; showToast('Plat enregistré et stock mis à jour'); render();
  }

  function startTimer(minutes){
    clearInterval(ui.timerInterval); ui.timer={endsAt:Date.now()+Number(minutes)*60000};
    ui.timerInterval=setInterval(()=>{
      if(!ui.timer) return;
      if(Date.now()>=ui.timer.endsAt){ clearInterval(ui.timerInterval); ui.timerInterval=null; ui.timer=null; if(navigator.vibrate) navigator.vibrate([200,100,200]); showToast('Minuteur terminé'); render(); return; }
      const timer=$('.timer-floating'); if(timer){ const sec=Math.ceil((ui.timer.endsAt-Date.now())/1000); timer.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
    },500); render();
  }

  app.addEventListener('click', e=>{
    if(e.target.closest('[data-stop-modal]')) e.stopPropagation();
    if(e.target.closest('[data-stop-menu]')) e.stopPropagation();
    const navEl=e.target.closest('[data-nav]'); if(navEl){ nav(navEl.dataset.nav); return; }
    const recipeEl=e.target.closest('[data-recipe]'); if(recipeEl){ openRecipe(recipeEl.dataset.recipe); return; }
    const modalRecipe=e.target.closest('[data-recipe-modal]'); if(modalRecipe){ openRecipe(modalRecipe.dataset.recipeModal); return; }
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='toggle-menu'){ ui.menuOpen=!ui.menuOpen; render(); return; }
    if(action==='notifications'){ ui.menuOpen=false; ui.modal={type:'notifications'}; render(); return; }
    if(action==='mark-all-notifications'){ markAllNotificationsSeen(); render(); return; }
    if(action==='close-menu'){ ui.menuOpen=false; render(); return; }
    if(action==='profile'){ nav('profile'); return; }
    if(action==='back-recipes'){ nav('recipes'); return; }
    if(action==='servings-minus'){ ui.servings=Math.max(1,ui.servings-1); render(); return; }
    if(action==='servings-plus'){ ui.servings+=1; render(); return; }
    if(action==='add-cart'){ addToCart(ui.recipeId,ui.servings); return; }
    if(action==='start-cook'){ const r=recipeById(ui.recipeId); if(r) startCook(r,ui.servings); return; }
    if(action==='import-recipe'){ ui.menuOpen=false; fileInput.click(); render(); return; }
    if(action==='what-can-eat'){ ui.modal={type:'what-can-eat'}; render(); return; }
    if(action==='close-modal'){ ui.modal=null; render(); return; }
    if(action==='clear-cart'){ userData.cart=[]; userData.purchaseOverrides={}; saveUser(); render(); return; }
    if(action==='shopping-done'){
      const items=shoppingData().filter(i=>!i.permanent&&i.buy>0); if(!items.length){ showToast('Rien à ajouter'); return; }
      ui.modal={type:'purchase-expiry',items:JSON.parse(JSON.stringify(items))}; render(); return;
    }
    if(action==='confirm-purchases'){
      const items=ui.modal.items; document.querySelectorAll('[data-expiry-index]').forEach(input=>{ items[Number(input.dataset.expiryIndex)].expiry=input.value||null; });
      items.forEach(i=>userData.pantry.lots.push({id:uid('lot'),ingredientId:i.id,name:i.name,quantity:Number(i.buy),unit:i.unit,expiry:i.expiry||null,addedAt:todayISO()}));
      userData.cart=[]; userData.purchaseOverrides={}; saveUser(); ui.modal=null; ui.page='stock'; showToast('Courses ajoutées au stock'); render(); return;
    }
    if(action==='add-stock'){ ui.modal={type:'add-stock'}; render(); return; }
    if(action==='confirm-add-stock'){
      const id=$('#stock-ing').value, q=Number($('#stock-qty').value), unit=$('#stock-unit').value, expiry=$('#stock-expiry').value||null; const info=ingredientLookup()[id];
      if(!(q>0)||!info) return; userData.pantry.lots.push({id:uid('lot'),ingredientId:id,name:info.name,quantity:q,unit,expiry,addedAt:todayISO()}); saveUser(); ui.modal=null; showToast('Ajouté au stock'); render(); return;
    }
    if(action==='manage-permanent'){ ui.modal={type:'permanent'}; render(); return; }
    if(action==='edit-base'){ ui.modal={type:'edit-base'}; render(); return; }
    if(action==='save-base'){
      const r=recipeById(ui.recipeId); document.querySelectorAll('[data-base-qty]').forEach(input=>{ r.ingredients[Number(input.dataset.baseQty)].quantity=Number(input.value); }); saveUser(); ui.modal=null; showToast('Recette de base modifiée'); render(); return;
    }
    if(action==='cook-weights'){ ui.modal={type:'cook-weights'}; render(); return; }
    if(action==='save-cook-weights'){
      document.querySelectorAll('[data-cook-qty]').forEach(input=>{ ui.cookSession.ingredients[Number(input.dataset.cookQty)].quantity=Number(input.value); }); ui.modal=null; showToast('Pesées enregistrées'); render(); return;
    }
    if(action==='exit-cook'){ if(confirm('Quitter le mode cuisine ? La préparation du jour ne sera pas enregistrée.')){ ui.cookSession=null; ui.modal=null; clearInterval(ui.timerInterval); ui.timer=null; render(); } return; }
    if(action==='cook-prev'){ ui.cookSession.stepIndex=Math.max(0,ui.cookSession.stepIndex-1); render(); return; }
    if(action==='cook-next'){ if(ui.cookSession.stepIndex<ui.cookSession.steps.length-1){ui.cookSession.stepIndex++;render();} else {ui.modal={type:'finish-cook'};render();} return; }
    if(action==='confirm-finish-cook'){ finishCook(!!$('#apply-base')?.checked); return; }
    if(action==='cancel-timer'){ clearInterval(ui.timerInterval); ui.timerInterval=null; ui.timer=null; render(); return; }

    const note=e.target.closest('[data-notification-id]'); if(note){ markNotificationSeen(note.dataset.notificationId); ui.modal=null; nav(note.dataset.notificationPage); return; }
    const timer=e.target.closest('[data-timer-minutes]'); if(timer){ startTimer(Number(timer.dataset.timerMinutes)); return; }
    const remove=e.target.closest('[data-remove-cart]'); if(remove){ userData.cart.splice(Number(remove.dataset.removeCart),1); saveUser(); render(); return; }
    const toggle=e.target.closest('[data-toggle-stock]'); if(toggle){ const id=toggle.dataset.toggleStock; ui.stockExpanded[id]=!ui.stockExpanded[id]; render(); return; }
    const del=e.target.closest('[data-delete-lot]'); if(del){ userData.pantry.lots=userData.pantry.lots.filter(l=>l.id!==del.dataset.deleteLot); saveUser(); render(); return; }
    const redo=e.target.closest('[data-redo-history]'); if(redo){ const h=userData.history.find(x=>x.id===redo.dataset.redoHistory); const r=h&&recipeById(h.recipeId); if(r){ startCook(r,h.servings,h.ingredients); } return; }
  });

  app.addEventListener('input',e=>{
    if(e.target.id==='recipe-search'){ ui.search=e.target.value; render(); return; }
    if(e.target.matches('[data-purchase-key]')){ userData.purchaseOverrides[e.target.dataset.purchaseKey]=Math.max(0,Number(e.target.value)||0); saveUser(); return; }
    if(e.target.matches('[data-permanent-id]')){
      const id=e.target.dataset.permanentId; const set=permanentSet(); if(e.target.checked) set.add(id); else set.delete(id); userData.pantry.permanent=[...set]; saveUser(); return;
    }
  });

  fileInput.addEventListener('change',()=>{ if(fileInput.files?.[0]) importRecipeFile(fileInput.files[0]); });
  if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});

  render();
  syncFromServer();
})();
