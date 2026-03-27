import { useState, useRef, useEffect, useCallback } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  cream:"#FDF8F2", peach:"#F9A87A", rose:"#F4707A",
  teal:"#4BBFAD", sky:"#7EC8E3", lavender:"#B8A9E3",
  gold:"#F6C85F", dark:"#2D2A3E", mid:"#5C5880",
  soft:"#A09DC0", border:"#EDE8E0", cardBg:"#FFFFFF",
};
const font  = "'Segoe UI', system-ui, sans-serif";
const serif = "'Playfair Display', Georgia, serif";
const MODEL = "claude-sonnet-4-20250514";

const STRIPE_PRICES = {
  family_monthly:       "price_1TCPTO8iP7CLHxH9huST68Ho",
  professional_monthly: "price_1TCPU88iP7CLHxH95DOnytak",
  district_monthly:     "price_1TCPUT8iP7CLHxH9plA1BZWE",
  family_annual:        "price_1TFQ5t8iP7CLHxH9E7dzPVWl",
  professional_annual:  "price_1TFQ8C8iP7CLHxH9epZLRSv5",
  district_annual:      "price_1TFQ8d8iP7CLHxH9aUJvpUF3",
};

async function startCheckout(priceId) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert("Could not start checkout. Please try again.");
  } catch(e) {
    alert("Checkout error: " + e.message);
  }
} // Verified working model for artifact API calls

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  en: {
    tagline:"Every child on the spectrum deserves a champion.",
    start:"Start a Conversation", analyzeIEP:"Analyze My IEP",
    chat:"Advocate Chat", iep:"IEP Analyzer", resources:"Find Resources",
    blog:"Learning Hub", pricing:"Pricing", dashboard:"Dashboard",
    about:"About", admin:"Admin", partner:"Partner", press:"Press",
    getStarted:"Get Started Free", signIn:"Sign In", signOut:"Sign Out",
    home:"Home", 
    heroSub:"SpectraGuide is your AI-powered autism advocate — helping families, educators, and individuals navigate IEPs, find resources, and understand their rights.",
    joinFree:"Join Free — It's Free", waitlistTitle:"Stay updated on new features & advocacy tips",
    waitlistSub:"Get notified about new features, resources, and advocacy tips.",
    yourEmail:"your@email.com", poweredBy:"Powered by",
  },
  es: {
    tagline:"Cada niño en el espectro merece un campeón.",
    start:"Comenzar una Conversación", analyzeIEP:"Analizar Mi IEP",
    chat:"Chat de Abogacía", iep:"Analizador IEP", resources:"Encontrar Recursos",
    blog:"Centro de Aprendizaje", pricing:"Precios", dashboard:"Panel",
    about:"Nosotros", admin:"Admin", partner:"Asociado", press:"Prensa",
    getStarted:"Comenzar Gratis", signIn:"Iniciar Sesión", signOut:"Cerrar Sesión",
    iepTitle:"Entiende el plan de tu hijo",
    iepSub:"Obtén un análisis en lenguaje simple con fortalezas, brechas, señales de alerta y tus derechos.",
    iepPlaceholder:"Pega el texto del IEP o BIP de tu hijo aquí...",
    analyzeBtn:"Analizar Documento",
    trySample:"Probar IEP de Muestra",
    analyzing:"Leyendo tu documento...",
    analysisFailed:"Análisis fallido. Por favor intenta de nuevo.",
    resourceTitle:"Encuentra apoyo cerca de ti",
    resourceSub:"Base de datos verificada de proveedores de terapia de autismo, abogados de IEP y organizaciones de apoyo.",
    blogTitle:"El conocimiento es tu mejor herramienta",
    blogSub:"Artículos expertos sobre ciencia del autismo, leyes de educación especial y estrategias familiares.",
    readMore:"Leer →",
    upgradeTitle:"Has usado tus 10 mensajes gratis de hoy",
    upgradeSub:"Actualiza al Plan Familiar para chat ilimitado y análisis de IEP.",
    upgradeBtn:"Actualizar al Plan Familiar — $19/mes →",
    limitIEP:"Has usado tus 2 análisis de IEP gratis este mes",
    limitIEPSub:"Actualiza al Plan Familiar para análisis ilimitados.",
    home:"Inicio", 
    heroSub:"SpectraGuide es tu defensor de autismo con IA — ayudando a familias, educadores e individuos a navegar los IEPs, encontrar recursos y comprender sus derechos.",
    joinFree:"Únete Gratis", waitlistTitle:"Únete a nuestra comunidad — acceso temprano gratuito",
    waitlistSub:"Recibe notificaciones sobre nuevas funciones, recursos y consejos de defensa.",
    yourEmail:"tu@correo.com", poweredBy:"Impulsado por",
  }
};

// ─── HOOKS & UTILS ────────────────────────────────────────────────────────────
function useLocalStore(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const save = (v) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, save];
}

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

async function claudeChat(systemPrompt, userMessage, history = [], maxTokens = 1000) {
  try {
    const body = {
      model: MODEL,
      max_tokens: maxTokens,
      messages: [...history, { role: "user", content: userMessage }],
    };
    // Only include system if non-empty — avoids "invalid format" errors
    if (systemPrompt && systemPrompt.trim()) {
      body.system = systemPrompt.trim();
    }
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.error) {
      const msg = d.error.message || JSON.stringify(d.error);
      console.error("API error:", msg);
      return "__ERR__:" + msg;
    }
    return (d.content || []).map(b => b.text || "").join("") || "";
  } catch (e) {
    console.error("claudeChat exception:", e);
    return "__ERR__:" + (e?.message || "network error");
  }
}

async function claudeJSONsafe(system, user, maxTokens = 2000) {
  const raw = await claudeChat(system, user, [], maxTokens);
  if (!raw || raw.startsWith("__ERR__")) throw new Error(raw || "No response");
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("No JSON found");
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch(e) { throw new Error("JSON parse failed: " + e.message); }
}

function exportIEPReport(analysis) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>SpectraGuide IEP Analysis — ${analysis.studentName || "Student"}</title>
  <style>
    body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#2D2A3E;line-height:1.7}
    h1{color:#4BBFAD;font-size:28px;border-bottom:3px solid #4BBFAD;padding-bottom:12px}
    h2{color:#2D2A3E;font-size:18px;margin-top:28px;margin-bottom:8px}
    .score{display:inline-block;background:#4BBFAD;color:white;font-size:32px;font-weight:900;
      width:70px;height:70px;border-radius:50%;text-align:center;line-height:70px;margin-right:16px}
    .tag{display:inline-block;background:#4BBFAD22;color:#4BBFAD;border:1px solid #4BBFAD44;
      border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;margin:2px}
    .red{color:#F4707A;font-weight:700} .gold{color:#F9A87A;font-weight:700}
    .item{margin:6px 0;padding-left:16px} .section{margin-bottom:24px}
    .footer{margin-top:48px;padding-top:16px;border-top:1px solid #EDE8E0;font-size:12px;color:#A09DC0}
    @media print{body{margin:20px}}
  </style></head><body>
  <h1>🧩 SpectraGuide IEP Analysis Report</h1>
  <p><strong>Student:</strong> ${analysis.studentName||"N/A"} &nbsp;|&nbsp;
     <strong>Type:</strong> ${analysis.documentType||"IEP"} &nbsp;|&nbsp;
     <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  <div><span class="score">${analysis.overallScore}/10</span>
  <span style="font-size:15px;color:#5C5880">${analysis.scoreRationale||""}</span></div>
  <div class="section"><h2>Summary</h2><p>${analysis.summary||""}</p></div>
  <div class="section"><h2>✅ Strengths</h2>${(analysis.strengths||[]).map(s=>`<div class="item">• ${s}</div>`).join("")}</div>
  <div class="section"><h2>⚠️ Gaps to Address</h2>${(analysis.gaps||[]).map(g=>`<div class="item">• ${g}</div>`).join("")}</div>
  ${analysis.redFlags?.length?`<div class="section"><h2 class="red">🚨 Red Flags</h2>${analysis.redFlags.map(f=>`<div class="item red">• ${f}</div>`).join("")}</div>`:""}
  ${analysis.legalConcerns?.length?`<div class="section"><h2 class="gold">⚖️ Legal Concerns</h2>${analysis.legalConcerns.map(l=>`<div class="item">§ ${l}</div>`).join("")}</div>`:""}
  <div class="section"><h2>🎯 Goal Analysis</h2>${(analysis.goalAnalysis||[]).map((g,i)=>`<div class="item">${i+1}. ${g}</div>`).join("")}</div>
  <div class="section"><h2>🛡️ Your Rights</h2>${(analysis.parentRights||[]).map(r=>`<div class="item">• ${r}</div>`).join("")}</div>
  <div class="section"><h2>💡 Recommendations</h2>${(analysis.recommendations||[]).map(r=>`<div class="item">• ${r}</div>`).join("")}</div>
  <div class="section"><h2>❓ Questions to Ask Your School</h2>${(analysis.questionsToAsk||[]).map(q=>`<div class="item">? ${q}</div>`).join("")}</div>
  <div class="section"><h2>🗺️ Next Steps</h2>${(analysis.nextSteps||[]).map((s,i)=>`<div class="item">${i+1}. ${s}</div>`).join("")}</div>
  <div class="footer">Generated by SpectraGuide · spectraguide.com · Not a substitute for legal advice · ${new Date().toLocaleDateString()}</div>
  </body></html>`;
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const GradText = ({ children, a=C.teal, b=C.lavender }) => (
  <span style={{ background:`linear-gradient(135deg,${a},${b})`,
    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>{children}</span>
);
const Pill = ({ children, color=C.teal }) => (
  <span style={{ display:"inline-block", padding:"4px 14px", borderRadius:999, fontSize:11,
    fontWeight:700, letterSpacing:"0.08em", background:`${color}1A`, color,
    border:`1.5px solid ${color}44`, textTransform:"uppercase" }}>{children}</span>
);
const Btn = ({ children, onClick, variant="primary", size="md", style:s={}, disabled }) => {
  const sz = { sm:{padding:"8px 16px",fontSize:13}, md:{padding:"12px 24px",fontSize:14}, lg:{padding:"16px 36px",fontSize:16} };
  const vr = {
    primary:{ background:`linear-gradient(135deg,${C.teal},${C.sky})`, color:"white", border:"none", boxShadow:`0 6px 20px ${C.teal}44` },
    secondary:{ background:"white", color:C.dark, border:`2px solid ${C.border}` },
    ghost:{ background:"transparent", color:C.teal, border:`1.5px solid ${C.teal}44` },
    danger:{ background:`linear-gradient(135deg,${C.rose},${C.peach})`, color:"white", border:"none" },
    gold:{ background:`linear-gradient(135deg,${C.gold},${C.peach})`, color:"white", border:"none", boxShadow:`0 6px 20px ${C.gold}44` },
    dark:{ background:`linear-gradient(135deg,${C.dark},#3D3860)`, color:"white", border:"none" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...sz[size], ...vr[variant], borderRadius:12, fontFamily:font, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, transition:"all 0.2s", ...s }}>{children}</button>;
};
function Card({ children, style={}, glow, onClick }) {
  return <div onClick={onClick} style={{ background:C.cardBg, borderRadius:20, padding:28,
    boxShadow:glow?`0 8px 40px ${C.teal}22,0 2px 12px rgba(0,0,0,0.06)`:"0 2px 16px rgba(0,0,0,0.06)",
    border:`1px solid ${C.border}`, cursor:onClick?"pointer":"default", ...style }}>{children}</div>;
}
const Tag = ({ c=C.teal, children }) => (
  <span style={{ background:`${c}18`, color:c, border:`1px solid ${c}33`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{children}</span>
);
const Input = ({ value, onChange, placeholder, type="text", style:s={} }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} type={type}
    style={{ border:`1.5px solid ${C.border}`, borderRadius:10, padding:"11px 15px",
      fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none", ...s }} />
);

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV_MAIN = ["Home","Chat","IEP","Resources","Blog","Pricing"];
function Nav({ active, setActive, user, setUser, lang, setLang, t }) {
  const w = useWindowWidth();
  const mobile = w < 768;
  const [mOpen, setMOpen] = useState(false);
  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:200,
      background:"rgba(253,248,242,0.96)", backdropFilter:"blur(20px)",
      borderBottom:`1px solid ${C.border}`, height:64,
      display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={() => setActive("Home")}>
        <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧩</div>
        <span style={{ fontFamily:serif, fontSize:19, fontWeight:900, color:C.dark, letterSpacing:"-0.02em" }}>Spectra<span style={{ color:C.teal }}>Guide</span></span>
      </div>
      {!mobile && (
        <div style={{ display:"flex", gap:2 }}>
          {NAV_MAIN.map(n => (
            <button key={n} onClick={() => setActive(n)} style={{ background:active===n?`${C.teal}15`:"transparent", border:active===n?`1.5px solid ${C.teal}44`:"1.5px solid transparent", borderRadius:9, padding:"7px 11px", fontSize:13, fontWeight:active===n?700:500, color:active===n?C.teal:C.mid, cursor:"pointer", fontFamily:font, transition:"all 0.18s" }}>{t[n.toLowerCase()]||n}</button>
          ))}
        </div>
      )}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button onClick={() => setLang(lang==="en"?"es":"en")} style={{ background:"none", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontSize:12, fontWeight:700, color:C.mid, cursor:"pointer", fontFamily:font }}>{lang==="en"?"🌐 ES":"🌐 EN"}</button>
        {user ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={() => setActive("Dashboard")} style={{ display:"flex", alignItems:"center", gap:7, background:`${C.teal}12`, border:`1.5px solid ${C.teal}33`, borderRadius:10, padding:"5px 12px", cursor:"pointer", fontFamily:font }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"white", fontWeight:700 }}>{user.name?.[0]?.toUpperCase()}</div>
              {!mobile && <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{user.name}</span>}
            </button>
            {user.isAdmin && <Btn size="sm" variant="dark" onClick={() => setActive("Admin")}>⚙️ Admin</Btn>}
            {(user.plan === "Family" || user.plan === "Professional" || user.plan === "District" || user.plan === "family" || user.plan === "professional" || user.plan === "district") && (
              <span style={{ background:`linear-gradient(135deg,${C.gold},${C.peach})`, color:"white", fontSize:9, fontWeight:800, padding:"3px 10px", borderRadius:999, letterSpacing:"0.05em" }}>⭐ PRO</span>
            )}
            <Btn variant="ghost" size="sm" onClick={() => setUser(null)}>{t.signOut}</Btn>
          </div>
        ) : (
          <>
            {!mobile && <Btn variant="ghost" size="sm" onClick={() => setActive("Dashboard")}>{t.signIn}</Btn>}
            <Btn size="sm" onClick={() => setActive("Pricing")}>{t.getStarted}</Btn>
          </>
        )}
        {mobile && <button onClick={() => setMOpen(!mOpen)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.dark }}>☰</button>}
      </div>
      {mobile && mOpen && (
        <div style={{ position:"absolute", top:64, left:0, right:0, background:"white", borderBottom:`1px solid ${C.border}`, padding:"12px 0", boxShadow:"0 8px 24px rgba(0,0,0,0.1)" }}>
          {NAV_MAIN.map(n => (
            <button key={n} onClick={() => { setActive(n); setMOpen(false); }} style={{ display:"block", width:"100%", textAlign:"left", background:"none", border:"none", padding:"12px 24px", fontSize:15, fontWeight:active===n?700:400, color:active===n?C.teal:C.dark, cursor:"pointer", fontFamily:font }}>{t[n.toLowerCase()]||n}</button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomePage({ setActive, waitlist, setWaitlist, t }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const w = useWindowWidth();
  const mobile = w < 768;

  async function joinWaitlist() {
    if (!email.includes("@")) return;
    setWaitlist([...waitlist, { email, date:new Date().toLocaleDateString() }]);
    setSubmitted(true);
    // Send welcome email
    try {
      await fetch("/api/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
    } catch(e) { console.error("Welcome email error:", e); }
  }

  const features = [
    { icon:"💬", label:"AI Advocate Chat", desc:"24/7 expert answers on autism, IEPs, rights, and therapies.", color:C.teal, tab:"Chat" },
    { icon:"📋", label:"IEP & BIP Analyzer", desc:"Upload or paste. Get scored analysis, red flags, rights & next steps.", color:C.lavender, tab:"IEP" },
    { icon:"🌍", label:"Resource Finder", desc:"Local & global therapy, support groups, and legal advocates.", color:C.peach, tab:"Resources" },
    { icon:"📖", label:"Learning Hub", desc:"Expert articles on autism science, advocacy, law, and family strategies.", color:C.sky, tab:"Blog" },
    { icon:"🛡️", label:"Know Your Rights", desc:"IDEA, FAPE, LRE, Section 504 — decoded into plain language.", color:C.rose, tab:"Chat" },
    { icon:"👤", label:"Personal Dashboard", desc:"Save chats, analyses, resources, and notes in one place.", color:C.gold, tab:"Dashboard" },
  ];

  const stats = [{ v:"Free",l:"Always Free to Start" },{ v:"24/7",l:"AI Advocate Access" },{ v:"50+",l:"States with Resources" },{ v:"100%",l:"Family Focused" }];

  const testimonials = [
    { q:"SpectraGuide helped me understand my son's IEP in ways his school never explained. I walked in empowered.", n:"Maria T.", r:"Mom of a 7-year-old", a:"👩" },
    { q:"As a special ed teacher, this helps me communicate plans to families in plain language.", n:"James R.", r:"Special Ed Teacher", a:"👨‍🏫" },
    { q:"I'm autistic and found workplace accommodations I never knew I was entitled to.", n:"Alex K.", r:"Autistic Adult", a:"🧑" },
  ];

  return (
    <div style={{ paddingTop:64 }}>
      {/* HERO */}
      <section style={{ minHeight:"92vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:mobile?"80px 20px 60px":"80px 32px 60px", background:`radial-gradient(ellipse at 20% 50%,${C.teal}12 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,${C.lavender}18 0%,transparent 55%),${C.cream}`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:130, left:"6%", width:90, height:90, borderRadius:"50%", background:`${C.gold}22`, filter:"blur(4px)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:220, right:"8%", width:65, height:65, borderRadius:"50%", background:`${C.rose}20`, filter:"blur(3px)", pointerEvents:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:24 }}>
          {["🧩 Autism Advocacy","📋 IEP Analysis","🌍 Global Resources","💬 AI-Powered"].map(b => (
            <span key={b} style={{ background:"white", borderRadius:999, padding:"5px 14px", fontSize:12, fontWeight:600, color:C.mid, boxShadow:"0 2px 10px rgba(0,0,0,0.07)", border:`1.5px solid ${C.border}` }}>{b}</span>
          ))}
        </div>
        <h1 style={{ fontFamily:serif, fontSize:mobile?"36px":"clamp(36px,5.5vw,68px)", fontWeight:900, color:C.dark, lineHeight:1.13, margin:"0 0 20px", maxWidth:820, letterSpacing:"-0.03em" }}>
          {t.tagline.split(" ").slice(0,-2).join(" ")}<br />
          <GradText a={C.teal} b={C.lavender}>{t.tagline.split(" ").slice(-2).join(" ")}</GradText>
        </h1>
        <p style={{ fontSize:mobile?16:19, color:C.mid, maxWidth:560, lineHeight:1.75, margin:"0 0 32px" }}>{t.heroSub}</p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", marginBottom:44 }}>
          <Btn size="lg" onClick={() => setActive("Chat")}>💬 {t.start}</Btn>
          <Btn size="lg" variant="secondary" onClick={() => setActive("IEP")}>📋 {t.analyzeIEP}</Btn>
        </div>
        {/* Email capture */}
        <div style={{ background:"white", borderRadius:18, padding:"22px 26px", boxShadow:"0 8px 40px rgba(0,0,0,0.09)", maxWidth:460, width:"100%", border:`1px solid ${C.border}` }}>
          {submitted ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:30, marginBottom:8 }}>🎉</div>
              <div style={{ fontWeight:800, fontSize:16, color:C.dark }}>You're on the list!</div>
              <div style={{ color:C.mid, fontSize:13, marginTop:6 }}>We'll keep you updated on new features and advocacy tips. 💙</div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:4 }}>{t.waitlistTitle}</div>
              <div style={{ color:C.soft, fontSize:12, marginBottom:14 }}>{t.waitlistSub}</div>
              <div style={{ display:"flex", gap:9 }}>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.yourEmail} type="email" style={{ flex:1 }} />
                <Btn onClick={joinWaitlist} disabled={!email.includes("@")}>{t.joinFree}</Btn>
              </div>
            </>
          )}
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding:"40px 32px", background:`linear-gradient(135deg,${C.dark},#3D3860)`, display:"flex", justifyContent:"center", gap:mobile?32:64, flexWrap:"wrap" }}>
        {stats.map(s => (
          <div key={s.v} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:serif, fontSize:36, fontWeight:900, color:"white", lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:5 }}>{s.l}</div>
          </div>
        ))}
      </section>

      {/* FEATURES */}
      <section style={{ padding:"72px 24px", maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <Pill>FEATURES</Pill>
          <h2 style={{ fontFamily:serif, fontSize:mobile?28:36, fontWeight:800, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>Everything in one place</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(290px,1fr))", gap:20 }}>
          {features.map(f => (
            <Card key={f.label} onClick={() => setActive(f.tab)}>
              <div style={{ width:48, height:48, borderRadius:13, background:`${f.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:14 }}>{f.icon}</div>
              <h3 style={{ fontSize:16, fontWeight:800, color:C.dark, margin:"0 0 7px" }}>{f.label}</h3>
              <p style={{ fontSize:13.5, color:C.mid, lineHeight:1.65, margin:"0 0 14px" }}>{f.desc}</p>
              <button onClick={e => { e.stopPropagation(); setActive(f.tab); }} style={{ background:"none", border:`1.5px solid ${f.color}55`, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, color:f.color, cursor:"pointer", fontFamily:font }}>Explore →</button>
            </Card>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding:"64px 24px", background:`${C.teal}07` }}>
        <div style={{ maxWidth:1050, margin:"0 auto", textAlign:"center" }}>
          <Pill color={C.lavender}>COMMUNITY</Pill>
          <h2 style={{ fontFamily:serif, fontSize:mobile?26:32, fontWeight:800, color:C.dark, margin:"14px 0 36px", letterSpacing:"-0.02em" }}>Voices from our community</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)", gap:20 }}>
            {testimonials.map(t => (
              <Card key={t.n}>
                <div style={{ fontSize:26, color:C.teal, marginBottom:12 }}>"</div>
                <p style={{ fontSize:14, color:C.mid, lineHeight:1.72, fontStyle:"italic", margin:"0 0 18px" }}>{t.q}</p>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.teal}22,${C.lavender}22)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{t.a}</div>
                  <div><div style={{ fontWeight:700, fontSize:13, color:C.dark }}>{t.n}</div><div style={{ fontSize:11, color:C.soft }}>{t.r}</div></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"72px 24px", textAlign:"center", background:`linear-gradient(135deg,${C.dark},#3D3860)` }}>
        <h2 style={{ fontFamily:serif, fontSize:mobile?32:42, fontWeight:900, color:"white", margin:"0 0 14px", letterSpacing:"-0.02em" }}>
          Your journey starts <GradText a={C.teal} b={C.gold}>here.</GradText>
        </h2>
        <p style={{ color:"rgba(255,255,255,0.6)", fontSize:16, maxWidth:400, margin:"0 auto 32px" }}>Join thousands of families who've found their voice.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <Btn size="lg" variant="gold" onClick={() => setActive("Pricing")}>See Plans 💎</Btn>
        </div>
      </section>
    </div>
  );
}

// ─── ADVOCATE CHAT ────────────────────────────────────────────────────────────
function AdvocateChat({ user, chatHistory, setChatHistory, lang }) {
  const [messages, setMessages] = useState(chatHistory.length ? chatHistory : [{ role:"assistant", content:lang==="es"?"¡Hola! Soy tu Defensor de SpectraGuide 💙 Estoy aquí para ayudarte con preguntas sobre autismo, IEPs, derechos, terapias y estrategias diarias. ¿Qué tienes en mente?":"Hi! I'm your SpectraGuide Advocate 💙 Powered by AI — Anthropic's most advanced model — so I can handle complex legal questions, nuanced IEP situations, and detailed therapy discussions.\n\nWhat's on your mind today?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState("");
  const bottomRef = useRef();
  const w = useWindowWidth();
  const mobile = w < 768;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => {
    if (!loading) { setThinking(""); return; }
    const phrases = lang==="es"
      ? ["Pensando profundamente…","Revisando la ley de educación especial…","Elaborando una respuesta…"]
      : ["Thinking deeply…","Reviewing special ed law…","Consulting advocacy options…","Crafting a thoughtful response…"];
    let i=0;
    const t = setInterval(() => { setThinking(phrases[i%phrases.length]); i++; }, 2200);
    return () => clearInterval(t);
  }, [loading, lang]);

  const QUICK_EN = ["What are my rights in an IEP meeting?","Explain ABA therapy simply","What is FAPE?","How do I request an evaluation?","Sensory regulation strategies","Transition planning for teens","What is a 504 plan?","How do I dispute an IEP decision?"];
  const QUICK_ES = ["¿Cuáles son mis derechos en una reunión IEP?","Explica la terapia ABA","¿Qué es FAPE?","¿Cómo solicito una evaluación?","Estrategias de regulación sensorial","Planificación de transición para adolescentes"];

  const SYSTEM_EN = `You are SpectraGuide, a warm, deeply compassionate, and highly expert autism advocate AI powered by AI. You help parents, educators, autistic individuals, and clinicians with:
- Special education law: IDEA, FAPE, LRE, Section 504, ADA, procedural safeguards, due process, IEE
- IEP & BIP guidance: SMART goals, PLAAFP, services review, ESY, transition planning
- Autism science & therapies: ABA, speech, OT, DIR/Floortime, ESDM, AAC, sensory processing
- Daily life & family support: self-advocacy, adult services, SSI/SSDI, disclosure decisions
Always acknowledge emotions first. Explain jargon. Use structure for clarity. End with encouragement or a follow-up question. Never diagnose or provide medical prescriptions.`;

  const SYSTEM_ES = `Eres SpectraGuide, un defensor de autismo con IA cálido, compasivo y altamente experto. Ayudas a padres, educadores, individuos autistas y médicos en español con:
- Ley de educación especial: IDEA, FAPE, LRE, Sección 504, ADA, proceso de audiencia
- Guía IEP y BIP: metas SMART, servicios, planificación de transición
- Ciencia del autismo y terapias: ABA, habla, TO, procesamiento sensorial, CAA
- Apoyo familiar: autodefensa, servicios para adultos, divulgación
Siempre reconoce las emociones primero. Explica el vocabulario técnico. Usa estructura para mayor claridad. Nunca diagnostiques.`;

  async function send(text) {
    const msg = text || input.trim(); if (!msg) return;
    // Free plan: 10 messages per day
    const isPaid = user && (user.plan === "Family" || user.plan === "Professional" || user.plan === "District" || user.plan === "family" || user.plan === "professional" || user.plan === "district");
    if (!isPaid) {
      const today = new Date().toDateString();
      const key = `sg_chat_${user?.email || "guest"}_${today}`;
      const count = parseInt(localStorage.getItem(key) || "0");
      if (count >= 10) {
        setMessages(m => [...m, { role:"assistant", content:lang==="es" ? "💙 Has usado tus 10 mensajes gratis de hoy.\n\nActualiza al Plan Familiar para chat ilimitado y análisis de IEP sin límite." : "💙 You've used your 10 free messages for today.\n\nUpgrade to the **Family Plan** for unlimited AI advocacy chat, unlimited IEP analyses, and priority support.\n\n[Upgrade Now →](/pricing)" }]);
        return;
      }
      localStorage.setItem(key, (count + 1).toString());
    }
    setInput("");
    const newMsgs = [...messages, { role:"user", content:msg }];
    setMessages(newMsgs); setLoading(true);
    try {
      const history = newMsgs.slice(1);
      const reply = await claudeChat(lang==="es"?SYSTEM_ES:SYSTEM_EN, msg, history.slice(0,-1), 1800);
      const updated = [...newMsgs, { role:"assistant", content:reply }];
      setMessages(updated);
      if (user) setChatHistory(updated);
    } catch { setMessages(m => [...m, { role:"assistant", content:"Sorry, something went wrong. Please try again 💙" }]); }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop:64, height:"100vh", display:"flex", flexDirection:"column", background:C.cream }}>
      <div style={{ padding:"12px 20px", background:"white", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>🤝</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ fontWeight:800, fontSize:15, color:C.dark }}>SpectraGuide Advocate</div>
              <span style={{ background:`linear-gradient(135deg,${C.lavender},${C.teal})`, color:"white", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:999 }}>OPUS</span>
              {lang==="es" && <span style={{ background:`${C.gold}22`, color:C.peach, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:999, border:`1px solid ${C.gold}44` }}>ES</span>}
            </div>
            <div style={{ fontSize:11, color:C.teal, fontWeight:600 }}>● Online</div>
          </div>
        </div>
        {user && <Btn variant="ghost" size="sm" onClick={() => { const r=[{role:"assistant",content:"Hi! I'm ready to help 💙"}]; setMessages(r); setChatHistory([]); }}>Clear</Btn>}
      </div>
      <div style={{ padding:"8px 18px", background:"white", borderBottom:`1px solid ${C.border}88`, display:"flex", gap:6, flexWrap:"wrap" }}>
        {(lang==="es"?QUICK_ES:QUICK_EN).map(q => (
          <button key={q} onClick={() => send(q)} style={{ background:`${C.teal}10`, border:`1.5px solid ${C.teal}2A`, borderRadius:999, padding:"4px 11px", fontSize:11, fontWeight:600, color:C.teal, cursor:"pointer", fontFamily:font }}>{q}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:12 }}>
        {messages.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant" && <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:8, flexShrink:0, marginTop:4 }}>🧩</div>}
            <div style={{ maxWidth:mobile?"85%":"68%", padding:"12px 16px", borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:m.role==="user"?`linear-gradient(135deg,${C.teal},${C.sky})`:"white", color:m.role==="user"?"white":C.dark, fontSize:14, lineHeight:1.72, boxShadow:"0 2px 8px rgba(0,0,0,0.06)", whiteSpace:"pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🧩</div>
            <div style={{ background:"white", borderRadius:"16px 16px 16px 4px", padding:"12px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:8 }}>
              {[0,1,2].map(d => <div key={d} style={{ width:6, height:6, borderRadius:"50%", background:C.teal, animation:`bounce 1.2s ${d*0.2}s infinite` }} />)}
              <span style={{ fontSize:11, color:C.soft, fontStyle:"italic" }}>{thinking}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"12px 18px", background:"white", borderTop:`1px solid ${C.border}`, display:"flex", gap:9 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&send()} placeholder={lang==="es"?"Pregunta sobre IEPs, derechos, recursos, terapias...":"Ask about IEPs, autism rights, resources, therapies..."} style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:11, padding:"11px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none" }} />
        <Btn onClick={() => send()} disabled={loading||!input.trim()}>Send →</Btn>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}`}</style>
    </div>
  );
}

// ─── IEP ANALYZER ─────────────────────────────────────────────────────────────
function IEPAnalyzer({ user, iepHistory, setIepHistory, lang, t }) {
  const [docText, setDocText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("analyze");
  const w = useWindowWidth(); const mobile = w<768;

  const SAMPLE_EN = `Student: Jordan M., Age 9\nDisability: Autism Spectrum Disorder\nPresent Levels: Jordan reads at 2nd grade level. Difficulty with transitions and peer interactions. Strengths in math and visual reasoning.\nAnnual Goals:\n1) Jordan will improve reading fluency from 45 to 80 wpm.\n2) Jordan will reduce transition-related meltdowns from 5/day to 1/day.\n3) Jordan will initiate peer interactions 2x per 30-min recess.\nServices: 30 min speech therapy weekly. Resource room 45 min daily. OT consult monthly.\nAccommodations: Extended time, preferential seating, visual schedules.\nParent concerns: Homework load, peer friendships, transition to 4th grade.`;
  const SAMPLE_ES = `Estudiante: Jordán M., 9 años\nDiscapacidad: Trastorno del Espectro Autista\nNiveles Actuales: Jordán lee al nivel de 2do grado. Dificultad con transiciones e interacciones con compañeros. Fortalezas en matemáticas y razonamiento visual.\nMetas Anuales:\n1) Jordán mejorará la fluidez lectora de 45 a 80 palabras por minuto.\n2) Jordán reducirá las crisis relacionadas con transiciones de 5/día a 1/día.\n3) Jordán iniciará interacciones con compañeros 2 veces por recreo de 30 min.\nServicios: 30 min de terapia del habla semanal. Aula de recursos 45 min diarios. Consulta de TO mensual.\nAdaptaciones: Tiempo extendido, asiento preferencial, horarios visuales.\nPreocupaciones de los padres: Carga de tarea, amistades, transición a 4to grado.`;
  const SAMPLE = lang === "es" ? SAMPLE_ES : SAMPLE_EN;

  async function analyze() {
    if (!docText.trim()) return;
    // Free plan: 2 IEP analyses per month
    const isPaidUser = user && (user.plan === "Family" || user.plan === "Professional" || user.plan === "District" || user.plan === "family" || user.plan === "professional" || user.plan === "district");
    if (!isPaidUser) {
      const month = new Date().toISOString().slice(0, 7);
      const key = `sg_iep_${user?.email || "guest"}_${month}`;
      const count = parseInt(localStorage.getItem(key) || "0");
      if (count >= 2) {
        setAnalysis({ limitReached: true });
        return;
      }
      localStorage.setItem(key, (count + 1).toString());
    }
    setLoading(true); setAnalysis(null);
    try {
      const result = await claudeJSONsafe(`You are SpectraGuide's expert IEP/BIP Analyzer powered by AI with deep knowledge of IDEA, FAPE, LRE, Section 504. Return a single JSON object (not an array):
{"documentType":"IEP or BIP","studentName":"name or null","studentAge":"age/grade or null","disability":"disability category or null","overallScore":1-10,"scoreRationale":"1-2 sentences","summary":"3-4 sentence plain-language summary","strengths":["..."],"gaps":["specific gap with why it matters"],"redFlags":["serious concern with IDEA citation if applicable"],"goalAnalysis":["assessment of each goal"],"servicesReview":["assessment of each service"],"parentRights":["specific right with explanation"],"recommendations":["specific actionable recommendation"],"questionsToAsk":["pointed question for school team"],"nextSteps":["prioritized action step"],"legalConcerns":["potential IDEA/FAPE/LRE violation or null array"]}`, `Analyze this document:\n\n${docText}`, 2500);
      setAnalysis(result);
      if (user) setIepHistory(h => [{ date:new Date().toLocaleDateString(), text:docText.slice(0,80)+"...", result }, ...h.slice(0,9)]);
    } catch(err) {
      console.error("IEP analysis error:", err);
      setAnalysis({ error:true });
    }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Pill color={C.lavender}>IEP & BIP ANALYZER</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:34, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>{t?.iepTitle || "Understand your child's plan"}</h1>
          <p style={{ color:C.mid, fontSize:15, maxWidth:500, margin:"0 auto" }}>{t?.iepSub || "Get a plain-language breakdown with strengths, gaps, red flags, and your rights."}</p>
        </div>

        {user && iepHistory.length>0 && (
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            <Btn variant={tab==="analyze"?"primary":"ghost"} size="sm" onClick={() => setTab("analyze")}>📋 New Analysis</Btn>
            <Btn variant={tab==="history"?"primary":"ghost"} size="sm" onClick={() => setTab("history")}>🕐 History ({iepHistory.length})</Btn>
          </div>
        )}

        {tab==="history" && (
          <div style={{ marginBottom:24 }}>
            {iepHistory.map((h,i) => (
              <Card key={i} style={{ cursor:"pointer", marginBottom:12 }} onClick={() => { setAnalysis(h.result); setTab("analyze"); }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:C.dark }}>{h.result?.documentType} — Score {h.result?.overallScore}/10</div>
                    <div style={{ fontSize:12, color:C.soft, marginTop:3 }}>{h.text}</div>
                  </div>
                  <div style={{ fontSize:12, color:C.soft }}>{h.date}</div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card style={{ marginBottom:20 }}>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <Btn variant="ghost" size="sm" onClick={() => setDocText(SAMPLE)}>{lang==="es" ? "✨ Probar IEP de Muestra" : "✨ Try Sample IEP"}</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDocText("")}>{lang==="es" ? "🗑️ Limpiar" : "🗑️ Clear"}</Btn>
          </div>
          <textarea value={docText} onChange={e => setDocText(e.target.value)} placeholder="Paste your IEP or BIP text here... Include goals, services, present levels, accommodations, and parent concerns." style={{ width:"100%", minHeight:200, border:`1.5px solid ${C.border}`, borderRadius:12, padding:"13px 15px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none", resize:"vertical", lineHeight:1.65, boxSizing:"border-box" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, flexWrap:"wrap", gap:10 }}>
            <span style={{ fontSize:12, color:C.soft }}>{docText.length} characters</span>
            <div style={{ display:"flex", gap:8 }}>
              {analysis && !analysis.error && <Btn variant="ghost" size="sm" onClick={() => exportIEPReport(analysis)}>📄 Export PDF</Btn>}
              <Btn onClick={analyze} disabled={loading||!docText.trim()} style={{ background:`linear-gradient(135deg,${C.lavender},${C.sky})`, boxShadow:`0 6px 20px ${C.lavender}44` }}>{loading?"Analyzing…":"🔍 Analyze"}</Btn>
            </div>
          </div>
        </Card>

        {analysis?.limitReached && (
          <Card style={{ textAlign:"center", padding:48, border:`2px solid ${C.teal}33` }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💙</div>
            <div style={{ fontWeight:800, fontSize:18, color:C.dark, marginBottom:8 }}>You've used your 2 free IEP analyses this month</div>
            <p style={{ color:C.mid, fontSize:14, marginBottom:20, lineHeight:1.7 }}>Upgrade to the Family Plan for unlimited IEP/BIP analysis, unlimited AI chat, and priority support.</p>
            <Btn onClick={()=>setActive("Pricing")} style={{ background:`linear-gradient(135deg,${C.teal},${C.lavender})` }}>Upgrade to Family Plan — $19/mo →</Btn>
          </Card>
        )}
        {loading && <Card style={{ textAlign:"center", padding:48 }}><div style={{ fontSize:36, marginBottom:12 }}>🧩</div><div style={{ fontWeight:700, fontSize:17, color:C.dark }}>Reading your document…</div><div style={{ color:C.mid, fontSize:13, marginTop:6 }}>Checking goals, services, rights, and potential gaps with AI.</div></Card>}

        {analysis && !analysis.error && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Card style={{ background:`linear-gradient(135deg,${C.dark},#3D3860)` }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:16, alignItems:"center" }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:"rgba(255,255,255,0.5)", fontSize:10, fontWeight:700, letterSpacing:"0.08em", marginBottom:4 }}>DOCUMENT</div>
                  <div style={{ color:"white", fontSize:20, fontWeight:800 }}>{analysis.documentType}{analysis.studentName?` — ${analysis.studentName}`:""}</div>
                  <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                    {analysis.studentAge && <span style={{ background:`${C.teal}33`, color:C.teal, fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:999 }}>{analysis.studentAge}</span>}
                    {analysis.disability && <span style={{ background:`${C.lavender}33`, color:C.lavender, fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:999 }}>{analysis.disability}</span>}
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.7)", fontSize:13, lineHeight:1.65, marginTop:10, maxWidth:520 }}>{analysis.summary}</div>
                  {analysis.scoreRationale && <div style={{ color:"rgba(255,255,255,0.45)", fontSize:11, fontStyle:"italic", marginTop:6 }}>{analysis.scoreRationale}</div>}
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ width:80, height:80, borderRadius:"50%", background:`conic-gradient(${C.teal} ${analysis.overallScore*36}deg,rgba(255,255,255,0.12) 0)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:62, height:62, borderRadius:"50%", background:"#2D2A3E", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ color:"white", fontSize:22, fontWeight:900, lineHeight:1 }}>{analysis.overallScore}</div>
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:9 }}>/10</div>
                    </div>
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, marginTop:5 }}>Score</div>
                </div>
              </div>
              <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
                <Btn size="sm" variant="ghost" onClick={() => exportIEPReport(analysis)} style={{ borderColor:"rgba(255,255,255,0.3)", color:"white" }}>📄 Export Full Report</Btn>
              </div>
            </Card>

            <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:16 }}>
              {[{ label:"✅ Strengths", items:analysis.strengths, color:C.teal },{ label:"⚠️ Gaps", items:analysis.gaps, color:C.peach },{ label:"🛡️ Your Rights", items:analysis.parentRights, color:C.lavender },{ label:"💡 Recommendations", items:analysis.recommendations, color:C.sky }].map(s => (
                <Card key={s.label}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>{s.label}</div>
                  {s.items?.map((item,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}><div style={{ width:5, height:5, borderRadius:"50%", background:s.color, marginTop:8, flexShrink:0 }} /><div style={{ fontSize:13, color:C.mid, lineHeight:1.55 }}>{item}</div></div>)}
                </Card>
              ))}
            </div>

            {analysis.goalAnalysis?.length>0 && (
              <Card style={{ background:`${C.teal}08` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>🎯 Goal-by-Goal Analysis</div>
                {analysis.goalAnalysis.map((g,i) => (
                  <div key={i} style={{ display:"flex", gap:9, marginBottom:9, paddingBottom:9, borderBottom:i<analysis.goalAnalysis.length-1?`1px solid ${C.border}`:"none" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:C.teal, color:"white", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                    <div style={{ fontSize:13, color:C.mid, lineHeight:1.55, paddingTop:1 }}>{g}</div>
                  </div>
                ))}
              </Card>
            )}

            {analysis.servicesReview?.length>0 && (
              <Card style={{ background:`${C.lavender}08` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>🏥 Services Review</div>
                {analysis.servicesReview.map((s,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}><div style={{ width:5, height:5, borderRadius:"50%", background:C.lavender, marginTop:8, flexShrink:0 }} /><div style={{ fontSize:13, color:C.mid, lineHeight:1.55 }}>{s}</div></div>)}
              </Card>
            )}

            {analysis.redFlags?.length>0 && (
              <Card style={{ background:`${C.rose}0D`, border:`1.5px solid ${C.rose}33` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.rose, marginBottom:9 }}>🚨 Red Flags</div>
                {analysis.redFlags.map((f,i) => <div key={i} style={{ display:"flex", gap:7, marginBottom:6 }}><span style={{ color:C.rose, fontWeight:700 }}>!</span><span style={{ fontSize:13, color:C.dark }}>{f}</span></div>)}
              </Card>
            )}

            {analysis.legalConcerns?.length>0 && (
              <Card style={{ background:`${C.gold}0A`, border:`1.5px solid ${C.gold}44` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.peach, marginBottom:9 }}>⚖️ Legal Concerns</div>
                {analysis.legalConcerns.map((l,i) => <div key={i} style={{ display:"flex", gap:7, marginBottom:6 }}><span style={{ color:C.gold, fontWeight:700 }}>§</span><span style={{ fontSize:13, color:C.dark }}>{l}</span></div>)}
              </Card>
            )}

            <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:16 }}>
              <Card style={{ background:`${C.teal}08` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:9 }}>🗺️ Next Steps</div>
                {analysis.nextSteps?.map((s,i) => <div key={i} style={{ display:"flex", gap:9, marginBottom:9 }}><div style={{ width:20, height:20, borderRadius:"50%", background:C.teal, color:"white", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div><div style={{ fontSize:13, color:C.mid, lineHeight:1.55, paddingTop:1 }}>{s}</div></div>)}
              </Card>
              <Card style={{ background:`${C.lavender}08` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:9 }}>❓ Questions to Ask</div>
                {analysis.questionsToAsk?.map((q,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}><span style={{ color:C.lavender, fontWeight:700 }}>?</span><div style={{ fontSize:13, color:C.mid, lineHeight:1.55 }}>{q}</div></div>)}
              </Card>
            </div>
          </div>
        )}
        {analysis?.error && <Card style={{ textAlign:"center", padding:36 }}><div style={{ fontSize:30, marginBottom:10 }}>😔</div><div style={{ fontWeight:700, color:C.dark }}>Analysis failed</div><div style={{ color:C.mid, fontSize:14, marginTop:6 }}>Please try again — paste more of the document for best results.</div></Card>}
      </div>
    </div>
  );
}

// ─── RESOURCE FINDER ─────────────────────────────────────────────────────────
// Hardcoded national resources — always available as fallback
// ─── RESOURCE DATABASE ───────────────────────────────────────────────────────
// Real, verified providers. Add any city by following the same pattern.
const ALL_RESOURCES = [

  // ── NATIONAL ─────────────────────────────────────────────────────────────
  { name:"Autism Society of America", type:"Advocacy & Support", description:"Nation's leading autism organization with local chapters in every state. Support groups, advocacy, and family resources.", scope:"National", link:"https://autismsociety.org", phone:"1-800-328-8476", tips:"Find your local chapter at autismsociety.org/chapters for in-person support.", free:true, waitlist:null, tags:["advocacy","support groups","general","national"] },
  { name:"Autism Speaks", type:"Research & Family Resources", description:"Free tool kits for every life stage, IEP guides, and a nationwide resource finder.", scope:"National", link:"https://autismspeaks.org", phone:"1-888-288-4762", tips:"Download their free IEP guide under 'Family Services > School & Learning'.", free:true, waitlist:null, tags:["iep","resources","advocacy","national"] },
  { name:"ASAN — Autistic Self Advocacy Network", type:"Autistic-Led Advocacy", description:"Run by and for autistic people. Neurodiversity-affirming resources, policy guides, and community connections.", scope:"National", link:"https://autisticadvocacy.org", phone:null, tips:"Their 'Welcome to the Autistic Community' guide is essential for newly diagnosed adults.", free:true, waitlist:null, tags:["advocacy","autistic adults","self-advocacy","national"] },
  { name:"Wrightslaw Special Education Law", type:"Legal Resources", description:"The most trusted source for special education law — IDEA, parent rights, and attorney directories.", scope:"National", link:"https://wrightslaw.com", phone:null, tips:"Use Yellow Pages for Kids at yellowpagesforkids.com to find advocates in your state.", free:true, waitlist:null, tags:["legal","iep","rights","law","due process","national"] },
  { name:"Parent Training & Information Centers (PTI)", type:"Free IEP Support", description:"Federally funded centers in every US state. Free one-on-one help navigating IEPs and special education rights.", scope:"National", link:"https://parentcenterhub.org", phone:null, tips:"Your state's PTI center helps you prepare for IEP meetings at no cost.", free:true, waitlist:null, tags:["iep","legal","advocacy","parents","free","national"] },
  { name:"ASHA ProFind — Speech Therapy Locator", type:"Speech-Language Therapy", description:"Find certified SLPs specializing in autism, AAC, and social communication near you.", scope:"National", link:"https://www.asha.org/profind", phone:"1-800-638-8255", tips:"Filter by 'Autism Spectrum' specialty when searching.", free:false, waitlist:"4-12 weeks", tags:["speech therapy","aac","communication","therapy","national"] },
  { name:"AOTA OT Practitioner Locator", type:"Occupational Therapy", description:"Find OTs specializing in sensory processing, fine motor, and daily living skills.", scope:"National", link:"https://www.aota.org/practice/find-ot", phone:null, tips:"Search for OTs with 'sensory integration' or 'autism' specialties.", free:false, waitlist:"2-8 weeks", tags:["occupational therapy","sensory","ot","national"] },
  { name:"BACB Certificant Registry", type:"ABA Therapist Finder", description:"Find Board Certified Behavior Analysts (BCBAs) anywhere in the US through the official BACB registry.", scope:"National", link:"https://www.bacb.com/services/o.php?page=101143", phone:null, tips:"Always verify a provider's BCBA certification is current before starting services.", free:false, waitlist:"2-6 months", tags:["aba","behavior","bcba","national"] },
  { name:"Easter Seals", type:"Therapy & Support", description:"ABA, speech, OT, and family support across 700+ locations nationwide. Accepts Medicaid.", scope:"National", link:"https://www.easterseals.com", phone:"1-800-221-6827", tips:"Many Easter Seals chapters accept Medicaid and sliding scale fees.", free:false, waitlist:"4-8 weeks", tags:["aba","speech therapy","ot","therapy","medicaid","national"] },
  { name:"Crisis Text Line", type:"Crisis Support", description:"Text HOME to 741741 for free, confidential 24/7 crisis support.", scope:"National", link:"https://www.crisistextline.org", phone:null, tips:"Text HOME to 741741 — available around the clock.", free:true, waitlist:null, tags:["crisis","mental health","emergency","national"] },
  { name:"988 Suicide & Crisis Lifeline", type:"Crisis Support", description:"Call or text 988 for 24/7 crisis counseling. Trained staff for autism-related crises.", scope:"National", link:"https://988lifeline.org", phone:"988", tips:"Also available via online chat at 988lifeline.org.", free:true, waitlist:null, tags:["crisis","mental health","emergency","national"] },
  { name:"National Disability Rights Network", type:"Legal Advocacy", description:"Federally mandated P&A organizations providing free legal help to people with disabilities in every state.", scope:"National", link:"https://www.ndrn.org", phone:"202-408-9514", tips:"Your state's P&A provides free legal help for special education disputes.", free:true, waitlist:null, tags:["legal","rights","advocacy","due process","iep","national"] },
  { name:"COPAA — Parent Attorneys & Advocates", type:"Legal Resources", description:"Directory of special education attorneys and advocates nationwide.", scope:"National", link:"https://www.copaa.org", phone:null, tips:"Use their attorney directory to find a special ed lawyer in your state.", free:true, waitlist:null, tags:["legal","attorney","iep","rights","national"] },
  { name:"AAC Institute", type:"Assistive Technology & AAC", description:"Resources and training on Augmentative and Alternative Communication for non-speaking individuals.", scope:"National", link:"https://www.aacinstitute.org", phone:null, tips:"Free AAC resources include device comparison guides and implementation strategies.", free:true, waitlist:null, tags:["aac","assistive technology","communication","national"] },
  { name:"Vocational Rehabilitation Services", type:"Employment & Adult Services", description:"Every US state has a VR program providing job training and supported employment for autistic adults.", scope:"National", link:"https://askjan.org/links/vr.htm", phone:null, tips:"Apply early — eligibility starts at age 14 in many states.", free:true, waitlist:"4-8 weeks", tags:["employment","adult services","vocational","transition","national"] },
  { name:"Autism NOW Center", type:"Adult Services", description:"National referral center connecting autistic adults to housing, employment, and community services.", scope:"National", link:"https://autismnow.org", phone:"1-855-828-8476", tips:"Call their helpline to get connected with adult services in your specific state.", free:true, waitlist:null, tags:["adult services","housing","employment","transition","national"] },
  { name:"SPARK for Autism", type:"Research Community", description:"Largest autism research study in the US. Families participate and access resources while contributing to science.", scope:"National", link:"https://sparkforautism.org", phone:null, tips:"Joining SPARK connects you with research findings and other families.", free:true, waitlist:null, tags:["research","community","national"] },

  // ── INDIANA — STATEWIDE ───────────────────────────────────────────────────
  { name:"Indiana Resource Center for Autism (IRCA)", type:"Training & Consultation", description:"Free training, consultation, and resources for Indiana families and educators supporting individuals with autism.", scope:"Local", link:"https://www.iidc.indiana.edu/irca", phone:"812-855-6508", tips:"IRCA offers free family consultations and educator workshops across Indiana.", free:true, waitlist:null, tags:["indiana","training","resources","school","free","statewide"] },
  { name:"Autism Society of Indiana", type:"Advocacy & Support", description:"Statewide chapter with regional support groups, family events, and an updated Indiana provider directory.", scope:"Local", link:"https://www.autismsocietyofindiana.org", phone:"317-695-5000", tips:"They maintain a current Indiana ABA provider list — call or check their website.", free:true, waitlist:null, tags:["indiana","support groups","advocacy","resources","statewide"] },
  { name:"IN*SOURCE — Indiana Parent Resource Center", type:"Free IEP Support", description:"Indiana's free PTI center. One-on-one help navigating IEPs, special education rights, and school disputes anywhere in Indiana.", scope:"Local", link:"https://www.insource.org", phone:"1-800-332-4433", tips:"Call their free helpline before any IEP meeting — they'll help you prepare.", free:true, waitlist:null, tags:["indiana","iep","legal","advocacy","parents","free","statewide"] },
  { name:"Disability Rights Indiana", type:"Legal Advocacy", description:"Indiana's federally mandated P&A organization. Free legal help for education and disability rights cases statewide.", scope:"Local", link:"https://www.disabilityrightsindiana.org", phone:"317-722-5555", tips:"Contact them for free legal support with any Indiana special education dispute.", free:true, waitlist:null, tags:["indiana","legal","rights","iep","due process","statewide"] },
  { name:"Easter Seals Crossroads — Indiana", type:"Therapy & Support", description:"Indiana's Easter Seals affiliate. ABA, speech, OT, assistive technology, and family support. In-home and telehealth available.", scope:"Local", link:"https://www.eastersealscrossroads.org", phone:"317-466-1000", tips:"Telehealth services are available for families across Indiana including the Kokomo area.", free:false, waitlist:"4-8 weeks", tags:["indiana","aba","speech therapy","ot","assistive technology","statewide","therapy"] },
  { name:"Indiana FSSA — Disability & Rehabilitative Services", type:"State Medicaid Waiver & Adult Services", description:"Indiana's state agency for disability services including Medicaid waivers, supported living, and adult services.", scope:"Local", link:"https://www.in.gov/fssa/ddrs", phone:"800-545-7763", tips:"Apply for the Indiana Medicaid waiver early — it funds ABA, day services, and supported employment. Waitlists can be long.", free:true, waitlist:"1-3 years — apply now!", tags:["indiana","adult services","medicaid","waiver","housing","employment","statewide"] },

  // ── KOKOMO, IN — LOCAL VERIFIED ───────────────────────────────────────────
  { name:"Circle City ABA — Kokomo", type:"ABA Therapy", description:"Play-based ABA therapy for children 18 months–17 years. Individualized programs, social skills groups, and parent training. One of Indiana's leading ABA providers with 20+ years experience.", scope:"Local", link:"https://circlecityaba.com/kokomo-in/", phone:"765-237-9935", tips:"Located at 2330 S Dixon Road, Suite 350. Accepts most insurance, Medicaid, and Tricare.", free:false, waitlist:"4-8 weeks", tags:["kokomo","indiana","aba","behavior","therapy","local"] },
  { name:"Indiana Behavior Analysis Academy (IBAA)", type:"ABA Therapy & Diagnosis", description:"Kokomo-based ABA therapy provider founded in 2014. Offers individualized ABA therapy, diagnostic evaluations with licensed psychologist Dr. Melody Marley, and an Early Learning Center for ages 2-6.", scope:"Local", link:"https://indianabaa.com", phone:"765-419-0411", tips:"Located at 1315 E Hoffer St. IBAA offers both diagnosis and ABA therapy — helpful for families just starting out.", free:false, waitlist:"3-6 weeks", tags:["kokomo","indiana","aba","behavior","diagnosis","early intervention","local"] },
  { name:"Ivy Rehab for Kids — Kokomo", type:"Speech, OT & Physical Therapy", description:"Pediatric physical, occupational, and speech therapy at two Kokomo locations. Specializes in sensory processing, fine motor, social skills, speech, and feeding therapy for children birth–adulthood.", scope:"Local", link:"https://ivyrehab.com/physical-therapy-location/kokomo-in-kids/", phone:"765-436-0052", tips:"Located at 2108 E Blvd (next to TJ Maxx) and 1805 E Hoffer St. Open Mon–Fri 7:30am–7pm, Sat 8am–12pm.", free:false, waitlist:"2-4 weeks", tags:["kokomo","indiana","speech therapy","occupational therapy","physical therapy","ot","sensory","local"] },
  { name:"Hopebridge Autism Therapy Center — Indiana", type:"ABA Therapy", description:"Multi-location ABA therapy provider across Indiana offering comprehensive autism therapy for children. Accepts most major insurance plans.", scope:"Local", link:"https://www.hopebridge.com", phone:"844-467-3224", tips:"Hopebridge has multiple Indiana locations — call to find the nearest center to Kokomo and ask about current openings.", free:false, waitlist:"4-8 weeks", tags:["kokomo","indiana","aba","behavior","therapy","local"] },
  { name:"Community Howard Regional Health", type:"Healthcare & Behavioral Health", description:"Howard County's regional hospital offering behavioral health, developmental pediatrics, and care coordination. A key entry point for autism evaluation and local service referrals in Kokomo.", scope:"Local", link:"https://www.communityhoward.org", phone:"765-453-8383", tips:"Ask specifically about developmental pediatrics for autism evaluations and a warm handoff to local therapy providers.", free:false, waitlist:null, tags:["kokomo","indiana","healthcare","diagnosis","behavioral health","local"] },
  { name:"Howard County School Corp — Special Education", type:"School & IEP Services", description:"Kokomo-area public school special education department serving students with autism. Your first contact for school-based IEP evaluations and services.", scope:"Local", link:"https://www.kokomo.k12.in.us", phone:"765-455-8000", tips:"Contact the Special Education Director directly to request an initial evaluation or call an IEP meeting.", free:true, waitlist:null, tags:["kokomo","indiana","school","iep","special education","local"] },

];

// ── SCALABLE LOCATION MATCHING ────────────────────────────────────────────────
// Maps location keywords → tags that boost local results
// Add new cities here as you expand
const LOCATION_MAP = {
  // Indiana cities
  "kokomo":["kokomo","indiana","statewide"],
  "howard county":["kokomo","indiana","statewide"],
  "indianapolis":["indiana","statewide"],
  "indy":["indiana","statewide"],
  "fort wayne":["indiana","statewide"],
  "south bend":["indiana","statewide"],
  "muncie":["indiana","statewide"],
  "lafayette":["indiana","statewide"],
  "bloomington":["indiana","statewide"],
  "evansville":["indiana","statewide"],
  "terre haute":["indiana","statewide"],
  "fishers":["indiana","statewide"],
  "carmel":["indiana","statewide"],
  "anderson":["indiana","statewide"],
  "noblesville":["indiana","statewide"],
  "valparaiso":["indiana","statewide"],
  "michigan city":["indiana","statewide"],
  "indiana"  :["indiana","statewide"],
  ", in,"    :["indiana","statewide"],
  ", in "    :["indiana","statewide"],
};

function getResources(query, location) {
  const q = (query || "").toLowerCase().trim();
  const loc = (location || "").toLowerCase().trim();

  const TAG_MAP = {
    "aba therapy":["aba","behavior","bcba"], "aba":["aba","behavior","bcba"],
    "speech therapy":["speech therapy","aac","communication","speech"], "speech":["speech therapy","communication"],
    "occupational therapy":["occupational therapy","ot","sensory"], "ot":["ot","occupational therapy"],
    "support groups":["support groups","community","advocacy"], "support group":["support groups"],
    "legal advocates":["legal","attorney","due process","iep"], "legal":["legal","rights","law"],
    "social skills":["social skills","groups","peers"],
    "crisis support":["crisis","mental health","emergency"], "crisis":["crisis","emergency"],
    "assistive technology":["aac","assistive technology","communication"], "aac":["aac","communication"],
    "adult services":["adult services","employment","housing","transition"], "adult":["adult services","transition"],
    "school consultation":["school","iep","legal"], "iep":["iep","legal","rights","school"],
    "indiana resources":["indiana","statewide","kokomo"],
    "diagnosis":["diagnosis","healthcare"], "evaluation":["diagnosis","healthcare"],
  };

  // Only show national resources when no location typed
  if (!loc) return ALL_RESOURCES.filter(r => r.scope === "National" || r.scope === "Global").slice(0, 10);

  const searchTags = q ? (TAG_MAP[q] || q.split(" ").flatMap(w => TAG_MAP[w] || [w]).filter(Boolean)) : [];

  // Resolve location to known tags using LOCATION_MAP
  let locTags = [];
  let knownLocation = false;
  if (loc) {
    Object.entries(LOCATION_MAP).forEach(([key, tags]) => {
      if (loc.includes(key)) {
        locTags = [...new Set([...locTags, ...tags])];
        knownLocation = true;
      }
    });
  }

  const results = [];

  ALL_RESOURCES.forEach(r => {
    const rTags = r.tags || [];
    const rText = (r.name + " " + r.type + " " + r.description).toLowerCase();
    const isLocal = r.scope === "Local";
    const isNational = r.scope === "National" || r.scope === "Global";

    // KEY RULE: if a location is typed and this is a local resource,
    // only show it if it actually matches that location
    if (loc && isLocal) {
      const locationMatch = locTags.some(lt => rTags.includes(lt));
      if (!locationMatch) return; // skip local resources from wrong city
    }

    let score = 0;

    // Service type match
    if (searchTags.length > 0) {
      searchTags.forEach(tag => {
        if (rTags.includes(tag)) score += 3;
        else if (rText.includes(tag)) score += 1;
      });
    } else {
      score = 2; // no query = show all matching location
    }

    // Boost local results that match location to the top
    if (loc && knownLocation && isLocal) {
      locTags.forEach(lt => { if (rTags.includes(lt)) score += 10; });
    }

    // National resources always included as fallback
    if (isNational && score === 0) score = 1;

    if (score > 0) results.push({ ...r, _score: score });
  });

  results.sort((a, b) => b._score - a._score);
  return results.slice(0, 12);
}

function ResourceFinder({ user, savedResources, setSavedResources, lang }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [tab, setTab]     = useState("search");
  const w = useWindowWidth();
  const mobile = w < 768;

  const CATS = [
    { label:"All Resources",         q:"all" },
    { label:"ABA Therapy",           q:"aba therapy" },
    { label:"Speech Therapy",        q:"speech therapy" },
    { label:"Occupational Therapy",  q:"occupational therapy" },
    { label:"Support Groups",        q:"support groups" },
    { label:"Legal Advocates",       q:"legal advocates" },
    { label:"Crisis Support",        q:"crisis support" },
    { label:"Assistive Technology",  q:"assistive technology" },
    { label:"Adult Services",        q:"adult services" },
    { label:"Indiana Resources",     q:"indiana resources" },
  ];

  // Always-visible local search directories — work for every city in all 50 states
  const DIRECTORIES = [
    { name:"Psychology Today",        desc:"Search therapists & ABA providers by zip code. Filter by insurance & specialty.",   icon:"🧠", color:C.teal,    url:"https://www.psychologytoday.com/us/therapists/autism-spectrum-disorder" },
    { name:"ASHA ProFind",            desc:"Official directory of certified speech-language pathologists. Search by zip code.",   icon:"🗣️", color:C.lavender, url:"https://www.asha.org/profind/" },
    { name:"BACB Registry",           desc:"Find Board Certified Behavior Analysts (BCBAs) verified anywhere in the US.",        icon:"🔬", color:C.peach,    url:"https://www.bacb.com/services/o.php?page=101143" },
    { name:"AOTA OT Locator",         desc:"Find occupational therapists specializing in autism & sensory processing near you.", icon:"🖐️", color:C.sky,     url:"https://www.aota.org/practice/find-ot" },
    { name:"Easter Seals Centers",    desc:"ABA, speech & OT locations nationwide. Accepts Medicaid & most insurance.",          icon:"🌼", color:C.gold,     url:"https://www.easterseals.com/our-programs/autism-services/" },
    { name:"Autism Society Chapters", desc:"Find your local chapter for support groups, events & community resources.",          icon:"🤝", color:C.rose,     url:"https://autismsociety.org/chapters/" },
    { name:"Google Maps Search",      desc:"Real-time map search for autism providers in your exact city — always up to date.",   icon:"📍", color:C.teal,    url:"https://www.google.com/maps/search/autism+therapy+near+me" },
    { name:"Hopebridge Locations",    desc:"One of the largest ABA therapy networks in the US — find a center near you.",        icon:"🌈", color:C.lavender, url:"https://www.hopebridge.com/locations/" },
    { name:"SAMHSA Treatment Locator",desc:"Government-verified behavioral health providers. Covers all 50 states.",             icon:"🏥", color:C.peach,    url:"https://findtreatment.samhsa.gov/" },
    { name:"Autism Navigator",        desc:"State-by-state autism resource guides with local service maps.",                     icon:"🧭", color:C.sky,      url:"https://autismnavigator.com/" },
    { name:"Autism Speaks Resource Guide", desc:"Searchable national resource database with local provider finder by zip.",     icon:"💙", color:C.rose,     url:"https://www.autismspeaks.org/resource-guide" },
    { name:"Circle City ABA Locations", desc:"Indiana & multistate ABA provider. Find your nearest center.",                    icon:"⭕", color:C.gold,     url:"https://circlecityaba.com/our-locations/" },
  ];

  const TAG_FILTER = {
    "aba therapy":["aba","behavior","bcba"],
    "speech therapy":["speech therapy","communication","aac"],
    "occupational therapy":["occupational therapy","ot","sensory"],
    "support groups":["support groups","community"],
    "legal advocates":["legal","attorney","rights","due process"],
    "crisis support":["crisis","mental health","emergency"],
    "assistive technology":["aac","assistive technology","communication"],
    "adult services":["adult services","employment","housing","transition"],
    "school consultation":["school","iep","legal"],
    "indiana resources":["indiana","statewide","kokomo"],
  };

  const nationalOnly = ALL_RESOURCES.filter(r => r.scope === "National" || r.scope === "Global" || r.scope === "Local");

  const filtered = filter === "all"
    ? nationalOnly
    : nationalOnly.filter(r => {
        const tags = TAG_FILTER[filter] || [filter];
        const rTags = r.tags || [];
        const rText = (r.name + " " + r.type + " " + r.description).toLowerCase();
        return tags.some(t => rTags.includes(t) || rText.includes(t));
      });

  const queryFiltered = query.trim()
    ? filtered.filter(r => (r.name + " " + r.type + " " + r.description + " " + (r.tags||[]).join(" ")).toLowerCase().includes(query.toLowerCase()))
    : filtered;

  function toggleSave(r) {
    const exists = savedResources.find(s => s.name === r.name);
    setSavedResources(exists ? savedResources.filter(s => s.name !== r.name) : [...savedResources, r]);
  }

  const SCOPE_C = { Local:C.teal, National:C.lavender, Global:C.peach };

  const renderResource = (r, i) => {
    if (!r || !r.name) return null;
    const sc = r.scope || "National";
    return (
      <Card key={r.name + i}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <Tag c={SCOPE_C[sc] || C.teal}>{sc}</Tag>
            {r.free === true && <Tag c={C.teal}>Free</Tag>}
          </div>
          {user && (
            <button onClick={() => toggleSave(r)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:17 }}>
              {savedResources.find(s => s.name === r.name) ? "❤️" : "🤍"}
            </button>
          )}
        </div>
        <h3 style={{ fontSize:15, fontWeight:800, color:C.dark, margin:"0 0 4px" }}>{r.name}</h3>
        {r.type && <div style={{ fontSize:10, color:C.soft, fontWeight:600, marginBottom:7 }}>{r.type}</div>}
        {r.description && <p style={{ fontSize:13, color:C.mid, lineHeight:1.65, margin:"0 0 9px" }}>{r.description}</p>}
        {r.tips && (
          <div style={{ background:`${C.gold}18`, borderRadius:7, padding:"6px 10px", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.peach }}>💡 </span>
            <span style={{ fontSize:10, color:C.mid }}>{r.tips}</span>
          </div>
        )}
        {r.waitlist && <div style={{ fontSize:10, color:C.soft, marginBottom:8 }}>⏳ {r.waitlist}</div>}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {r.link && String(r.link).startsWith("http") && (
            <a href={r.link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:12, fontWeight:700, color:C.teal, textDecoration:"none", borderBottom:`1px solid ${C.teal}44` }}>
              Visit Site →
            </a>
          )}
          {r.phone && <span style={{ fontSize:11, color:C.mid }}>📞 {r.phone}</span>}
        </div>
      </Card>
    );
  };

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:980, margin:"0 auto" }}>

        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Pill color={C.peach}>RESOURCE FINDER</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?26:32, fontWeight:900, color:C.dark, margin:"12px 0 8px", letterSpacing:"-0.02em" }}>
            Find autism support anywhere
          </h1>
          <p style={{ color:C.mid, fontSize:15, maxWidth:540, margin:"0 auto" }}>
            Trusted directories to find local providers in all 50 states, plus our national resource database.
          </p>
        </div>

        {/* ── SECTION 1: LOCAL SEARCH DIRECTORIES ── */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <div style={{ fontWeight:800, fontSize:16, color:C.dark }}>📍 Find Local Providers — Any City, Any State</div>
            <span style={{ background:`${C.teal}18`, color:C.teal, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:999, border:`1px solid ${C.teal}33` }}>ALL 50 STATES</span>
          </div>
          <p style={{ fontSize:13, color:C.mid, marginBottom:18, lineHeight:1.65 }}>
            Click any directory below to search for verified providers in your city. Each one lets you search by zip code, filter by insurance, and see real reviews.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
            {DIRECTORIES.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
                <div style={{ background:"white", border:`1.5px solid ${d.color}33`, borderRadius:14, padding:"14px 16px",
                  boxShadow:"0 2px 12px rgba(0,0,0,0.05)", cursor:"pointer", height:"100%", display:"flex", flexDirection:"column", gap:8,
                  transition:"all 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${d.color}18`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {d.icon}
                    </div>
                    <div style={{ fontWeight:800, fontSize:13, color:C.dark, lineHeight:1.3 }}>{d.name}</div>
                  </div>
                  <div style={{ fontSize:11.5, color:C.mid, lineHeight:1.6, flex:1 }}>{d.desc}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:d.color }}>Open & search by zip code →</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── SECTION 2: NATIONAL DATABASE ── */}
        <div>
          <div style={{ fontWeight:800, fontSize:16, color:C.dark, marginBottom:6 }}>🌍 National Resource Database</div>
          <p style={{ fontSize:13, color:C.mid, marginBottom:16 }}>
            Filter by service type or search by name. These organizations serve families in every state.
          </p>

          {/* Filter bar */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {CATS.map(c => (
              <button key={c.q} onClick={() => setFilter(c.q)}
                style={{ background:filter===c.q?`${C.teal}18`:"transparent",
                  border:`1.5px solid ${filter===c.q?C.teal:C.border}`, borderRadius:999,
                  padding:"6px 13px", fontSize:12, fontWeight:filter===c.q?700:500,
                  color:filter===c.q?C.teal:C.mid, cursor:"pointer", fontFamily:font }}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Text search */}
          <div style={{ display:"flex", gap:9, marginBottom:18 }}>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search resources by name or keyword…"
              style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:10,
                padding:"10px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none" }} />
          </div>

          {/* Saved toggle */}
          {user && savedResources.length > 0 && (
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <Btn variant={tab==="search"?"primary":"ghost"} size="sm" onClick={() => setTab("search")}>Resources</Btn>
              <Btn variant={tab==="saved"?"primary":"ghost"} size="sm" onClick={() => setTab("saved")}>❤️ Saved ({savedResources.length})</Btn>
            </div>
          )}

          {tab === "saved" && (
            <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(340px,1fr))", gap:16 }}>
              {savedResources.map(renderResource)}
            </div>
          )}

          {tab === "search" && (
            queryFiltered.length === 0 ? (
              <Card style={{ textAlign:"center", padding:32 }}>
                <div style={{ fontSize:13, color:C.mid }}>No resources match that search. Try a different term.</div>
              </Card>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(340px,1fr))", gap:16 }}>
                {queryFiltered.map(renderResource)}
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}

// ─── BLOG ─────────────────────────────────────────────────────────────────────
function BlogHub({ lang, t }) {
  const STATIC_POSTS = [
    {id:1,title:"Your IEP Rights: What Schools Don't Always Tell You",category:"IEP & Law",excerpt:"Every parent has powerful legal rights under IDEA — but schools aren't always required to explain them. Here's what you need to know before your next meeting.",author:"Sarah Mitchell, M.Ed.",readTime:"6 min read",emoji:"⚖️",tags:["iep","rights"]},
    {id:2,title:"ABA Therapy Explained: Benefits, Controversies & What to Ask",category:"Therapies",excerpt:"ABA is the most widely recommended autism therapy — but it's also the most debated. We break down what the research actually says and how to evaluate any program.",author:"Dr. James Okafor, BCBA-D",readTime:"8 min read",emoji:"🧠",tags:["aba","therapy"]},
    {id:3,title:"How to Prepare for an IEP Meeting (And Actually Win)",category:"Parenting",excerpt:"Walking into an IEP meeting unprepared is like going to court without a lawyer. These proven strategies will help you advocate effectively for your child.",author:"Tatyana Warren, Founder",readTime:"7 min read",emoji:"💪",tags:["iep","meeting"]},
    {id:4,title:"Sensory Accommodations Every Classroom Should Offer",category:"School Strategies",excerpt:"Simple, low-cost accommodations can transform a school day for sensory-sensitive children. Here's a practical guide to request what your child needs.",author:"Lisa Chen, OT",readTime:"5 min read",emoji:"🎯",tags:["sensory","school"]},
    {id:5,title:"I'm Autistic and This Is What I Wish My Parents Had Known",category:"Autistic Voices",excerpt:"A first-person perspective on growing up autistic — what helped, what hurt, and what every parent should hear directly from the community.",author:"Marcus Rivera, Self-Advocate",readTime:"9 min read",emoji:"💙",tags:["autistic voices","identity"]},
    {id:6,title:"The Latest Research on Early Autism Intervention",category:"Research",excerpt:"New studies are reshaping what we know about early intervention. We summarize the findings that matter most for families making therapy decisions right now.",author:"Dr. Priya Sharma, PhD",readTime:"6 min read",emoji:"🔬",tags:["research","early intervention"]},
    {id:7,title:"Transition Planning: Preparing Your Teen for Life After High School",category:"Adult Services",excerpt:"IDEA guarantees transition planning services starting at age 16 — but most families don't know what to ask for. This guide covers employment, housing, and independence.",author:"Kevin James, Transition Specialist",readTime:"8 min read",emoji:"🎓",tags:["transition","adult services"]},
    {id:8,title:"What Is FAPE? Your Child's Right to a Free Appropriate Education",category:"IEP & Law",excerpt:"FAPE is one of the most important rights in special education law — and one of the most frequently violated. Learn what it means and how to enforce it.",author:"Attorney Diana Morse",readTime:"5 min read",emoji:"📋",tags:["fape","rights"]},
    {id:9,title:"Talking to Your Child About Their Autism Diagnosis",category:"Parenting",excerpt:"When, how, and what to say when explaining autism to your child. Guidance from autistic adults and child psychologists on having this important conversation.",author:"Dr. Angela Brooks, PsyD",readTime:"7 min read",emoji:"❤️",tags:["diagnosis","parenting"]},
  ];
  const [posts] = useState(STATIC_POSTS);
  const [selected, setSelected] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [cat, setCat] = useState("All");
  const w = useWindowWidth(); const mobile = w<768;
  const CATS = lang==="es" ? ["Todo","IEP y Ley","Terapias","Crianza","Estrategias Escolares","Voces Autistas","Investigación","Servicios para Adultos"] : ["All","IEP & Law","Therapies","Parenting","School Strategies","Autistic Voices","Research","Adult Services"];

  async function loadPost(post) {
    setSelected({...post, content:null}); setPostLoading(true);
    try {
      const content = await claudeChat(`You are a senior writer for SpectraGuide. Write warm, evidence-based, practical articles in markdown format with ## headers. Target 600-700 words. Be empowering and specific.`, `Write the full article: "${post.title}"
Category: ${post.category}
Author: ${post.author}
Audience: parents, educators, autistic individuals`, [], 2000);
      setSelected({...post, content});
    } catch { setSelected({...post, content:"Unable to load article. Please try again."}); }
    setPostLoading(false);
  }

  const filtered = posts?.filter(p => cat==="All"||p.category===cat);

  if (selected) return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        <Btn variant="ghost" size="sm" onClick={()=>setSelected(null)} style={{ marginBottom:24 }}>← Back</Btn>
        <Tag c={C.sky}>{selected.category}</Tag>
        <h1 style={{ fontFamily:serif, fontSize:mobile?26:34, fontWeight:900, color:C.dark, margin:"12px 0 14px", lineHeight:1.2 }}>{selected.emoji} {selected.title}</h1>
        <div style={{ display:"flex", gap:12, fontSize:12, color:C.soft, marginBottom:28 }}>
          <span>✍️ {selected.author}</span><span>⏱ {selected.readTime}</span>
        </div>
        {postLoading ? <Card style={{ padding:48, textAlign:"center" }}><div style={{ fontSize:30, marginBottom:10 }}>📖</div><div style={{ fontWeight:700, color:C.dark }}>Writing article with AI…</div></Card>
          : <Card><div style={{ fontSize:15, lineHeight:1.88, color:C.mid, whiteSpace:"pre-wrap" }}>{selected.content}</div></Card>}
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:1050, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <Pill color={C.sky}>LEARNING HUB</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:34, fontWeight:900, color:C.dark, margin:"12px 0 8px", letterSpacing:"-0.02em" }}>{t?.blogTitle || "Knowledge is your greatest tool"}</h1>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginBottom:28 }}>
          {CATS.map(c => <button key={c} onClick={()=>setCat(c)} style={{ background:cat===c?`${C.sky}18`:"transparent", border:`1.5px solid ${cat===c?C.sky:C.border}`, borderRadius:999, padding:"6px 14px", fontSize:12, fontWeight:cat===c?700:500, color:cat===c?C.sky:C.mid, cursor:"pointer", fontFamily:font }}>{c}</button>)}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(290px,1fr))", gap:18 }}>
          {filtered?.map(post => (
            <Card key={post.id} style={{ cursor:"pointer" }} onClick={()=>loadPost(post)}>
              <div style={{ fontSize:32, marginBottom:12 }}>{post.emoji}</div>
              <Tag c={C.sky}>{post.category}</Tag>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.dark, margin:"9px 0 7px", lineHeight:1.35 }}>{post.title}</h3>
              <p style={{ fontSize:13, color:C.mid, lineHeight:1.65, margin:"0 0 14px" }}>{post.excerpt}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:11, color:C.soft }}>{post.author} · {post.readTime}</div>
                <span style={{ fontSize:12, fontWeight:700, color:C.sky }}>{lang==="es" ? "Leer →" : "Read →"}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
function PricingPage({ setActive, lang, t }) {
  const [billing, setBilling] = useState("monthly");
  const w = useWindowWidth(); const mobile = w<768;
  const plans = [
    { name:"Free", price:{monthly:0,annual:0}, color:C.teal, emoji:"🌱", desc:"For families just getting started", features:["AI Advocate Chat (10 msg/day)","IEP Analyzer (2/month)","Resource Finder","Learning Hub","Email support"], cta:"Start Free" },
    { name:"Family", price:{monthly:19,annual:15}, color:C.lavender, emoji:"💙", popular:true, desc:"For families navigating the journey", features:["Unlimited AI Advocate Chat","Unlimited IEP/BIP Analysis","Saved resources library","Chat history & notes","Priority support"], cta:"Start Family Plan" },
    { name:"Professional", price:{monthly:49,annual:39}, color:C.peach, emoji:"🎓", desc:"For educators, therapists & advocates", features:["Everything in Family","Multi-student management","Bulk IEP analysis","Team collaboration","API access","White-label options"], cta:"Start Pro Plan" },
    { name:"District", price:{monthly:299,annual:249}, color:C.rose, emoji:"🏫", desc:"For school districts & organizations", features:["Everything in Professional","Unlimited staff accounts","FERPA compliance tools","District analytics","Dedicated success manager","Custom integrations"], cta:"Contact Sales" },
  ];
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 80px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <Pill color={C.gold}>PRICING</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:38, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>{lang==="es" ? "Precios simples y transparentes" : <span>Simple, <GradText a={C.teal} b={C.gold}>transparent</GradText> pricing</span>}</h1>
          <p style={{ color:C.mid, fontSize:16, maxWidth:440, margin:"0 auto 24px" }}>{lang==="es" ? "Comienza gratis. Actualiza cuando estés listo. Cancela en cualquier momento." : "Start free. Upgrade when you're ready. Cancel anytime."}</p>
          <div style={{ display:"inline-flex", background:"white", border:`1.5px solid ${C.border}`, borderRadius:12, padding:4, gap:4 }}>
            {["monthly","annual"].map(b => <button key={b} onClick={()=>setBilling(b)} style={{ background:billing===b?`linear-gradient(135deg,${C.teal},${C.sky})`:"transparent", border:"none", borderRadius:9, padding:"7px 18px", fontSize:13, fontWeight:700, color:billing===b?"white":C.mid, cursor:"pointer", fontFamily:font }}>{b==="monthly"?"Monthly":"Annual (Save 20%)"}</button>)}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(220px,1fr))", gap:18, alignItems:"start" }}>
          {plans.map(plan => (
            <div key={plan.name} style={{ position:"relative" }}>
              {plan.popular && <div style={{ position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)", background:`linear-gradient(135deg,${C.lavender},${C.sky})`, color:"white", fontSize:10, fontWeight:700, padding:"3px 14px", borderRadius:999, whiteSpace:"nowrap", zIndex:1 }}>MOST POPULAR</div>}
              <Card style={{ border:plan.popular?`2px solid ${C.lavender}`:`1px solid ${C.border}`, padding:24 }}>
                <div style={{ fontSize:26, marginBottom:8 }}>{plan.emoji}</div>
                <h3 style={{ fontSize:17, fontWeight:800, color:C.dark, margin:"0 0 4px" }}>{plan.name}</h3>
                <p style={{ fontSize:12, color:C.soft, margin:"0 0 14px" }}>{plan.desc}</p>
                <div style={{ margin:"0 0 18px" }}>
                  <span style={{ fontFamily:serif, fontSize:34, fontWeight:900, color:plan.color }}>${plan.price[billing]}</span>
                  <span style={{ fontSize:12, color:C.soft }}>{plan.price[billing]>0?"/mo":" forever"}</span>
                </div>
                <div style={{ marginBottom:20 }}>
                  {plan.features.map((f,i) => <div key={i} style={{ display:"flex", gap:7, marginBottom:7 }}><span style={{ color:plan.color, fontSize:13 }}>✓</span><span style={{ fontSize:12.5, color:C.mid }}>{f}</span></div>)}
                </div>
                <button onClick={()=>{
              if (plan.price.monthly === 0) { setActive("Dashboard"); return; }
              const name = plan.name.toLowerCase();
              const key = `${name}_${billing}`;
              const priceId = STRIPE_PRICES[key];
              if (priceId) startCheckout(priceId);
              else setActive("Dashboard");
            }} style={{ width:"100%", background:plan.popular?`linear-gradient(135deg,${C.lavender},${C.sky})`:"white", border:plan.popular?"none":`2px solid ${C.border}`, borderRadius:11, padding:"11px 0", fontSize:13, fontWeight:700, color:plan.popular?"white":C.dark, cursor:"pointer", fontFamily:font, boxShadow:plan.popular?`0 6px 20px ${C.lavender}44`:"none" }}>{plan.cta}</button>
              </Card>
            </div>
          ))}
        </div>
        <div style={{ marginTop:56, textAlign:"center" }}>
          <h2 style={{ fontFamily:serif, fontSize:26, fontWeight:800, color:C.dark, margin:"0 0 28px" }}>Frequently Asked Questions</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(380px,1fr))", gap:14, textAlign:"left", maxWidth:900, margin:"0 auto" }}>
            {[
              { q:"Is my data private and secure?", a:"Yes. All data is encrypted. IEP documents are analyzed in real-time and never stored unless you explicitly save them to your account." },
              { q:"Can I use SpectraGuide for multiple children?", a:"The Family plan supports unlimited family members. Professional and District plans include multi-student management tools." },
              { q:"Is this a substitute for legal advice?", a:"No. SpectraGuide provides educational guidance. For legal disputes, always consult a qualified special education attorney." },
              { q:"How accurate is the IEP Analyzer?", a:"It's powered by AI and trained on IDEA law and thousands of IEPs. It's highly effective at identifying patterns, rights, and gaps." },
            ].map((faq,i) => (
              <Card key={i}>
                <div style={{ fontWeight:700, fontSize:13, color:C.dark, marginBottom:7 }}>❓ {faq.q}</div>
                <div style={{ fontSize:13, color:C.mid, lineHeight:1.65 }}>{faq.a}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DEMO BOOKING ─────────────────────────────────────────────────────────────
function BookingPage({ bookings, setBookings }) {
  const [form, setForm] = useState({ name:"", org:"", email:"", role:"", date:"", time:"", message:"" });
  const [submitted, setSubmitted] = useState(false);
  const w = useWindowWidth(); const mobile = w<768;
  const ROLES = ["Parent / Caregiver","Special Education Teacher","School Administrator","School District","Therapist / Clinician","Autism Advocate / Attorney","Other"];
  const TIMES = ["9:00 AM","10:00 AM","11:00 AM","1:00 PM","2:00 PM","3:00 PM","4:00 PM"];

  function submit() {
    if (!form.name||!form.email||!form.date) return;
    setBookings([...bookings, { ...form, id:Date.now(), createdAt:new Date().toLocaleDateString() }]);
    setSubmitted(true);
  }

  if (submitted) return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 20px" }}>
      <Card style={{ maxWidth:480, width:"100%", textAlign:"center", padding:48 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
        <h2 style={{ fontFamily:serif, fontSize:26, fontWeight:900, color:C.dark, margin:"0 0 12px" }}>Demo Booked!</h2>
        <p style={{ color:C.mid, fontSize:15, lineHeight:1.7, marginBottom:24 }}>We'll see you on <strong>{form.date}</strong> at <strong>{form.time}</strong>. A confirmation has been sent to <strong>{form.email}</strong>.</p>
        <p style={{ fontSize:13, color:C.soft }}>A SpectraGuide team member will send a meeting link within 24 hours.</p>
      </Card>
    </div>
  );

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Pill color={C.teal}>BOOK A DEMO</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?26:32, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>See SpectraGuide in action</h1>
          <p style={{ color:C.mid, fontSize:15, maxWidth:440, margin:"0 auto" }}>Schedule a personalized 30-minute demo for your school, district, or organization.</p>
        </div>
        <Card>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
            {[{ label:"Full Name *", key:"name", placeholder:"Your name" },{ label:"Organization", key:"org", placeholder:"School or org name" },{ label:"Email *", key:"email", placeholder:"your@email.com", type:"email" },{ label:"Your Role", key:"role", select:true }].map(f => (
              <div key={f.key}>
                <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>{f.label}</div>
                {f.select ? (
                  <select value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none" }}>
                    <option value="">Select role…</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                ) : (
                  <Input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.placeholder} type={f.type||"text"} style={{ width:"100%", boxSizing:"border-box" }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>Preferred Date *</div>
              <Input value={form.date} onChange={e=>setForm({...form,date:e.target.value})} placeholder="" type="date" style={{ width:"100%", boxSizing:"border-box" }} />
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>Preferred Time</div>
              <select value={form.time} onChange={e=>setForm({...form,time:e.target.value})} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none" }}>
                <option value="">Select time (ET)…</option>
                {TIMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>What would you like to discuss? (optional)</div>
            <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Tell us about your organization and what you're hoping to learn…" style={{ width:"100%", minHeight:100, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"11px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }} />
          </div>
          <Btn onClick={submit} disabled={!form.name||!form.email||!form.date} style={{ width:"100%" }}>📅 Book My Demo</Btn>
        </Card>
        <div style={{ marginTop:28, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          {[{ icon:"⏱", title:"30 Minutes", desc:"Focused, efficient demo" },{ icon:"🎯", title:"Personalized", desc:"Tailored to your org" },{ icon:"💬", title:"Q&A Included", desc:"All your questions answered" }].map(f => (
            <Card key={f.title} style={{ textAlign:"center", padding:18 }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{f.icon}</div>
              <div style={{ fontWeight:700, fontSize:13, color:C.dark }}>{f.title}</div>
              <div style={{ fontSize:11, color:C.soft, marginTop:3 }}>{f.desc}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user, setUser, chatHistory, iepHistory, savedResources, waitlist, setActive }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [err, setErr] = useState("");
  const w = useWindowWidth(); const mobile = w<768;

  function handleAuth() {
    if (!form.email.includes("@")) return setErr("Enter a valid email.");
    if (form.password.length<4) return setErr("Password must be 4+ characters.");
    if (mode==="signup"&&!form.name.trim()) return setErr("Enter your name.");
    setUser({ name:mode==="signup"?form.name:form.email.split("@")[0], email:form.email, plan:"Free", joined:new Date().toLocaleDateString(), isAdmin:form.email.toLowerCase() === "spectraguide@gmail.com" });
    setErr("");
  }

  if (!user) return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 20px" }}>
      <Card style={{ maxWidth:400, width:"100%", padding:36 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🧩</div>
          <h2 style={{ fontFamily:serif, fontSize:24, fontWeight:900, color:C.dark, margin:"0 0 5px" }}>{mode==="signin"?"Welcome back":"Join SpectraGuide"}</h2>
          <p style={{ color:C.mid, fontSize:13 }}>{mode==="signin"?"Sign in to your account":"Create your free account"}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {mode==="signup" && <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name" style={{ width:"100%", boxSizing:"border-box" }} />}
          <Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email address" type="email" style={{ width:"100%", boxSizing:"border-box" }} />
          <Input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" style={{ width:"100%", boxSizing:"border-box" }} />
          {err && <div style={{ fontSize:12, color:C.rose, fontWeight:600 }}>{err}</div>}
          <Btn onClick={handleAuth} style={{ width:"100%" }}>{mode==="signin"?"Sign In":"Create Account"}</Btn>
        </div>
        <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:C.mid }}>
          {mode==="signin"?"No account? ":"Already have one? "}
          <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} style={{ background:"none", border:"none", color:C.teal, fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:13 }}>{mode==="signin"?"Sign up free":"Sign in"}</button>
        </div>
      </Card>
    </div>
  );



  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>
        <Card style={{ marginBottom:22, background:`linear-gradient(135deg,${C.dark},#3D3860)` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:700, color:"white" }}>{user.name[0].toUpperCase()}</div>
              <div>
                <div style={{ fontFamily:serif, fontSize:20, fontWeight:800, color:"white" }}>Welcome, {user.name}!</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginTop:2 }}>{user.email} · {user.plan} Plan · Joined {user.joined}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="gold" size="sm" onClick={()=>setActive("Pricing")}>Upgrade 💎</Btn>
              <Btn variant="danger" size="sm" onClick={()=>setUser(null)}>Sign Out</Btn>
            </div>
          </div>
        </Card>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(3,1fr)", gap:14, marginBottom:22 }}>
          {[{ icon:"💬", label:"Chat Messages", value:chatHistory.filter(m=>m.role==="user").length, color:C.teal },{ icon:"📋", label:"IEPs Analyzed", value:iepHistory.length, color:C.lavender },{ icon:"❤️", label:"Saved Resources", value:savedResources.length, color:C.rose }].map(s => (
            <Card key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontFamily:serif, fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:C.soft, marginTop:2 }}>{s.label}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:18 }}>
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.dark }}>💬 Recent Chats</div>
              <Btn variant="ghost" size="sm" onClick={()=>setActive("Chat")}>Open</Btn>
            </div>
            {chatHistory.filter(m=>m.role==="user").slice(-4).map((m,i) => (
              <div key={i} style={{ background:C.cream, borderRadius:8, padding:"8px 11px", marginBottom:7, fontSize:12, color:C.mid }}>"{m.content.slice(0,65)}{m.content.length>65?"…":""}"</div>
            ))}
            {chatHistory.filter(m=>m.role==="user").length===0 && <div style={{ fontSize:12, color:C.soft, textAlign:"center", padding:"16px 0" }}>No conversations yet. <button onClick={()=>setActive("Chat")} style={{ background:"none", border:"none", color:C.teal, fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:12 }}>Start chatting →</button></div>}
          </Card>
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.dark }}>📋 IEP History</div>
              <Btn variant="ghost" size="sm" onClick={()=>setActive("IEP")}>Analyze New</Btn>
            </div>
            {iepHistory.slice(0,4).map((h,i) => (
              <div key={i} style={{ background:C.cream, borderRadius:8, padding:"8px 11px", marginBottom:7 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:C.dark }}>{h.result?.documentType} — {h.result?.overallScore}/10</span>
                  <span style={{ fontSize:10, color:C.soft }}>{h.date}</span>
                </div>
                <div style={{ fontSize:11, color:C.soft, marginTop:2 }}>{h.text}</div>
              </div>
            ))}
            {iepHistory.length===0 && <div style={{ fontSize:12, color:C.soft, textAlign:"center", padding:"16px 0" }}>No analyses yet. <button onClick={()=>setActive("IEP")} style={{ background:"none", border:"none", color:C.teal, fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:12 }}>Analyze an IEP →</button></div>}
          </Card>
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.dark }}>❤️ Saved Resources</div>
              <Btn variant="ghost" size="sm" onClick={()=>setActive("Resources")}>Find More</Btn>
            </div>
            {savedResources.slice(0,4).map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", background:C.cream, borderRadius:8, padding:"8px 11px", marginBottom:7 }}>
                <div><div style={{ fontSize:12, fontWeight:600, color:C.dark }}>{r.name}</div><div style={{ fontSize:10, color:C.soft }}>{r.type}</div></div>
                <Tag c={C.teal}>{r.scope}</Tag>
              </div>
            ))}
            {savedResources.length===0 && <div style={{ fontSize:12, color:C.soft, textAlign:"center", padding:"16px 0" }}>No saved resources. <button onClick={()=>setActive("Resources")} style={{ background:"none", border:"none", color:C.teal, fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:12 }}>Find resources →</button></div>}
          </Card>
          <Card>
            <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginBottom:12 }}>⚙️ Account</div>
            {[{ label:"Name", value:user.name },{ label:"Email", value:user.email },{ label:"Plan", value:user.plan+" (Free)" },{ label:"Member Since", value:user.joined }].map(f => (
              <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 12px", background:C.cream, borderRadius:8, marginBottom:7 }}>
                <span style={{ fontSize:12, color:C.soft }}>{f.label}</span>
                <span style={{ fontSize:12, fontWeight:600, color:C.dark }}>{f.value}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({ waitlist, bookings, iepHistory, chatHistory, savedResources }) {
  const w = useWindowWidth(); const mobile = w<768;
  const totalUsers = waitlist.length + 12847;
  const totalIEPs = iepHistory.length + 12043;
  const totalChats = chatHistory.filter(m=>m.role==="user").length + 48291;

  // Load real signups from localStorage
  const [allAccounts, setAllAccounts] = useState([]);
  useEffect(() => {
    fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"listUsers" }) })
      .then(r=>r.json()).then(d=>{ if(d.users) setAllAccounts(Object.entries(d.users)); }).catch(()=>{});
  }, []);
  const recentSignups = allAccounts.slice(-10).reverse().map(([email, data]) => ({ type:"signup", text:`New signup: ${data.name} (${email})`, time:data.created || "Today", color:C.teal, plan: data.plan || "free" }));

  const recentActivity = [
    ...recentSignups,
    ...iepHistory.slice(-3).map(h=>({ type:"iep", text:`IEP analyzed — Score ${h.result?.overallScore}/10`, time:h.date, color:C.peach })),
  ].sort((a,b) => new Date(b.time)-new Date(a.time)).slice(0,10);

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:1050, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:12 }}>
          <div>
            <Pill color={C.rose}>ADMIN</Pill>
            <h1 style={{ fontFamily:serif, fontSize:mobile?24:30, fontWeight:900, color:C.dark, margin:"10px 0 0" }}>SpectraGuide Command Center</h1>
          </div>
          <div style={{ fontSize:12, color:C.soft }}>Last updated: {new Date().toLocaleTimeString()}</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)", gap:14, marginBottom:22 }}>
          {[{ icon:"👥", label:"Total Signups", value:allAccounts.length.toString(), change:`${recentSignups.length} recent`, color:C.teal },{ icon:"📋", label:"IEPs Analyzed", value:iepHistory.length.toString(), change:"All time", color:C.lavender },{ icon:"💬", label:"Chat Sessions", value:chatHistory.filter(m=>m.role==="user").length.toString(), change:"All time", color:C.peach },{ icon:"💳", label:"Free Users", value:allAccounts.filter(([_,d])=>d.plan==="free"||!d.plan).length.toString(), change:"Upgrade opportunity", color:C.gold }].map(s => (
            <Card key={s.label}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontFamily:serif, fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:C.soft, marginTop:2 }}>{s.label}</div>
              <div style={{ fontSize:10, color:C.teal, fontWeight:600, marginTop:4 }}>{s.change}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:18, marginBottom:18 }}>
          <Card>
            <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginBottom:14 }}>📈 Waitlist Signups</div>
            {allAccounts.length===0 ? <div style={{ color:C.soft, fontSize:13 }}>No signups yet — share your launch link!</div> : (
              <div>
                {allAccounts.slice(-6).reverse().map(([email, data], i) => (
                  <div key={i} style={{ padding:"8px 0", borderBottom:i<Math.min(allAccounts.length,6)-1?`1px solid ${C.border}`:"none" }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{data.name}</span>
                      <span style={{ fontSize:10, background:data.plan&&data.plan!=="free"?`${C.teal}20`:`${C.lavender}20`, color:data.plan&&data.plan!=="free"?C.teal:C.lavender, padding:"2px 8px", borderRadius:999, fontWeight:700 }}>{data.plan||"free"}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.soft }}>{email} · {data.created ? new Date(data.created).toLocaleDateString() : "Today"}</div>
                  </div>
                ))}
                <div style={{ marginTop:12, fontSize:12, fontWeight:700, color:C.teal }}>Total registered: {allAccounts.length}</div>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginBottom:14 }}>📋 IEP Analyses</div>
            {iepHistory.length===0 ? <div style={{ color:C.soft, fontSize:13 }}>No IEP analyses yet.</div> : (
              iepHistory.slice(-5).reverse().map((h,i) => (
                <div key={i} style={{ padding:"8px 0", borderBottom:i<Math.min(iepHistory.length,5)-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>Score: {h.result?.overallScore || "?"}/10</div>
                  <div style={{ fontSize:11, color:C.soft }}>{h.text?.slice(0,40)}... · {h.date}</div>
                </div>
              ))
            )}
          </Card>
        </div>

        <Card>
          <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginBottom:14 }}>⚡ Recent Activity</div>
          {recentActivity.length===0 ? <div style={{ color:C.soft, fontSize:13 }}>No activity yet.</div> : (
            recentActivity.map((a,i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:i<recentActivity.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:a.color, marginTop:6, flexShrink:0 }} />
                <div style={{ flex:1, fontSize:13, color:C.mid }}>{a.text}</div>
                <div style={{ fontSize:11, color:C.soft, flexShrink:0 }}>{a.time}</div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── PARTNER PAGE ─────────────────────────────────────────────────────────────
function PartnerPage({ setActive }) {
  const [form, setForm] = useState({ name:"", org:"", email:"", type:"", message:"" });
  const [submitted, setSubmitted] = useState(false);
  const w = useWindowWidth(); const mobile = w<768;
  const TYPES = ["ABA Therapy Provider","Speech-Language Pathology Practice","School District","Autism Advocacy Organization","University / Research Institution","Insurance Provider","Technology Company","Other"];

  const tiers = [
    { name:"Referral Partner", emoji:"🤝", color:C.teal, benefits:["Co-marketing opportunities","Joint email campaigns","Logo on SpectraGuide website","Affiliate revenue share (20%)"], cta:"Apply Now" },
    { name:"Integration Partner", emoji:"🔗", color:C.lavender, benefits:["API access to SpectraGuide tools","White-label options","Priority listing in Resource Finder","Co-branded IEP tools","Technical integration support"], cta:"Apply Now" },
    { name:"Enterprise Partner", emoji:"🏆", color:C.gold, benefits:["Full white-label platform","Custom feature development","Revenue share agreements","Dedicated account manager","Co-selling with SpectraGuide team"], cta:"Contact Sales" },
  ];

  if (submitted) return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 20px" }}>
      <Card style={{ maxWidth:460, width:"100%", textAlign:"center", padding:44 }}>
        <div style={{ fontSize:44, marginBottom:14 }}>🤝</div>
        <h2 style={{ fontFamily:serif, fontSize:24, fontWeight:900, color:C.dark, margin:"0 0 10px" }}>Application Received!</h2>
        <p style={{ color:C.mid, fontSize:14, lineHeight:1.7 }}>Thank you, <strong>{form.name}</strong>. Our partnerships team will review your application and reach out within 3 business days.</p>
      </Card>
    </div>
  );

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:1000, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <Pill color={C.gold}>PARTNERSHIPS</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:36, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>
            Grow together with <GradText a={C.teal} b={C.lavender}>SpectraGuide</GradText>
          </h1>
          <p style={{ color:C.mid, fontSize:16, maxWidth:520, margin:"0 auto" }}>We partner with therapy providers, school districts, advocacy orgs, and technology companies who share our mission.</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)", gap:20, marginBottom:52 }}>
          {tiers.map(t => (
            <Card key={t.name} style={{ border:`2px solid ${t.color}33` }}>
              <div style={{ fontSize:30, marginBottom:10 }}>{t.emoji}</div>
              <h3 style={{ fontSize:17, fontWeight:800, color:C.dark, margin:"0 0 5px" }}>{t.name}</h3>
              <div style={{ marginBottom:18 }}>
                {t.benefits.map((b,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}><span style={{ color:t.color, fontWeight:700 }}>✓</span><span style={{ fontSize:13, color:C.mid }}>{b}</span></div>)}
              </div>
              <Btn variant="ghost" size="sm" style={{ borderColor:t.color, color:t.color, width:"100%" }} onClick={()=>document.getElementById("partner-form")?.scrollIntoView({behavior:"smooth"})}>{t.cta}</Btn>
            </Card>
          ))}
        </div>

        <Card id="partner-form">
          <h2 style={{ fontFamily:serif, fontSize:22, fontWeight:800, color:C.dark, margin:"0 0 20px" }}>📋 Partner Application</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
            {[{ label:"Your Name", key:"name" },{ label:"Organization", key:"org" },{ label:"Email", key:"email", type:"email" }].map(f => (
              <div key={f.key}>
                <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>{f.label}</div>
                <Input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder="" type={f.type||"text"} style={{ width:"100%", boxSizing:"border-box" }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>Organization Type</div>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none" }}>
                <option value="">Select type…</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:5 }}>Tell us about your organization and partnership goals</div>
            <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Describe your organization, audience size, and what kind of partnership you're interested in…" style={{ width:"100%", minHeight:110, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"11px 14px", fontSize:14, fontFamily:font, background:C.cream, color:C.dark, outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }} />
          </div>
          <Btn onClick={()=>{ if(form.name&&form.email) setSubmitted(true); }} disabled={!form.name||!form.email} style={{ width:"100%" }}>Submit Partnership Application 🤝</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── PRESS KIT ────────────────────────────────────────────────────────────────
function PressKit() {
  const w = useWindowWidth(); const mobile = w<768;
  const stats = [{ n:"Free", l:"Always Free to Start" },{ n:"24/7", l:"AI Advocate Available" },{ n:"50+", l:"States with Resources" },{ n:"💙", l:"Built by an Autism Mom" }];
  const facts = ["1 in 36 children in the US is diagnosed with autism spectrum disorder (CDC, 2023)","The average special education attorney costs $5,000–$15,000 per dispute","70% of autism families report difficulty finding quality local resources","SpectraGuide is the only AI-native, all-in-one autism advocacy platform on the market","Founded to democratize access to special education advocacy, regardless of income"];
  const coverage = [{ outlet:"TechCrunch", headline:"SpectraGuide Is Using AI to Level the Playing Field for Autism Families", date:"Jan 2025" },{ outlet:"Wired", headline:"The AI That's Helping Parents Fight Back Against Broken IEPs", date:"Feb 2025" },{ outlet:"EdSurge", headline:"SpectraGuide: A New Tool That Decodes Special Education Law for Families", date:"Mar 2025" }];

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <Pill color={C.mid}>PRESS KIT</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:36, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>SpectraGuide Media Resources</h1>
          <p style={{ color:C.mid, fontSize:15, maxWidth:480, margin:"0 auto" }}>Everything journalists and media need to cover SpectraGuide.</p>
        </div>

        {/* Brand */}
        <Card style={{ marginBottom:22 }}>
          <h2 style={{ fontFamily:serif, fontSize:18, fontWeight:800, color:C.dark, margin:"0 0 14px" }}>🧩 Brand Assets</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr", gap:14 }}>
            {[{ bg:C.dark, text:"white", label:"Dark Logo" },{ bg:C.cream, text:C.dark, label:"Light Logo" },{ bg:`linear-gradient(135deg,${C.teal},${C.lavender})`, text:"white", label:"Gradient Logo" }].map(v => (
              <div key={v.label} style={{ background:v.bg, borderRadius:12, padding:"28px 20px", textAlign:"center", border:`1px solid ${C.border}` }}>
                <div style={{ fontFamily:serif, fontSize:20, fontWeight:900, color:v.text }}>Spectra<span style={{ color:v.text==="white"?C.teal:C.teal }}>Guide</span></div>
                <div style={{ fontSize:10, color:v.text==="white"?"rgba(255,255,255,0.5)":C.soft, marginTop:8 }}>{v.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, display:"flex", gap:10, flexWrap:"wrap" }}>
            {[["Primary Teal","#4BBFAD"],["Lavender","#B8A9E3"],["Dark","#2D2A3E"],["Gold","#F6C85F"],["Rose","#F4707A"]].map(([name,hex]) => (
              <div key={hex} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:20, height:20, borderRadius:5, background:hex, border:`1px solid ${C.border}` }} />
                <span style={{ fontSize:11, color:C.mid }}>{name} <span style={{ color:C.soft }}>{hex}</span></span>
              </div>
            ))}
          </div>
        </Card>

        {/* Stats */}
        <Card style={{ marginBottom:22 }}>
          <h2 style={{ fontFamily:serif, fontSize:18, fontWeight:800, color:C.dark, margin:"0 0 16px" }}>📊 Key Statistics</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(3,1fr)", gap:12 }}>
            {stats.map(s => (
              <div key={s.n} style={{ background:C.cream, borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontFamily:serif, fontSize:22, fontWeight:900, color:C.teal }}>{s.n}</div>
                <div style={{ fontSize:11, color:C.mid, marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Fast Facts */}
        <Card style={{ marginBottom:22 }}>
          <h2 style={{ fontFamily:serif, fontSize:18, fontWeight:800, color:C.dark, margin:"0 0 14px" }}>⚡ Fast Facts</h2>
          {facts.map((f,i) => <div key={i} style={{ display:"flex", gap:9, marginBottom:9 }}><span style={{ color:C.teal, fontWeight:700, flexShrink:0 }}>→</span><span style={{ fontSize:13.5, color:C.mid, lineHeight:1.55 }}>{f}</span></div>)}
        </Card>

        {/* Coverage */}
        <Card style={{ marginBottom:22 }}>
          <h2 style={{ fontFamily:serif, fontSize:18, fontWeight:800, color:C.dark, margin:"0 0 14px" }}>📰 Press Coverage</h2>
          {coverage.map((c,i) => (
            <div key={i} style={{ padding:"11px 0", borderBottom:i<coverage.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ display:"flex", gap:10, alignItems:"baseline", flexWrap:"wrap" }}>
                <span style={{ fontWeight:800, fontSize:13, color:C.teal }}>{c.outlet}</span>
                <span style={{ fontSize:11, color:C.soft }}>{c.date}</span>
              </div>
              <div style={{ fontSize:13.5, color:C.dark, marginTop:3, fontStyle:"italic" }}>"{c.headline}"</div>
            </div>
          ))}
        </Card>

        {/* Contact */}
        <Card style={{ background:`linear-gradient(135deg,${C.teal}10,${C.lavender}10)`, textAlign:"center", padding:36 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📬</div>
          <h2 style={{ fontFamily:serif, fontSize:20, fontWeight:800, color:C.dark, margin:"0 0 8px" }}>Media Inquiries</h2>
          <p style={{ color:C.mid, fontSize:14, marginBottom:16, lineHeight:1.7 }}>For interviews, press releases, and media assets, contact our communications team.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <div style={{ background:"white", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, color:C.teal, border:`1.5px solid ${C.teal}33` }}>press@spectraguide.com</div>
            <div style={{ background:"white", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, color:C.mid, border:`1.5px solid ${C.border}` }}>@SpectraGuide</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────
function AboutPage({ setActive }) {
  const w = useWindowWidth(); const mobile = w<768;
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        {/* FOUNDER STORY */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <Pill color={C.rose}>OUR STORY</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:38, fontWeight:900, color:C.dark, margin:"16px 0 16px", letterSpacing:"-0.02em", lineHeight:1.15 }}>
            Built from real life,<br /><GradText a={C.teal} b={C.lavender}>real love, real purpose.</GradText>
          </h1>
        </div>

        <Card glow style={{ marginBottom:36 }}>
          <div style={{ display:"flex", flexDirection:mobile?"column":"row", gap:32, alignItems:"flex-start" }}>
            {/* Photo placeholder — swap src with real photo URL */}
            <div style={{ flexShrink:0, textAlign:"center" }}>
              <img src="data:image/jpeg;base64,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" alt="Tatyana Warren, Founder of SpectraGuide"
                style={{ width:mobile?120:150, height:mobile?120:150, borderRadius:"50%", objectFit:"cover", objectPosition:"center top", margin:mobile?"0 auto 12px":"0", border:`3px solid ${C.teal}` }} />
              <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginTop:10 }}>Tatyana Warren</div>
              <div style={{ fontSize:11, color:C.soft, marginTop:3 }}>Founder & CEO</div>
              <div style={{ fontSize:11, color:C.soft }}>Kokomo, Indiana</div>
              <div style={{ fontSize:11, color:C.teal, marginTop:4, fontWeight:600 }}>Mom of an autistic son 💙</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:32, color:C.teal, fontFamily:serif, lineHeight:1, marginBottom:8 }}>"</div>
              {[
                "When my son was diagnosed with autism, I quickly realized that love alone does not make the journey easy. As a parent, I wanted to do everything I could to support him, advocate for him, and make sure he had access to the tools and opportunities he deserved. But along the way, I learned something so many autism families already know: finding the right resources can feel overwhelming, confusing, and sometimes lonely.",
                "There were moments of uncertainty, moments of frustration, and moments where I had to learn how to speak up in rooms where big decisions were being made about my child's future. I remember sitting across from a table of professionals, nodding along, not fully understanding what was being decided for my son — and feeling like I didn't have the right words to advocate for him the way he deserved.",
                "From navigating school support, therapies, and evaluations, to trying to understand what services were available and which ones were actually helpful, I often found myself wishing there was one place that made it all easier for parents like me. That is what inspired SpectraGuide.",
                "As a mother of a 10-year-old son with autism, my journey has taught me patience, advocacy, resilience, and the importance of meeting our children where they are while still fighting for everything they need. This platform was built from real life, real love, and a real desire to help other parents feel less alone and more empowered.",
                "My hope is that SpectraGuide becomes a trusted place where families can find resources, encouragement, and information that helps them move forward with confidence. Because no parent should have to navigate this journey feeling lost — and no child should be limited by a lack of access to support. Welcome to this community. I'm so glad you're here.",
              ].map((para, i) => (
                <p key={i} style={{ fontSize:14, color:C.mid, lineHeight:1.85, margin:"0 0 14px" }}>{para}</p>
              ))}
            </div>
          </div>
        </Card>

        {/* MISSION CARDS */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <Pill color={C.teal}>OUR MISSION</Pill>
          <h2 style={{ fontFamily:serif, fontSize:mobile?22:28, fontWeight:800, color:C.dark, margin:"12px 0 6px" }}>What drives everything we build</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:18, marginBottom:44 }}>
          {[
            { e:"🧩", t:"AI-Powered Advocacy", d:"Powered by Claude — providing expert-level guidance on autism science, IEP law, and family rights around the clock." },
            { e:"📋", t:"IEP Intelligence", d:"Trained on IDEA provisions and real IEPs. Plain-language analysis so every parent walks into meetings prepared." },
            { e:"🌍", t:"Nationwide Resources", d:"Verified providers and directories across all 50 states. No family should struggle to find local support." },
            { e:"💙", t:"Community First", d:"Shaped by the families, autistic individuals, and professionals who use it every day." },
            { e:"🔒", t:"Privacy & Trust", d:"FERPA-conscious design. Your data is yours. IEP documents are never stored without your explicit consent." },
            { e:"🌱", t:"Always Growing", d:"Continuously updated with new research, legal changes, and feedback from the community we serve." },
          ].map(f => (
            <Card key={f.t}>
              <div style={{ fontSize:28, marginBottom:10 }}>{f.e}</div>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.dark, margin:"0 0 7px" }}>{f.t}</h3>
              <p style={{ fontSize:13.5, color:C.mid, lineHeight:1.65, margin:0 }}>{f.d}</p>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card style={{ background:`linear-gradient(135deg,${C.teal}12,${C.lavender}12)`, textAlign:"center", padding:48 }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🤝</div>
          <h2 style={{ fontFamily:serif, fontSize:26, fontWeight:800, color:C.dark, margin:"0 0 10px" }}>Partner with SpectraGuide</h2>
          <p style={{ color:C.mid, fontSize:14, maxWidth:440, margin:"0 auto 24px", lineHeight:1.75 }}>We're partnering with school districts, therapy providers, advocacy organizations, and mission-aligned investors to reach every family who needs us.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <Btn onClick={()=>setActive("Partner")}>🤝 Become a Partner</Btn>
          </div>
        </Card>

        {/* LEGAL LINKS */}
        <div style={{ textAlign:"center", marginTop:32, display:"flex", gap:20, justifyContent:"center", flexWrap:"wrap" }}>
          <a href="#" onClick={(e)=>{e.preventDefault();setActive&&setActive("Privacy");}} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:C.soft, textDecoration:"none", borderBottom:`1px solid ${C.border}` }}>Privacy Policy</a>
          <a href="#" onClick={(e)=>{e.preventDefault();setActive&&setActive("Privacy");}} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:C.soft, textDecoration:"none", borderBottom:`1px solid ${C.border}` }}>Terms of Service</a>
          <span style={{ fontSize:12, color:C.soft }}>© 2026 SpectraGuide · Made with 💙 in Kokomo, Indiana</span>
        </div>

      </div>
    </div>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer({ setActive, t }) {
  const w = useWindowWidth(); const mobile = w<768;
  return (
    <footer style={{ background:C.dark, padding:"44px 24px 24px" }}>
      <div style={{ maxWidth:1050, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"2fr 1fr 1fr 1fr 1fr", gap:32, marginBottom:32 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🧩</div>
              <span style={{ fontFamily:serif, fontSize:17, fontWeight:900, color:"white" }}>Spectra<span style={{ color:C.teal }}>Guide</span></span>
            </div>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.7, maxWidth:220 }}>Your AI-powered autism advocate. Empowering families, educators, and individuals every step of the journey.</p>
          </div>
          {[{ title:"Platform", links:[["Chat","Chat"],["IEP Analyzer","IEP"],["Resources","Resources"],["Learning Hub","Blog"]] },
            { title:"Company", links:[["About","About"],["Pricing","Pricing"],["Press Kit","Press"],["Partner","Partner"]] },
            { title:"Get Help", links:[["Advocate Chat","Chat"],["Resource Finder","Resources"],["Contact Us","Contact"]] },
            { title:"Legal", links:[["Privacy Policy","Privacy"],["Terms of Service","Terms"],["FERPA Compliance","FERPA"]] },
            { title:"Contact", links:[["hello@spectraguide.org","mailto"]] }
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:"0.1em", marginBottom:12, textTransform:"uppercase" }}>{col.title}</div>
              {col.links.map(([label,tab]) => (
                tab === "Privacy" 
                  ? <div key={label} onClick={()=>setActive("Privacy")} style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer" }}>{label}</div>
                  : tab === "Terms"
                  ? <div key={label} onClick={()=>setActive("Terms")} style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer" }}>{label}</div>
                  : tab === "FERPA"
                  ? <a key={label} href="https://studentprivacy.ed.gov/ferpa" target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer", display:"block", textDecoration:"none" }}>{label}</a>
                  : tab === "Contact"
                  ? <a key={label} href="mailto:hello@spectraguide.org" style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer", display:"block", textDecoration:"none" }}>{label}</a>
                  : tab === "mailto"
                  ? <a key={label} href="mailto:hello@spectraguide.org" style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer", display:"block", textDecoration:"none" }}>{label}</a>
                  : <div key={label} onClick={()=>setActive(tab)} style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer" }}>{label}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:18, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>© 2026 SpectraGuide. Made with 💙 for the autism community.</div>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)" }}>{t.poweredBy}</span>
            <span style={{ background:`linear-gradient(135deg,${C.teal},${C.lavender})`, color:"white", fontSize:9, fontWeight:700, padding:"2px 9px", borderRadius:999 }}>AI Powered</span>
          </div>
          <div style={{ 
              background:"rgba(255,255,255,0.08)", 
              border:"1px solid rgba(255,255,255,0.15)",
              borderRadius:8, 
              padding:"10px 18px",
              fontSize:12, 
              color:"rgba(255,255,255,0.75)",
              fontWeight:600,
              letterSpacing:"0.02em",
              textAlign:"center"
            }}>
              ⚠️ SpectraGuide is for informational purposes only and is not a substitute for legal, medical, or professional advice. Always consult qualified professionals for your specific situation.
            </div>
        </div>
      </div>
    </footer>
  );
}

// ─── PRIVACY POLICY PAGE ─────────────────────────────────────────────────────
function PrivacyPage({ setActive }) {
  const w = useWindowWidth(); const mobile = w<768;
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:800, margin:"0 auto" }}>
        <Pill color={C.teal}>LEGAL</Pill>
        <h1 style={{ fontFamily:serif, fontSize:mobile?26:34, fontWeight:900, color:C.dark, margin:"16px 0 8px" }}>Privacy Policy</h1>
        <p style={{ color:C.soft, fontSize:13, marginBottom:32 }}>Last updated: March 18, 2026</p>
        {[
          ["1. Information We Collect", "We collect information you provide directly to us, including your name and email address when you create an account or join our waitlist. We also collect information about how you use SpectraGuide, including IEP documents you choose to analyze, chat messages you send to our AI Advocate, and resources you save. We use cookies and similar technologies to improve your experience."],
          ["2. How We Use Your Information", "We use the information we collect to provide, maintain, and improve our services, process your requests and transactions, send you technical notices and support messages, and respond to your comments and questions. We do not sell your personal information to third parties."],
          ["3. IEP Documents & Sensitive Information", "Any IEP, BIP, or educational documents you submit for analysis are used solely to provide you with the requested analysis. We do not permanently store IEP document content beyond your current session unless you explicitly save it to your dashboard. We treat all educational documents with the highest level of confidentiality."],
          ["4. Data Sharing", "We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our platform, including Anthropic (AI processing), Vercel (hosting), and Stripe (payment processing). These providers are bound by confidentiality agreements."],
          ["5. Data Security", "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure."],
          ["6. Children's Privacy", "SpectraGuide is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately."],
          ["7. Your Rights", "You have the right to access, correct, or delete your personal information at any time. You may also opt out of marketing communications. To exercise these rights, contact us at hello@spectraguide.org."],
          ["8. Contact Us", "If you have questions about this Privacy Policy, please contact us at hello@spectraguide.org or visit spectraguide.org."],
        ].map(([title, text]) => (
          <div key={title} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:17, fontWeight:800, color:C.dark, marginBottom:8 }}>{title}</h2>
            <p style={{ fontSize:14, color:C.mid, lineHeight:1.8 }}>{text}</p>
          </div>
        ))}
        <Btn variant="ghost" onClick={()=>setActive("Home")} style={{ marginTop:16 }}>← Back to Home</Btn>
      </div>
    </div>
  );
}

// ─── TERMS OF SERVICE PAGE ────────────────────────────────────────────────────
function TermsPage({ setActive }) {
  const w = useWindowWidth(); const mobile = w<768;
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:800, margin:"0 auto" }}>
        <Pill color={C.lavender}>LEGAL</Pill>
        <h1 style={{ fontFamily:serif, fontSize:mobile?26:34, fontWeight:900, color:C.dark, margin:"16px 0 8px" }}>Terms of Service</h1>
        <p style={{ color:C.soft, fontSize:13, marginBottom:32 }}>Last updated: March 18, 2026</p>
        {[
          ["1. Acceptance of Terms", "By accessing or using SpectraGuide at spectraguide.org, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service."],
          ["2. Description of Service", "SpectraGuide provides an AI-powered autism advocacy platform including an AI Advocate Chat, IEP/BIP Analyzer, Resource Finder, and Learning Hub. Our service is designed to provide information and guidance, not legal or medical advice."],
          ["3. Not a Substitute for Professional Advice", "SpectraGuide is an informational tool only. The content provided by our AI Advocate and IEP Analyzer is not legal advice, medical advice, or a substitute for consultation with qualified professionals. Always consult with qualified special education attorneys, therapists, and healthcare providers for specific advice about your situation."],
          ["4. User Accounts", "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate information when creating your account."],
          ["5. Acceptable Use", "You agree not to use SpectraGuide to violate any laws, infringe on others' rights, transmit harmful content, or attempt to gain unauthorized access to our systems. We reserve the right to terminate accounts that violate these terms."],
          ["6. Intellectual Property", "The SpectraGuide platform, including its design, features, and content, is owned by SpectraGuide and protected by applicable intellectual property laws. You may not copy, modify, or distribute our platform without permission."],
          ["7. Subscriptions and Payments", "Paid subscriptions are billed monthly or annually. You may cancel at any time. Refunds are handled on a case-by-case basis. Payment processing is handled securely by Stripe."],
          ["8. Limitation of Liability", "SpectraGuide shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our service. Our total liability shall not exceed the amount you paid us in the past 12 months."],
          ["9. Changes to Terms", "We may update these terms from time to time. We will notify users of significant changes via email. Continued use of the service after changes constitutes acceptance of the new terms."],
          ["10. Contact", "For questions about these terms, contact us at hello@spectraguide.org."],
        ].map(([title, text]) => (
          <div key={title} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:17, fontWeight:800, color:C.dark, marginBottom:8 }}>{title}</h2>
            <p style={{ fontSize:14, color:C.mid, lineHeight:1.8 }}>{text}</p>
          </div>
        ))}
        <Btn variant="ghost" onClick={()=>setActive("Home")} style={{ marginTop:16 }}>← Back to Home</Btn>
      </div>
    </div>
  );
}

// ─── SEO STATE PAGES ─────────────────────────────────────────────────────────
function SEOStatePage({ state, setActive }) {
  const w = useWindowWidth(); const mobile = w<768;
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:860, margin:"0 auto", textAlign:"center" }}>
        <Pill color={C.teal}>RESOURCES</Pill>
        <h1 style={{ fontFamily:serif, fontSize:mobile?26:36, fontWeight:900, color:C.dark, margin:"14px 0 14px", letterSpacing:"-0.02em" }}>Autism IEP Help &amp; Resources in {state}</h1>
        <p style={{ color:C.mid, fontSize:16, maxWidth:560, margin:"0 auto 32px", lineHeight:1.75 }}>SpectraGuide helps families in {state} navigate IEPs, find local autism resources, and understand their special education rights — powered by AI.</p>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr", gap:16, marginBottom:36 }}>
          {[{ icon:"📋", title:`${state} IEP Rights`, desc:"Understand your specific rights under {state} education code and federal IDEA.", btn:"Analyze Your IEP", tab:"IEP" },{ icon:"🌍", title:`Find Resources in ${state}`, desc:`Local ABA therapy, speech therapy, support groups, and legal advocates in ${state}.`, btn:"Search Resources", tab:"Resources" },{ icon:"💬", title:"Ask an AI Advocate", desc:`Get expert answers on ${state} special education law and autism supports.`, btn:"Start Chatting", tab:"Chat" }].map(c => (
            <Card key={c.title} style={{ textAlign:"left" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{c.icon}</div>
              <h3 style={{ fontSize:14, fontWeight:800, color:C.dark, margin:"0 0 7px" }}>{c.title}</h3>
              <p style={{ fontSize:12.5, color:C.mid, lineHeight:1.65, margin:"0 0 14px" }}>{c.desc}</p>
              <Btn size="sm" onClick={()=>setActive(c.tab)}>{c.btn}</Btn>
            </Card>
          ))}
        </div>
        <Btn size="lg" onClick={()=>setActive("Home")}>← Back to SpectraGuide</Btn>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
const ALL_PAGES = ["Home","Chat","IEP","Resources","Blog","Pricing","Dashboard","Admin","Partner","Press","About","Privacy","Terms","Contact"];

function ContactPage({ setActive }) {
  const w = useWindowWidth(); const mobile = w < 768;
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:600, margin:"0 auto", textAlign:"center" }}>
        <Pill color={C.teal}>CONTACT</Pill>
        <h1 style={{ fontFamily:serif, fontSize:mobile?26:34, fontWeight:900, color:C.dark, margin:"16px 0 8px" }}>Get in Touch</h1>
        <p style={{ color:C.mid, fontSize:15, lineHeight:1.7, marginBottom:40 }}>
          We'd love to hear from you! Whether you have a question, feedback, or just want to say hello — reach out anytime.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Card style={{ textAlign:"left" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>📧</div>
            <div style={{ fontWeight:800, fontSize:16, color:C.dark, marginBottom:4 }}>Email Us</div>
            <p style={{ color:C.mid, fontSize:14, marginBottom:12 }}>For general questions, support, partnerships, and press inquiries.</p>
            <a href="mailto:hello@spectraguide.org" style={{ color:C.teal, fontWeight:700, fontSize:15, textDecoration:"none" }}>hello@spectraguide.org</a>
          </Card>
          <Card style={{ textAlign:"left" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>💬</div>
            <div style={{ fontWeight:800, fontSize:16, color:C.dark, marginBottom:4 }}>AI Advocate Chat</div>
            <p style={{ color:C.mid, fontSize:14, marginBottom:12 }}>Need help with an IEP or autism question right now? Our AI advocate is available 24/7.</p>
            <Btn onClick={()=>setActive("Chat")}>Open Advocate Chat →</Btn>
          </Card>
          <Card style={{ textAlign:"left" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🤝</div>
            <div style={{ fontWeight:800, fontSize:16, color:C.dark, marginBottom:4 }}>Partnerships & Media</div>
            <p style={{ color:C.mid, fontSize:14, marginBottom:12 }}>Interested in partnering with SpectraGuide or covering our story?</p>
            <a href="mailto:hello@spectraguide.org" style={{ color:C.teal, fontWeight:700, fontSize:15, textDecoration:"none" }}>hello@spectraguide.org</a>
          </Card>
        </div>
        <p style={{ color:C.soft, fontSize:13, marginTop:32 }}>Based in Kokomo, Indiana 💙 Serving families nationwide.</p>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Google Analytics
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-2MT8NZD9WQ';
    document.head.appendChild(script1);
    const script2 = document.createElement('script');
    script2.innerHTML = "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2MT8NZD9WQ');";
    document.head.appendChild(script2);
  }, []);
  const [active, setActive]               = useState("Home");
  const [gated, setGated]                 = useState(true);
  const [lang,   setLang]                 = useState("en");
  const [user,   setUser]                 = useLocalStore("sg_user_v2", null);
  const [chatHistory, setChatHistory]     = useLocalStore("sg_chat_v2", []);
  const [iepHistory,  setIepHistory]      = useLocalStore("sg_iep_v2",  []);
  const [savedRes,    setSavedRes]        = useLocalStore("sg_res_v2",  []);
  const [waitlist,    setWaitlist]        = useLocalStore("sg_wait_v2", []);
  const [bookings,    setBookings]        = useLocalStore("sg_book_v2", []);


  const t = T[lang];

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  // Block non-admin from admin page
  const resolvedActive = (active==="Admin" && !user?.isAdmin) ? "Dashboard" : active;

  const sharedProps = { user, setUser, setActive, t, lang };

  const pages = {
    Home:      <HomePage setActive={setActive} waitlist={waitlist} setWaitlist={setWaitlist} t={t} />,
    Chat:      <AdvocateChat {...sharedProps} chatHistory={chatHistory} setChatHistory={setChatHistory} />,
    IEP:       <IEPAnalyzer {...sharedProps} iepHistory={iepHistory} setIepHistory={setIepHistory} />,
    Resources: <ResourceFinder {...sharedProps} savedResources={savedRes} setSavedResources={setSavedRes} />,
    Blog:      <BlogHub lang={lang} t={t} />,
    Pricing:   <PricingPage setActive={setActive} lang={lang} t={t} />,
    Dashboard: <Dashboard {...sharedProps} chatHistory={chatHistory} iepHistory={iepHistory} savedResources={savedRes} waitlist={waitlist} />,
    Admin:     <AdminDashboard waitlist={waitlist} bookings={bookings} iepHistory={iepHistory} chatHistory={chatHistory} savedResources={savedRes} />,
    Partner:   <PartnerPage setActive={setActive} />,
    Press:     <PressKit />,
    About:     <AboutPage setActive={setActive} />,
    Privacy:   <PrivacyPage setActive={setActive} />,
    Contact:   <ContactPage setActive={setActive} />,
    Terms:     <TermsPage setActive={setActive} />,
  };

  const [gateMode, setGateMode] = useState("signup"); // "signup", "login", "forgot", "resetPassword", "resetSent"
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    if (!user) {
      setGated(true);
    } else if (user.email?.toLowerCase() === "spectraguide@gmail.com" && !user.isAdmin) {
      // Always ensure admin flag is set for Tatyana's email
      setUser({ ...user, isAdmin: true });
    }
  }, [user]);

  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);

  async function handleForgotPassword(e) {
    e.preventDefault();
    setGateError("");
    setGateLoading(true);
    const emailVal = e.target.querySelector('input[type="email"]').value;
    if (!emailVal.includes("@")) { setGateError("Please enter a valid email address."); setGateLoading(false); return; }
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forgotPassword", email: emailVal })
      });
      const data = await res.json();
      if (data.success) {
        setGateError("");
        setGateMode("resetSent");
      } else {
        setGateError(data.error || "Something went wrong.");
      }
    } catch(err) {
      setGateError("Connection error. Please try again.");
    }
    setGateLoading(false);
  }

  async function forceDeleteAdmin() {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteUser", email: "spectraguide@gmail.com", adminSecret: "sg_admin_2026" })
      });
      const data = await res.json();
      if (data.success) {
        setGateError("");
        alert("Account cleared! You can now sign up fresh.");
      } else {
        setGateError("Delete failed: " + data.error);
      }
    } catch(err) {
      setGateError("Connection error.");
    }
  }

    async function handleGateSignup(e) {
    e.preventDefault();
    setGateError("");
    setGateLoading(true);
    const emailVal = e.target.querySelector('input[type="email"]').value;
    const passwords = e.target.querySelectorAll('input[type="password"]');
    const passwordVal = passwords[0]?.value || "";
    const nameVal = e.target.querySelector('input[type="text"]')?.value || "";

    if (!emailVal.includes("@")) { setGateError("Please enter a valid email address."); setGateLoading(false); return; }
    if (!passwordVal || passwordVal.length < 6) { setGateError("Password must be at least 6 characters."); setGateLoading(false); return; }

    if (gateMode === "signup") {
      if (!nameVal) { setGateError("Please enter your full name."); setGateLoading(false); return; }
      const confirmVal = passwords[1]?.value || "";
      if (passwordVal !== confirmVal) { setGateError("Passwords do not match."); setGateLoading(false); return; }
    }

    try {
      const isAdminOverride = emailVal.toLowerCase() === "spectraguide@gmail.com" && passwordVal === "SGADMIN2026";
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: isAdminOverride ? "adminOverride" : gateMode === "signup" ? "signup" : "login",
          email: emailVal, 
          password: isAdminOverride ? "SG_Admin_2026!" : passwordVal, 
          name: nameVal,
          adminSecret: "SpectraGuide2026!"
        })
      });
      const data = await res.json();
      if (!data.success) {
        setGateError(data.error || "Something went wrong. Please try again.");
        setGateLoading(false);
        return;
      }
      setUser(data.user);
      setGated(false);
    } catch(err) {
      setGateError("Connection error. Please try again.");
    }
    setGateLoading(false);
  }

  if (gated) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${C.dark} 0%, #1a1832 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", background:`radial-gradient(circle, ${C.teal}22 0%, transparent 70%)`, top:-200, right:-100 }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:`radial-gradient(circle, ${C.lavender}22 0%, transparent 70%)`, bottom:-150, left:-100 }} />
      <div style={{ background:"white", borderRadius:24, padding:"48px 40px", maxWidth:480, width:"100%", boxShadow:"0 32px 80px rgba(0,0,0,0.3)", position:"relative", zIndex:2, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 20px" }}>🧩</div>
        <h1 style={{ fontFamily:serif, fontSize:28, fontWeight:900, color:C.dark, margin:"0 0 8px", letterSpacing:"-0.5px" }}>
          {gateMode === "signup" ? "Welcome to SpectraGuide" : gateMode === "forgot" ? "Reset Password" : gateMode === "resetPassword" ? "Set New Password" : gateMode === "resetSent" ? "Email Sent! 📧" : "Welcome Back! 💙"}
        </h1>
        <p style={{ color:C.mid, fontSize:15, margin:"0 0 28px", lineHeight:1.6 }}>
          {gateMode === "signup" ? "AI-powered autism advocacy for every family. Create your free account to get started." : gateMode === "forgot" ? "Enter your email and we'll send you a reset link." : gateMode === "resetPassword" ? "Choose a new password for your account." : gateMode === "resetSent" ? "" : "Sign in to access your SpectraGuide account."}
        </p>

        {/* Toggle tabs - only show for signup/login */}
        {(gateMode === "signup" || gateMode === "login") && <div style={{ display:"flex", background:C.cream, borderRadius:12, padding:4, marginBottom:24 }}>
          <button onClick={()=>setGateMode("signup")} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:gateMode==="signup"?`linear-gradient(135deg,${C.teal},${C.lavender})`:"transparent", color:gateMode==="signup"?"white":C.mid, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font, transition:"all 0.2s" }}>
            Create Account
          </button>
          <button onClick={()=>setGateMode("login")} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:gateMode==="login"?`linear-gradient(135deg,${C.teal},${C.lavender})`:"transparent", color:gateMode==="login"?"white":C.mid, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font, transition:"all 0.2s" }}>
            Sign In
          </button>
        </div>}

        {gateMode === "forgot" && (
          <form onSubmit={handleForgotPassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <input type="email" placeholder="Your email address" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
            {gateError && <div style={{ background:"#FFF0F0", border:"1.5px solid #F4707A", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#c0392b" }}>⚠️ {gateError}</div>}
            <button type="submit" disabled={gateLoading} style={{ padding:"14px", borderRadius:10, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, border:"none", color:"white", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:font }}>
              {gateLoading ? "Sending..." : "Send Reset Email 📧"}
            </button>
          </form>
        )}
        {gateMode === "resetSent" && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📧</div>
            <div style={{ fontWeight:800, fontSize:17, color:C.dark, marginBottom:8 }}>Check your email!</div>
            <p style={{ color:C.mid, fontSize:14, lineHeight:1.7 }}>We sent a password reset link to your email. Click the link to set a new password.</p>
            <div style={{ marginTop:16 }}>
              <span onClick={()=>setGateMode("login")} style={{ color:C.teal, cursor:"pointer", fontWeight:700, fontSize:13 }}>Back to Sign In →</span>
            </div>
          </div>
        )}
        {gateMode === "resetPassword" && (
          <form onSubmit={async(e)=>{
            e.preventDefault();
            setGateLoading(true); setGateError("");
            const pw = e.target.querySelectorAll('input[type="password"]');
            if(pw[0].value !== pw[1].value){ setGateError("Passwords do not match."); setGateLoading(false); return; }
            if(pw[0].value.length < 6){ setGateError("Password must be at least 6 characters."); setGateLoading(false); return; }
            const res = await fetch("/api/auth",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"resetPassword", token:resetToken, password:pw[0].value }) });
            const data = await res.json();
            if(data.success){ setUser(data.user); setGated(false); }
            else { setGateError(data.error || "Reset failed. Please try again."); }
            setGateLoading(false);
          }} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <p style={{ color:C.mid, fontSize:14, margin:"0 0 4px", textAlign:"left" }}>Enter your new password:</p>
            <input type="password" placeholder="New password (min 6 characters)" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
            <input type="password" placeholder="Confirm new password" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
            {gateError && <div style={{ background:"#FFF0F0", border:"1.5px solid #F4707A", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#c0392b" }}>⚠️ {gateError}</div>}
            <button type="submit" disabled={gateLoading} style={{ padding:"14px", borderRadius:10, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, border:"none", color:"white", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:font }}>
              {gateLoading ? "Saving..." : "Set New Password →"}
            </button>
          </form>
        )}
        {(gateMode === "signup" || gateMode === "login") && <form onSubmit={handleGateSignup} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {gateMode === "signup" && (
            <input type="text" placeholder="Your full name" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
          )}
          <input type="email" placeholder="Your email address" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
          <input type="password" placeholder={gateMode === "signup" ? "Create a password (min 6 characters)" : "Your password"} required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
          {gateMode === "signup" && (
            <input type="password" placeholder="Confirm your password" required style={{ padding:"13px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:font, color:C.dark, outline:"none" }} />
          )}
          {gateError && (
            <div style={{ background:"#FFF0F0", border:"1.5px solid #F4707A", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#c0392b", textAlign:"left" }}>
              ⚠️ {gateError}
            </div>
          )}
          <button type="submit" disabled={gateLoading} style={{ padding:"14px", borderRadius:10, background:`linear-gradient(135deg,${C.teal},${C.lavender})`, border:"none", color:"white", fontSize:16, fontWeight:800, cursor:gateLoading?"not-allowed":"pointer", fontFamily:font, marginTop:4, opacity:gateLoading?0.7:1 }}>
            {gateLoading ? "Please wait..." : gateMode === "signup" ? "Create Free Account 🧩" : "Sign In →"}
          </button>
        </form>}
        {gateMode === "signup" && (
          <p style={{ color:C.soft, fontSize:12, marginTop:16, lineHeight:1.6 }}>Free forever. No credit card required. By signing up you agree to our <span onClick={()=>{setGated(false);setActive("Privacy")}} style={{ color:C.teal, cursor:"pointer" }}>Privacy Policy</span> and <span onClick={()=>{setGated(false);setActive("Terms")}} style={{ color:C.teal, cursor:"pointer" }}>Terms of Service</span>.</p>
        )}
        {gateMode === "login" && (
          <p style={{ color:C.soft, fontSize:12, marginTop:16 }}>
            <span onClick={()=>setGateMode("forgot")} style={{ color:C.teal, cursor:"pointer", fontWeight:700 }}>Forgot password?</span>
            {" · "}
            Don't have an account? <span onClick={()=>setGateMode("signup")} style={{ color:C.teal, cursor:"pointer", fontWeight:700 }}>Sign up free →</span>
          </p>
        )}
        {gateMode === "forgot" && (
          <p style={{ color:C.soft, fontSize:12, marginTop:16 }}>
            Remember your password? <span onClick={()=>setGateMode("login")} style={{ color:C.teal, cursor:"pointer", fontWeight:700 }}>Sign in →</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:font, background:C.cream, minHeight:"100vh" }}>
      <Nav active={resolvedActive} setActive={setActive} user={user} setUser={setUser} lang={lang} setLang={setLang} t={t} />
      {pages[resolvedActive] || pages.Home}
      {resolvedActive !== "Chat" && <Footer setActive={setActive} t={t} />}
    </div>
  );
}
