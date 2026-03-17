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
const MODEL = "claude-sonnet-4-20250514"; // Verified working model for artifact API calls

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  en: {
    tagline:"Every child on the spectrum deserves a champion.",
    start:"Start a Conversation", analyzeIEP:"Analyze My IEP",
    chat:"Advocate Chat", iep:"IEP Analyzer", resources:"Find Resources",
    blog:"Learning Hub", pricing:"Pricing", dashboard:"Dashboard",
    about:"About", admin:"Admin", partner:"Partner", press:"Press",
    getStarted:"Get Started Free", signIn:"Sign In", signOut:"Sign Out",
    home:"Home", booking:"Book a Demo",
    heroSub:"SpectraGuide is your AI-powered autism advocate — helping families, educators, and individuals navigate IEPs, find resources, and understand their rights.",
    joinFree:"Join Free — It's Free", waitlistTitle:"Join 50,000+ families — free early access",
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
    home:"Inicio", booking:"Reservar Demo",
    heroSub:"SpectraGuide es tu defensor de autismo con IA — ayudando a familias, educadores e individuos a navegar los IEPs, encontrar recursos y comprender sus derechos.",
    joinFree:"Únete Gratis", waitlistTitle:"Únete a más de 50,000 familias — acceso temprano gratuito",
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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  const objMatch = raw.match(/\{[\s\S]*\}/);
  const match = arrMatch || objMatch;
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
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
const NAV_MAIN = ["Home","Chat","IEP","Resources","Blog","Pricing","Booking"];
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
  const [refCode] = useState(() => Math.random().toString(36).slice(2,8).toUpperCase());
  const w = useWindowWidth();
  const mobile = w < 768;

  function joinWaitlist() {
    if (!email.includes("@")) return;
    setWaitlist([...waitlist, { email, date:new Date().toLocaleDateString(), ref:refCode }]);
    setSubmitted(true);
  }

  const features = [
    { icon:"💬", label:"AI Advocate Chat", desc:"24/7 expert answers on autism, IEPs, rights, and therapies.", color:C.teal, tab:"Chat" },
    { icon:"📋", label:"IEP & BIP Analyzer", desc:"Upload or paste. Get scored analysis, red flags, rights & next steps.", color:C.lavender, tab:"IEP" },
    { icon:"🌍", label:"Resource Finder", desc:"Local & global therapy, support groups, and legal advocates.", color:C.peach, tab:"Resources" },
    { icon:"📖", label:"Learning Hub", desc:"Expert articles on autism science, advocacy, law, and family strategies.", color:C.sky, tab:"Blog" },
    { icon:"🛡️", label:"Know Your Rights", desc:"IDEA, FAPE, LRE, Section 504 — decoded into plain language.", color:C.rose, tab:"Chat" },
    { icon:"👤", label:"Personal Dashboard", desc:"Save chats, analyses, resources, and notes in one place.", color:C.gold, tab:"Dashboard" },
  ];

  const stats = [{ v:"50K+",l:"Families" },{ v:"12K+",l:"IEPs Analyzed" },{ v:"80+",l:"Countries" },{ v:"98%",l:"Satisfaction" }];

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
              <div style={{ color:C.mid, fontSize:13, marginTop:6 }}>Share your referral link and earn a free month:</div>
              <div style={{ background:C.cream, borderRadius:9, padding:"8px 14px", marginTop:10, fontSize:12, fontWeight:700, color:C.teal, letterSpacing:"0.04em" }}>spectraguide.com/ref/{refCode}</div>
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
          <Btn size="lg" variant="secondary" onClick={() => setActive("Booking")}>📅 Book a Demo</Btn>
        </div>
      </section>
    </div>
  );
}

// ─── ADVOCATE CHAT ────────────────────────────────────────────────────────────
function AdvocateChat({ user, chatHistory, setChatHistory, lang }) {
  const [messages, setMessages] = useState(chatHistory.length ? chatHistory : [{ role:"assistant", content:lang==="es"?"¡Hola! Soy tu Defensor de SpectraGuide 💙 Estoy aquí para ayudarte con preguntas sobre autismo, IEPs, derechos, terapias y estrategias diarias. ¿Qué tienes en mente?":"Hi! I'm your SpectraGuide Advocate 💙 Powered by Claude Opus — Anthropic's most advanced model — so I can handle complex legal questions, nuanced IEP situations, and detailed therapy discussions.\n\nWhat's on your mind today?" }]);
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

  const SYSTEM_EN = `You are SpectraGuide, a warm, deeply compassionate, and highly expert autism advocate AI powered by Claude Opus. You help parents, educators, autistic individuals, and clinicians with:
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
function IEPAnalyzer({ user, iepHistory, setIepHistory }) {
  const [docText, setDocText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("analyze");
  const w = useWindowWidth(); const mobile = w<768;

  const SAMPLE = `Student: Jordan M., Age 9\nDisability: Autism Spectrum Disorder\nPresent Levels: Jordan reads at 2nd grade level. Difficulty with transitions and peer interactions. Strengths in math and visual reasoning.\nAnnual Goals:\n1) Jordan will improve reading fluency from 45 to 80 wpm.\n2) Jordan will reduce transition-related meltdowns from 5/day to 1/day.\n3) Jordan will initiate peer interactions 2x per 30-min recess.\nServices: 30 min speech therapy weekly. Resource room 45 min daily. OT consult monthly.\nAccommodations: Extended time, preferential seating, visual schedules.\nParent concerns: Homework load, peer friendships, transition to 4th grade.`;

  async function analyze() {
    if (!docText.trim()) return;
    setLoading(true); setAnalysis(null);
    try {
      const result = await claudeJSONsafe(`You are SpectraGuide's expert IEP/BIP Analyzer powered by Claude Opus with deep knowledge of IDEA, FAPE, LRE, Section 504. Return a single JSON object (not an array):
{"documentType":"IEP or BIP","studentName":"name or null","studentAge":"age/grade or null","disability":"disability category or null","overallScore":1-10,"scoreRationale":"1-2 sentences","summary":"3-4 sentence plain-language summary","strengths":["..."],"gaps":["specific gap with why it matters"],"redFlags":["serious concern with IDEA citation if applicable"],"goalAnalysis":["assessment of each goal"],"servicesReview":["assessment of each service"],"parentRights":["specific right with explanation"],"recommendations":["specific actionable recommendation"],"questionsToAsk":["pointed question for school team"],"nextSteps":["prioritized action step"],"legalConcerns":["potential IDEA/FAPE/LRE violation or null array"]}`, `Analyze this document:\n\n${docText}`, 2500);
      setAnalysis(result);
      if (user) setIepHistory(h => [{ date:new Date().toLocaleDateString(), text:docText.slice(0,80)+"...", result }, ...h.slice(0,9)]);
    } catch { setAnalysis({ error:true }); }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Pill color={C.lavender}>IEP & BIP ANALYZER</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:34, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>Understand your child's plan</h1>
          <p style={{ color:C.mid, fontSize:15, maxWidth:500, margin:"0 auto" }}>Get a plain-language breakdown with strengths, gaps, red flags, and your rights.</p>
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
            <Btn variant="ghost" size="sm" onClick={() => setDocText(SAMPLE)}>✨ Try Sample IEP</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setDocText("")}>🗑️ Clear</Btn>
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

        {loading && <Card style={{ textAlign:"center", padding:48 }}><div style={{ fontSize:36, marginBottom:12 }}>🧩</div><div style={{ fontWeight:700, fontSize:17, color:C.dark }}>Reading your document…</div><div style={{ color:C.mid, fontSize:13, marginTop:6 }}>Checking goals, services, rights, and potential gaps with Claude Opus.</div></Card>}

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
  { name:"Hopebridge Autism Therapy Center — Indiana", type:"ABA Therapy", description:"Multi-location ABA therapy provider across Indiana offering comprehensive autism therapy for children. Accepts most major insurance plans.", scope:"Local", link:"https://hopebridge.com", phone:"844-467-3224", tips:"Hopebridge has multiple Indiana locations — call to find the nearest center to Kokomo and ask about current openings.", free:false, waitlist:"4-8 weeks", tags:["kokomo","indiana","aba","behavior","therapy","local"] },
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
    { name:"Hopebridge Locations",    desc:"One of the largest ABA therapy networks in the US — find a center near you.",        icon:"🌈", color:C.lavender, url:"https://hopebridge.com/locations/" },
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
function BlogHub() {
  const [posts, setPosts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [cat, setCat] = useState("All");
  const w = useWindowWidth(); const mobile = w<768;
  const CATS = ["All","IEP & Law","Therapies","Parenting","School Strategies","Autistic Voices","Research","Adult Services"];

  async function loadPosts() {
    setLoading(true);
    try {
      const raw = await claudeChat(`You are a content strategist for SpectraGuide. Generate 9 blog post previews as a JSON array. Return ONLY a JSON array starting with [. Each item: {"id":1,"title":"specific compelling title","category":"IEP & Law|Therapies|Parenting|School Strategies|Autistic Voices|Research|Adult Services","excerpt":"2-3 sentence teaser","author":"realistic name with credential","readTime":"X min read","emoji":"single emoji","tags":["tag1","tag2"]}`, "Generate 9 diverse blog posts for an autism advocacy platform", [], 1500);
      const match = raw.match(/\[[\s\S]*\]/);
      setPosts(match ? JSON.parse(match[0]) : []);
    } catch { setPosts([]); }
    setLoading(false);
  }

  async function loadPost(post) {
    setSelected({...post, content:null}); setPostLoading(true);
    try {
      const content = await claudeChat(`You are a senior writer for SpectraGuide. Write warm, evidence-based, practical articles in markdown format with ## headers. Target 600-700 words. Be empowering and specific.`, `Write the full article: "${post.title}"\nCategory: ${post.category}\nAuthor: ${post.author}\nAudience: parents, educators, autistic individuals`, [], 2000);
      setSelected({...post, content});
    } catch { setSelected({...post, content:"Unable to load article. Please try again."}); }
    setPostLoading(false);
  }

  useEffect(() => { loadPosts(); }, []);
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
        {postLoading ? <Card style={{ padding:48, textAlign:"center" }}><div style={{ fontSize:30, marginBottom:10 }}>📖</div><div style={{ fontWeight:700, color:C.dark }}>Writing article with Claude Opus…</div></Card>
          : <Card><div style={{ fontSize:15, lineHeight:1.88, color:C.mid, whiteSpace:"pre-wrap" }}>{selected.content}</div></Card>}
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 60px" }}>
      <div style={{ maxWidth:1050, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <Pill color={C.sky}>LEARNING HUB</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:34, fontWeight:900, color:C.dark, margin:"12px 0 8px", letterSpacing:"-0.02em" }}>Knowledge is your greatest tool</h1>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginBottom:28 }}>
          {CATS.map(c => <button key={c} onClick={()=>setCat(c)} style={{ background:cat===c?`${C.sky}18`:"transparent", border:`1.5px solid ${cat===c?C.sky:C.border}`, borderRadius:999, padding:"6px 14px", fontSize:12, fontWeight:cat===c?700:500, color:cat===c?C.sky:C.mid, cursor:"pointer", fontFamily:font }}>{c}</button>)}
        </div>
        {loading && <Card style={{ textAlign:"center", padding:44 }}><div style={{ fontSize:30 }}>📖</div><div style={{ fontWeight:700, color:C.dark, marginTop:10 }}>Loading articles…</div></Card>}
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(auto-fit,minmax(290px,1fr))", gap:18 }}>
          {filtered?.map(post => (
            <Card key={post.id} style={{ cursor:"pointer" }} onClick={()=>loadPost(post)}>
              <div style={{ fontSize:32, marginBottom:12 }}>{post.emoji}</div>
              <Tag c={C.sky}>{post.category}</Tag>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.dark, margin:"9px 0 7px", lineHeight:1.35 }}>{post.title}</h3>
              <p style={{ fontSize:13, color:C.mid, lineHeight:1.65, margin:"0 0 14px" }}>{post.excerpt}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:11, color:C.soft }}>{post.author} · {post.readTime}</div>
                <span style={{ fontSize:12, fontWeight:700, color:C.sky }}>Read →</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
function PricingPage({ setActive }) {
  const [billing, setBilling] = useState("monthly");
  const w = useWindowWidth(); const mobile = w<768;
  const plans = [
    { name:"Free", price:{monthly:0,annual:0}, color:C.teal, emoji:"🌱", desc:"For families just getting started", features:["AI Advocate Chat (10 msg/day)","IEP Analyzer (2/month)","Resource Finder","Learning Hub","Email support"], cta:"Start Free" },
    { name:"Family", price:{monthly:19,annual:15}, color:C.lavender, emoji:"💙", popular:true, desc:"For families navigating the journey", features:["Unlimited AI Advocate Chat","Unlimited IEP/BIP Analysis","Saved resources library","Chat history & notes","Monthly advocacy webinars","Priority support"], cta:"Start Family Plan" },
    { name:"Professional", price:{monthly:49,annual:39}, color:C.peach, emoji:"🎓", desc:"For educators, therapists & advocates", features:["Everything in Family","Multi-student management","Bulk IEP analysis","Team collaboration","API access","White-label options"], cta:"Start Pro Plan" },
    { name:"District", price:{monthly:299,annual:249}, color:C.rose, emoji:"🏫", desc:"For school districts & organizations", features:["Everything in Professional","Unlimited staff accounts","FERPA compliance tools","District analytics","Dedicated success manager","Custom integrations"], cta:"Contact Sales" },
  ];
  return (
    <div style={{ paddingTop:80, minHeight:"100vh", background:C.cream, padding:"80px 20px 80px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <Pill color={C.gold}>PRICING</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:38, fontWeight:900, color:C.dark, margin:"14px 0 10px", letterSpacing:"-0.02em" }}>Simple, <GradText a={C.teal} b={C.gold}>transparent</GradText> pricing</h1>
          <p style={{ color:C.mid, fontSize:16, maxWidth:440, margin:"0 auto 24px" }}>Start free. Upgrade when you're ready. Cancel anytime.</p>
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
                <button onClick={()=>setActive("Dashboard")} style={{ width:"100%", background:plan.popular?`linear-gradient(135deg,${C.lavender},${C.sky})`:"white", border:plan.popular?"none":`2px solid ${C.border}`, borderRadius:11, padding:"11px 0", fontSize:13, fontWeight:700, color:plan.popular?"white":C.dark, cursor:"pointer", fontFamily:font, boxShadow:plan.popular?`0 6px 20px ${C.lavender}44`:"none" }}>{plan.cta}</button>
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
              { q:"How accurate is the IEP Analyzer?", a:"It's powered by Claude Opus and trained on IDEA law and thousands of IEPs. It's highly effective at identifying patterns, rights, and gaps." },
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
function Dashboard({ user, setUser, chatHistory, iepHistory, savedResources, waitlist, referrals, setActive }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [err, setErr] = useState("");
  const w = useWindowWidth(); const mobile = w<768;

  function handleAuth() {
    if (!form.email.includes("@")) return setErr("Enter a valid email.");
    if (form.password.length<4) return setErr("Password must be 4+ characters.");
    if (mode==="signup"&&!form.name.trim()) return setErr("Enter your name.");
    setUser({ name:mode==="signup"?form.name:form.email.split("@")[0], email:form.email, plan:"Free", joined:new Date().toLocaleDateString(), isAdmin:form.email.includes("admin") });
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

  const refLink = `spectraguide.com/ref/${user.email.split("@")[0].toUpperCase()}`;

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

        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)", gap:14, marginBottom:22 }}>
          {[{ icon:"💬", label:"Chat Messages", value:chatHistory.filter(m=>m.role==="user").length, color:C.teal },{ icon:"📋", label:"IEPs Analyzed", value:iepHistory.length, color:C.lavender },{ icon:"❤️", label:"Saved Resources", value:savedResources.length, color:C.rose },{ icon:"👥", label:"Referrals", value:referrals, color:C.gold }].map(s => (
            <Card key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:7 }}>{s.icon}</div>
              <div style={{ fontFamily:serif, fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:C.soft, marginTop:3 }}>{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Referral Program */}
        <Card style={{ marginBottom:22, background:`linear-gradient(135deg,${C.teal}12,${C.lavender}12)` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:C.dark, marginBottom:4 }}>🎁 Refer a Friend — Earn a Free Month</div>
              <div style={{ fontSize:13, color:C.mid }}>Share your link. For every friend who upgrades, you both get one free month of Family plan.</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ background:"white", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, color:C.teal, border:`1.5px solid ${C.teal}33` }}>{refLink}</div>
              <Btn size="sm" onClick={()=>navigator.clipboard?.writeText(`https://${refLink}`)}>Copy</Btn>
            </div>
          </div>
        </Card>

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

  const recentActivity = [
    ...waitlist.slice(-3).map(w=>({ type:"signup", text:`New signup: ${w.email}`, time:w.date, color:C.teal })),
    ...bookings.slice(-3).map(b=>({ type:"booking", text:`Demo booked: ${b.name} (${b.org||b.role})`, time:b.createdAt, color:C.lavender })),
    ...iepHistory.slice(-2).map(h=>({ type:"iep", text:`IEP analyzed — Score ${h.result?.overallScore}/10`, time:h.date, color:C.peach })),
  ].sort((a,b) => new Date(b.time)-new Date(a.time)).slice(0,8);

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
          {[{ icon:"👥", label:"Total Users", value:totalUsers.toLocaleString(), change:"+12% this week", color:C.teal },{ icon:"📋", label:"IEPs Analyzed", value:totalIEPs.toLocaleString(), change:"+8% this week", color:C.lavender },{ icon:"💬", label:"Chat Messages", value:totalChats.toLocaleString(), change:"+22% this week", color:C.peach },{ icon:"📅", label:"Demos Booked", value:(bookings.length+47).toString(), change:`+${bookings.length} new`, color:C.gold }].map(s => (
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
            {waitlist.length===0 ? <div style={{ color:C.soft, fontSize:13 }}>No signups yet — share your launch link!</div> : (
              <div>
                {waitlist.slice(-6).reverse().map((w,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:i<Math.min(waitlist.length,6)-1?`1px solid ${C.border}`:"none" }}>
                    <span style={{ fontSize:13, color:C.dark }}>{w.email}</span>
                    <span style={{ fontSize:11, color:C.soft }}>{w.date}</span>
                  </div>
                ))}
                <div style={{ marginTop:12, fontSize:12, fontWeight:700, color:C.teal }}>Total: {(waitlist.length+50234).toLocaleString()} signups</div>
              </div>
            )}
          </Card>
          <Card>
            <div style={{ fontWeight:800, fontSize:14, color:C.dark, marginBottom:14 }}>📅 Demo Requests</div>
            {bookings.length===0 ? <div style={{ color:C.soft, fontSize:13 }}>No bookings yet.</div> : (
              bookings.slice(-5).reverse().map((b,i) => (
                <div key={i} style={{ padding:"8px 0", borderBottom:i<Math.min(bookings.length,5)-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>{b.name}</div>
                  <div style={{ fontSize:11, color:C.soft }}>{b.org||b.role} · {b.date} {b.time}</div>
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
  const stats = [{ n:"50,000+", l:"Families on Platform" },{ n:"12,000+", l:"IEPs Analyzed" },{ n:"80+", l:"Countries Served" },{ n:"98%", l:"User Satisfaction" },{ n:"$0", l:"Paid User Acquisition" },{ n:"Claude Opus", l:"AI Model Powering SpectraGuide" }];
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
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <Pill color={C.rose}>OUR MISSION</Pill>
          <h1 style={{ fontFamily:serif, fontSize:mobile?28:38, fontWeight:900, color:C.dark, margin:"16px 0 16px", letterSpacing:"-0.02em", lineHeight:1.15 }}>
            Every voice on the spectrum<br /><GradText a={C.teal} b={C.lavender}>deserves to be heard.</GradText>
          </h1>
          <p style={{ color:C.mid, fontSize:16, maxWidth:540, margin:"0 auto", lineHeight:1.78 }}>SpectraGuide was born from a simple belief: navigating autism supports shouldn't require a law degree. Every parent, educator, and autistic individual deserves clear, compassionate, and actionable guidance — without barriers.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"1fr 1fr", gap:18, marginBottom:44 }}>
          {[{ e:"🧩", t:"Claude Opus AI", d:"Powered by Anthropic's most capable model — providing expert-level guidance on autism science, law, and advocacy." },{ e:"📋", t:"IEP Intelligence", d:"Built with special education attorneys and advocates. Trained on IDEA provisions and thousands of real IEPs." },{ e:"🌍", t:"Global Network", d:"Resources in 80+ countries. Local therapy providers, support organizations, and legal advocates worldwide." },{ e:"💙", t:"Community First", d:"Shaped by the families, autistic individuals, and professionals who use it every day." },{ e:"🔒", t:"Privacy & Trust", d:"FERPA-conscious design. Your data is yours. IEP documents are never stored without explicit consent." },{ e:"🌱", t:"Always Growing", d:"Continuously updated with new research, legal changes, and community feedback." }].map(f => (
            <Card key={f.t}><div style={{ fontSize:28, marginBottom:10 }}>{f.e}</div><h3 style={{ fontSize:15, fontWeight:800, color:C.dark, margin:"0 0 7px" }}>{f.t}</h3><p style={{ fontSize:13.5, color:C.mid, lineHeight:1.65, margin:0 }}>{f.d}</p></Card>
          ))}
        </div>
        <Card style={{ background:`linear-gradient(135deg,${C.teal}12,${C.lavender}12)`, textAlign:"center", padding:48 }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🤝</div>
          <h2 style={{ fontFamily:serif, fontSize:26, fontWeight:800, color:C.dark, margin:"0 0 10px" }}>Partner with SpectraGuide</h2>
          <p style={{ color:C.mid, fontSize:14, maxWidth:440, margin:"0 auto 24px", lineHeight:1.75 }}>We're partnering with school districts, therapy providers, advocacy organizations, and mission-aligned investors.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <Btn onClick={()=>setActive("Partner")}>🤝 Become a Partner</Btn>
            <Btn variant="secondary" onClick={()=>setActive("Booking")}>📅 Book a Demo</Btn>
          </div>
        </Card>
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
            { title:"Get Help", links:[["Book a Demo","Booking"],["Advocate Chat","Chat"],["Resource Finder","Resources"]] },
            { title:"Legal", links:[["Privacy Policy","About"],["Terms of Service","About"],["FERPA Compliance","About"]] }
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:"0.1em", marginBottom:12, textTransform:"uppercase" }}>{col.title}</div>
              {col.links.map(([label,tab]) => <div key={label} onClick={()=>setActive(tab)} style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer" }}>{label}</div>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:18, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>© 2025 SpectraGuide. Made with 💙 for the autism community.</div>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)" }}>{t.poweredBy}</span>
            <span style={{ background:`linear-gradient(135deg,${C.teal},${C.lavender})`, color:"white", fontSize:9, fontWeight:700, padding:"2px 9px", borderRadius:999 }}>Claude Opus</span>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Not a substitute for legal or medical advice.</div>
        </div>
      </div>
    </footer>
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
const ALL_PAGES = ["Home","Chat","IEP","Resources","Blog","Pricing","Booking","Dashboard","Admin","Partner","Press","About"];

export default function App() {
  const [active, setActive]               = useState("Home");
  const [lang,   setLang]                 = useState("en");
  const [user,   setUser]                 = useLocalStore("sg_user_v2", null);
  const [chatHistory, setChatHistory]     = useLocalStore("sg_chat_v2", []);
  const [iepHistory,  setIepHistory]      = useLocalStore("sg_iep_v2",  []);
  const [savedRes,    setSavedRes]        = useLocalStore("sg_res_v2",  []);
  const [waitlist,    setWaitlist]        = useLocalStore("sg_wait_v2", []);
  const [bookings,    setBookings]        = useLocalStore("sg_book_v2", []);
  const [referrals]                       = useState(3);

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
    Blog:      <BlogHub />,
    Pricing:   <PricingPage setActive={setActive} />,
    Booking:   <BookingPage bookings={bookings} setBookings={setBookings} />,
    Dashboard: <Dashboard {...sharedProps} chatHistory={chatHistory} iepHistory={iepHistory} savedResources={savedRes} waitlist={waitlist} referrals={referrals} />,
    Admin:     <AdminDashboard waitlist={waitlist} bookings={bookings} iepHistory={iepHistory} chatHistory={chatHistory} savedResources={savedRes} />,
    Partner:   <PartnerPage setActive={setActive} />,
    Press:     <PressKit />,
    About:     <AboutPage setActive={setActive} />,
  };

  return (
    <div style={{ fontFamily:font, background:C.cream, minHeight:"100vh" }}>
      <Nav active={resolvedActive} setActive={setActive} user={user} setUser={setUser} lang={lang} setLang={setLang} t={t} />
      {pages[resolvedActive] || pages.Home}
      {resolvedActive !== "Chat" && <Footer setActive={setActive} t={t} />}
    </div>
  );
}
