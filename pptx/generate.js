// FraudGuard — Présentation corporate
// 14 slides, design Midnight Executive Navy x Electric Blue
const PptxGenJS = require("pptxgenjs");
const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.title   = "FraudGuard — Plateforme de Détection de Fraude";
pres.author  = "Box Africa";
pres.subject = "Présentation Services Financiers & Conformité BCEAO";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  navy:    "0A1628",
  navyMid: "1E3A5F",
  navyLight:"2D5282",
  sky:     "0EA5E9",
  skyLight:"38BDF8",
  gold:    "F59E0B",
  white:   "FFFFFF",
  offWhite:"F0F6FF",
  muted:   "94A3B8",
  slate:   "475569",
  success: "10B981",
  danger:  "EF4444",
  warning: "F59E0B",
  cardBg:  "F8FAFC",
  cardBorder:"E2E8F0",
  purple:  "7C3AED",
};

// ── Typography helpers ────────────────────────────────────────────────────────
const FONT_H = "Cambria";
const FONT_B = "Calibri";

function mkShadow() {
  return { type: "outer", color: "000000", blur: 8, offset: 3, angle: 45, opacity: 0.12 };
}
function mkShadowStrong() {
  return { type: "outer", color: "000000", blur: 16, offset: 6, angle: 45, opacity: 0.18 };
}

// ── Shared: dark slide header band ────────────────────────────────────────────
function addDarkBand(slide, title, subtitle) {
  // Navy background top band
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 1.35, fill: { color: C.navy } });
  slide.addText(title, {
    x: 0.5, y: 0.15, w: 8.5, h: 0.6,
    fontFace: FONT_H, fontSize: 28, bold: true, color: C.white, margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 0.78, w: 8.5, h: 0.45,
      fontFace: FONT_B, fontSize: 13, color: C.skyLight, margin: 0,
    });
  }
}

// ── Shared: light slide background ───────────────────────────────────────────
function setLightBg(slide) {
  slide.background = { color: C.cardBg };
}

// ── Shared: icon circle ───────────────────────────────────────────────────────
function iconCircle(slide, emoji, cx, cy, r, bg) {
  slide.addShape("ellipse", {
    x: cx - r, y: cy - r, w: r * 2, h: r * 2,
    fill: { color: bg }, line: { color: bg },
  });
  slide.addText(emoji, {
    x: cx - r, y: cy - r * 1.05, w: r * 2, h: r * 2,
    fontFace: "Arial", fontSize: Math.round(r * 48),
    align: "center", valign: "middle", margin: 0,
  });
}

// ── Shared: stat card ─────────────────────────────────────────────────────────
function statCard(slide, x, y, w, h, value, label, color, iconEmoji) {
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: C.white },
    line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(),
    rectRadius: 0.1,
  });
  slide.addText(value, {
    x: x + 0.15, y: y + 0.14, w: w - 0.3, h: 0.6,
    fontFace: FONT_H, fontSize: 28, bold: true, color, align: "center", margin: 0,
  });
  slide.addText(label, {
    x: x + 0.1, y: y + 0.72, w: w - 0.2, h: 0.35,
    fontFace: FONT_B, fontSize: 11, color: C.slate, align: "center", margin: 0,
  });
  if (iconEmoji) {
    slide.addText(iconEmoji, {
      x: x + w - 0.58, y: y + 0.1, w: 0.45, h: 0.45,
      fontFace: "Arial", fontSize: 18, align: "center", margin: 0,
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Hexagonal grid decorative background (simulated with overlapping circles)
  const hexPositions = [
    [9.2, 0.5], [9.7, 1.4], [8.7, 2.1], [9.4, 2.8], [8.2, 0.2],
  ];
  hexPositions.forEach(([cx, cy]) => {
    s.addShape("ellipse", {
      x: cx - 0.6, y: cy - 0.6, w: 1.2, h: 1.2,
      fill: { color: C.navyLight, transparency: 70 },
      line: { color: C.sky, pt: 1, transparency: 60 },
    });
  });

  // Large accent circle
  s.addShape("ellipse", {
    x: 7.5, y: -0.5, w: 4, h: 4,
    fill: { color: C.navyLight, transparency: 65 },
    line: { color: C.sky, pt: 1.5, transparency: 40 },
  });

  // Shield icon large
  s.addShape("ellipse", {
    x: 0.4, y: 1.5, w: 1.8, h: 1.8,
    fill: { color: C.sky, transparency: 85 },
    line: { color: C.sky, pt: 2, transparency: 30 },
  });
  s.addText("🛡️", {
    x: 0.4, y: 1.45, w: 1.8, h: 1.8,
    fontFace: "Arial", fontSize: 52, align: "center", valign: "middle", margin: 0,
  });

  // Main title
  s.addText("FraudGuard", {
    x: 0.5, y: 0.55, w: 7.5, h: 1.0,
    fontFace: FONT_H, fontSize: 60, bold: true, color: C.white, margin: 0,
  });

  // Sky underline
  s.addShape("rect", {
    x: 0.5, y: 1.56, w: 3.2, h: 0.07,
    fill: { color: C.sky }, line: { color: C.sky },
  });

  // Subtitle
  s.addText("Plateforme de Détection de Fraude\nen Temps Réel", {
    x: 2.5, y: 1.7, w: 7, h: 1.0,
    fontFace: FONT_B, fontSize: 20, color: C.skyLight, margin: 0,
  });

  // Tag badges
  const tags = ["Intelligence Artificielle", "Conformité BCEAO", "Temps Réel", "Multi-Tenant"];
  tags.forEach((tag, i) => {
    const tx = 0.5 + i * 2.37;
    s.addShape("rect", {
      x: tx, y: 3.05, w: 2.2, h: 0.38,
      fill: { color: C.navyLight }, line: { color: C.sky, pt: 1 }, rectRadius: 0.08,
    });
    s.addText(tag, {
      x: tx, y: 3.04, w: 2.2, h: 0.38,
      fontFace: FONT_B, fontSize: 11, color: C.skyLight, align: "center", valign: "middle", margin: 0,
    });
  });

  // Bottom info bar
  s.addShape("rect", {
    x: 0, y: 4.8, w: 10, h: 0.825,
    fill: { color: C.navyMid }, line: { color: C.navyMid },
  });
  s.addText("Box Africa · Juin 2026 · Confidentiel — Réservé aux équipes de direction et de conformité", {
    x: 0.5, y: 4.85, w: 9, h: 0.6,
    fontFace: FONT_B, fontSize: 12, color: C.muted, align: "center", margin: 0,
  });

  s.addNotes("Slide de couverture. Présenter FraudGuard comme une réponse concrète aux enjeux de fraude en Afrique de l'Ouest. Insister sur la conformité BCEAO dès l'ouverture.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — CONTEXTE & ENJEUX
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Contexte & Enjeux", "La fraude financière en Afrique de l'Ouest — un défi réglementaire et opérationnel");

  // Left: large stat callouts
  const statsLeft = [
    { val: "2,8 Mds $", lbl: "pertes annuelles fraude\nmobile money UEMOA", icon: "💸", color: C.danger },
    { val: "+340%", lbl: "croissance des fraudes\ndigitales 2022–2025", icon: "📈", color: C.warning },
    { val: "68%", lbl: "des fraudes via\nle canal mobile", icon: "📱", color: C.navyMid },
  ];
  statsLeft.forEach(({ val, lbl, icon, color }, i) => {
    const y = 1.55 + i * 1.25;
    s.addShape("rect", {
      x: 0.4, y, w: 4.3, h: 1.05,
      fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    s.addText(icon, {
      x: 0.55, y: y + 0.1, w: 0.7, h: 0.7,
      fontFace: "Arial", fontSize: 28, margin: 0,
    });
    s.addText(val, {
      x: 1.3, y: y + 0.05, w: 1.8, h: 0.55,
      fontFace: FONT_H, fontSize: 26, bold: true, color, margin: 0,
    });
    s.addText(lbl, {
      x: 1.3, y: y + 0.54, w: 3.1, h: 0.45,
      fontFace: FONT_B, fontSize: 11, color: C.slate, margin: 0,
    });
  });

  // Right: BCEAO obligations
  s.addShape("rect", {
    x: 5.0, y: 1.5, w: 4.7, h: 3.85,
    fill: { color: C.white }, line: { color: C.sky, pt: 1.5 },
    shadow: mkShadow(), rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 5.0, y: 1.5, w: 4.7, h: 0.65,
    fill: { color: C.navyMid }, line: { color: C.navyMid }, rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 5.0, y: 1.9, w: 4.7, h: 0.25,
    fill: { color: C.navyMid }, line: { color: C.navyMid },
  });
  s.addText("⚖️  Obligations BCEAO", {
    x: 5.15, y: 1.54, w: 4.4, h: 0.55,
    fontFace: FONT_H, fontSize: 15, bold: true, color: C.white, margin: 0,
  });

  const reqs = [
    ["Instruction 008-05-2015", "Conservation des données 5 ans"],
    ["Déclaration mensuelle", "Transactions suspectes ≥ seuil"],
    ["Journal d'audit", "Traçabilité des actions sur alertes"],
    ["Rapport de conformité", "Taux de fraude & pseudonymisation"],
    ["Sécurité des données", "Chiffrement & contrôle d'accès"],
  ];
  reqs.forEach(([title, desc], i) => {
    const ry = 2.27 + i * 0.62;
    s.addText("✓", {
      x: 5.2, y: ry, w: 0.3, h: 0.3,
      fontFace: "Arial", fontSize: 14, color: C.success, bold: true, margin: 0,
    });
    s.addText(title, {
      x: 5.55, y: ry, w: 3.9, h: 0.28,
      fontFace: FONT_B, fontSize: 12, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(desc, {
      x: 5.55, y: ry + 0.27, w: 3.9, h: 0.25,
      fontFace: FONT_B, fontSize: 10.5, color: C.slate, margin: 0,
    });
  });

  s.addNotes("Contextualiser la problématique : les établissements financiers UEMOA font face à une explosion de la fraude digitale tout en devant se conformer aux exigences strictes de la BCEAO.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — ARCHITECTURE
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Architecture de la Solution", "Stack technique moderne — scalable, sécurisé, cloud-ready");

  // Three architecture layers
  const layers = [
    {
      title: "🖥️  Interface Utilisateur",
      color: C.navyMid,
      items: ["Next.js 14 (App Router)", "Dashboard Admin", "Portail Client (Tenant)", "SSE Notifications temps réel"],
      x: 0.35,
    },
    {
      title: "⚙️  API Backend",
      color: C.sky,
      items: ["FastAPI (Python)", "Authentification Keycloak RS256", "Rate limiting & Audit trail", "Streaming CSV BCEAO"],
      x: 3.6,
    },
    {
      title: "🧠  Intelligence Artificielle",
      color: C.gold,
      items: ["Modèle LightGBM", "Scoring temps réel < 50ms", "30 features comportementales", "Version & rotation de modèle"],
      x: 6.85,
    },
  ];

  layers.forEach(({ title, color, items, x }) => {
    // Main box
    s.addShape("rect", {
      x, y: 1.55, w: 3.0, h: 3.75,
      fill: { color: C.white }, line: { color, pt: 2 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    // Header box
    s.addShape("rect", {
      x, y: 1.55, w: 3.0, h: 0.65,
      fill: { color }, line: { color }, rectRadius: 0.1,
    });
    s.addShape("rect", {
      x, y: 1.95, w: 3.0, h: 0.25,
      fill: { color }, line: { color },
    });
    s.addText(title, {
      x: x + 0.1, y: 1.6, w: 2.8, h: 0.52,
      fontFace: FONT_B, fontSize: 13, bold: true, color: C.white, margin: 0,
    });
    items.forEach((item, i) => {
      const iy = 2.35 + i * 0.7;
      s.addShape("ellipse", {
        x: x + 0.18, y: iy + 0.04, w: 0.22, h: 0.22,
        fill: { color }, line: { color },
      });
      s.addText(item, {
        x: x + 0.5, y: iy, w: 2.35, h: 0.55,
        fontFace: FONT_B, fontSize: 12, color: C.navyMid, margin: 0,
      });
    });
  });

  // Arrows between layers
  [[1.35, 3.0], [4.6, 3.0]].forEach(([ax, ay]) => {
    s.addShape("LINE", {
      x: ax, y: ay, w: 0.25, h: 0,
      line: { color: C.muted, pt: 2, dashType: "dash" },
    });
    // Arrow head approximation
    s.addText("→", {
      x: ax + 0.1, y: ay - 0.22, w: 0.35, h: 0.4,
      fontFace: "Arial", fontSize: 18, color: C.muted, margin: 0,
    });
  });

  // Bottom infrastructure bar
  s.addShape("rect", {
    x: 0.35, y: 5.05, w: 9.3, h: 0.42,
    fill: { color: C.navyMid }, line: { color: C.navyMid }, rectRadius: 0.08,
  });
  const infra = ["PostgreSQL", "Redis Pub/Sub", "Keycloak SSO", "Docker / K8s"];
  infra.forEach((item, i) => {
    s.addText(`🔧 ${item}`, {
      x: 0.6 + i * 2.3, y: 5.07, w: 2.1, h: 0.36,
      fontFace: FONT_B, fontSize: 12, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addNotes("Architecture 3-tiers : frontend Next.js, backend FastAPI, couche IA LightGBM. PostgreSQL pour la persistance, Redis pour la communication temps réel entre services, Keycloak pour l'authentification centralisée.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — MODÈLE IA
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Modèle d'Intelligence Artificielle", "LightGBM — détection de fraude entraîné sur données UEMOA");

  // Left: model info column
  s.addShape("rect", {
    x: 0.35, y: 1.55, w: 3.1, h: 3.85,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.1,
  });

  const modelInfo = [
    ["🧬", "Algorithme", "LightGBM (Gradient Boosting)"],
    ["📊", "Entraînement", "500 000 transactions historiques"],
    ["🎯", "AUC-ROC", "0.964 sur jeu de test"],
    ["⚡", "Latence scoring", "< 50 ms par transaction"],
    ["🔄", "Versioning", "Rotation automatique de modèle"],
    ["🔒", "Intégrité", "Vérification SHA-256 au démarrage"],
  ];
  modelInfo.forEach(([icon, label, val], i) => {
    const iy = 1.72 + i * 0.6;
    s.addText(icon, {
      x: 0.5, y: iy, w: 0.4, h: 0.4,
      fontFace: "Arial", fontSize: 18, margin: 0,
    });
    s.addText(label + ":", {
      x: 0.95, y: iy, w: 1.3, h: 0.28,
      fontFace: FONT_B, fontSize: 11, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(val, {
      x: 0.95, y: iy + 0.27, w: 2.3, h: 0.28,
      fontFace: FONT_B, fontSize: 11, color: C.slate, margin: 0,
    });
  });

  // Center: feature categories
  s.addShape("rect", {
    x: 3.7, y: 1.55, w: 2.8, h: 3.85,
    fill: { color: C.white }, line: { color: C.sky, pt: 1.5 },
    shadow: mkShadow(), rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 3.7, y: 1.55, w: 2.8, h: 0.55,
    fill: { color: C.navyMid }, line: { color: C.navyMid }, rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 3.7, y: 1.9, w: 2.8, h: 0.2,
    fill: { color: C.navyMid }, line: { color: C.navyMid },
  });
  s.addText("30 Features d'Analyse", {
    x: 3.85, y: 1.59, w: 2.5, h: 0.45,
    fontFace: FONT_H, fontSize: 13, bold: true, color: C.white, margin: 0,
  });

  const featureGroups = [
    { cat: "💰 Transaction", items: ["Montant", "Devise", "Heure locale"] },
    { cat: "📍 Géolocalisation", items: ["Pays d'origine", "Pays destination", "Anomalie géo"] },
    { cat: "📱 Canal", items: ["Mobile / Web / ATM / POS", "Fréquence canal"] },
    { cat: "🧑 Comportement", items: ["Vélocité 1h/24h/7j", "Panier moyen", "Historique client"] },
  ];
  featureGroups.forEach(({ cat, items }, gi) => {
    const gy = 2.25 + gi * 0.88;
    s.addText(cat, {
      x: 3.85, y: gy, w: 2.5, h: 0.28,
      fontFace: FONT_B, fontSize: 11.5, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(items.join(" · "), {
      x: 3.85, y: gy + 0.28, w: 2.5, h: 0.5,
      fontFace: FONT_B, fontSize: 10.5, color: C.slate, margin: 0,
    });
  });

  // Right: performance chart (native BAR)
  s.addChart("bar", [
    {
      name: "Score",
      labels: ["AUC-ROC", "Précision", "Rappel", "F1-Score"],
      values: [96.4, 94.1, 91.8, 92.9],
    },
  ], {
    x: 6.75, y: 1.55, w: 3.0, h: 2.5,
    barDir: "col",
    chartColors: [C.sky],
    chartArea: { fill: { color: C.white }, roundedCorners: true },
    catAxisLabelColor: C.slate,
    valAxisLabelColor: C.slate,
    valGridLine: { color: "E2E8F0", size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true,
    dataLabelColor: C.navyMid,
    dataLabelFontSize: 10,
    showLegend: false,
    valAxisMaxVal: 100,
    showTitle: true,
    title: "Performance (%)",
    titleColor: C.navyMid,
    titleFontSize: 12,
  });

  // Risk levels legend
  s.addShape("rect", {
    x: 6.75, y: 4.25, w: 3.0, h: 1.15,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.1,
  });
  s.addText("Niveaux de risque", {
    x: 6.9, y: 4.32, w: 2.7, h: 0.28,
    fontFace: FONT_B, fontSize: 11, bold: true, color: C.navyMid, margin: 0,
  });
  const levels = [
    ["Critique", C.danger, "≥ 80%"],
    ["Élevé", "F97316", "≥ 50%"],
    ["Moyen", C.warning, "≥ 30%"],
    ["Faible", C.success, "< 30%"],
  ];
  levels.forEach(([lbl, color, range], i) => {
    const lx = 6.82 + i * 0.75;
    s.addShape("ellipse", { x: lx, y: 4.68, w: 0.22, h: 0.22, fill: { color }, line: { color } });
    s.addText(`${lbl}\n${range}`, {
      x: lx - 0.15, y: 4.9, w: 0.5, h: 0.4,
      fontFace: FONT_B, fontSize: 8.5, color: C.slate, align: "center", margin: 0,
    });
  });

  s.addNotes("LightGBM est un algorithme de gradient boosting très performant sur des données tabulaires asymétriques (fraude rare = 1-3% des transactions). AUC-ROC de 0.964 signifie que le modèle distingue correctement fraude vs légitime dans 96.4% des cas.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — RÔLES UTILISATEURS
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Rôles & Contrôle d'Accès", "5 profils utilisateurs avec périmètre strict — principe du moindre privilège");

  const roles = [
    {
      icon: "👑", title: "Super Admin", color: C.navyMid,
      desc: "Accès total à la plateforme",
      perms: ["Gestion de tous les tenants", "Configuration système", "Journal d'audit global", "Rotation des modèles IA"],
    },
    {
      icon: "⚖️", title: "Compliance", color: C.purple,
      desc: "Auditeur réglementaire",
      perms: ["Rapports BCEAO", "Export journal d'audit", "Lecture seule multi-tenant", "Tableaux de conformité"],
    },
    {
      icon: "🏢", title: "Tenant Admin", color: C.sky,
      desc: "Responsable institution financière",
      perms: ["Dashboard de son établissement", "Gestion des alertes", "Export transactions/alertes", "Portail client dédié"],
    },
    {
      icon: "🔍", title: "Analyste", color: C.gold,
      desc: "Investigateur fraude",
      perms: ["Consultation des alertes", "Qualification / Rejet", "Commentaires sur alertes", "Historique transactions"],
    },
    {
      icon: "👤", title: "Tenant (Viewer)", color: C.success,
      desc: "Accès lecture seule",
      perms: ["Consultation transactions", "Visualisation alertes", "Téléchargement rapports", "Aucune action possible"],
    },
  ];

  roles.forEach(({ icon, title, color, desc, perms }, i) => {
    const x = 0.3 + i * 1.88;
    // Card
    s.addShape("rect", {
      x, y: 1.5, w: 1.75, h: 3.95,
      fill: { color: C.white }, line: { color, pt: 2 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    // Top colored band
    s.addShape("rect", {
      x, y: 1.5, w: 1.75, h: 0.75,
      fill: { color }, line: { color }, rectRadius: 0.1,
    });
    s.addShape("rect", {
      x, y: 2.05, w: 1.75, h: 0.2,
      fill: { color }, line: { color },
    });
    // Icon
    s.addText(icon, {
      x, y: 1.53, w: 1.75, h: 0.55,
      fontFace: "Arial", fontSize: 28, align: "center", valign: "middle", margin: 0,
    });
    // Title
    s.addText(title, {
      x: x + 0.05, y: 2.28, w: 1.65, h: 0.38,
      fontFace: FONT_H, fontSize: 13, bold: true, color, align: "center", margin: 0,
    });
    // Desc
    s.addText(desc, {
      x: x + 0.05, y: 2.65, w: 1.65, h: 0.35,
      fontFace: FONT_B, fontSize: 10, color: C.slate, align: "center", italic: true, margin: 0,
    });
    // Permissions
    perms.forEach((p, pi) => {
      s.addText(`• ${p}`, {
        x: x + 0.12, y: 3.1 + pi * 0.49, w: 1.5, h: 0.45,
        fontFace: FONT_B, fontSize: 10.5, color: C.navyMid, margin: 0,
      });
    });
  });

  s.addNotes("5 rôles distincts avec permissions strictement séparées. JWT Keycloak porte le rôle directement. Le tenant admin n'accède qu'aux données de son propre établissement — isolation garantie par le tenant_id dans chaque requête.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — TABLEAU DE BORD (mockup)
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Tableau de Bord Analytique", "Vue temps réel des métriques de fraude — rafraîchissement automatique toutes les 30 secondes");

  // Browser chrome mockup
  s.addShape("rect", {
    x: 0.35, y: 1.52, w: 9.3, h: 3.95,
    fill: { color: C.white }, line: { color: "CBD5E1", pt: 1 },
    shadow: mkShadowStrong(), rectRadius: 0.1,
  });
  // Browser bar
  s.addShape("rect", {
    x: 0.35, y: 1.52, w: 9.3, h: 0.42,
    fill: { color: "F1F5F9" }, line: { color: "E2E8F0", pt: 1 }, rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 0.35, y: 1.79, w: 9.3, h: 0.15,
    fill: { color: "F1F5F9" }, line: { color: "F1F5F9" },
  });
  // Window buttons
  ["EF4444", "F59E0B", "22C55E"].forEach((col, i) => {
    s.addShape("ellipse", {
      x: 0.55 + i * 0.28, y: 1.62, w: 0.16, h: 0.16,
      fill: { color: col }, line: { color: col },
    });
  });
  // URL bar
  s.addShape("rect", {
    x: 1.5, y: 1.6, w: 4, h: 0.25,
    fill: { color: C.white }, line: { color: "CBD5E1", pt: 1 }, rectRadius: 0.05,
  });
  s.addText("🔒 localhost:3000 — FraudGuard Dashboard", {
    x: 1.55, y: 1.6, w: 3.9, h: 0.25,
    fontFace: FONT_B, fontSize: 8.5, color: C.slate, valign: "middle", margin: 0,
  });

  // Sidebar (mini)
  s.addShape("rect", {
    x: 0.35, y: 1.94, w: 1.3, h: 3.53,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("🛡️\nFraudGuard", {
    x: 0.35, y: 2.0, w: 1.3, h: 0.6,
    fontFace: FONT_B, fontSize: 9, bold: true, color: C.white, align: "center", margin: 0,
  });
  const sideItems = ["📊 Dashboard", "🚨 Alertes", "💳 Transactions", "📋 Conformité", "⚙️ Config"];
  sideItems.forEach((item, i) => {
    const sbg = i === 0 ? C.sky : "transparent";
    if (i === 0) {
      s.addShape("rect", {
        x: 0.35, y: 2.75 + i * 0.48, w: 1.3, h: 0.38,
        fill: { color: C.navyLight }, line: { color: C.navyLight },
      });
    }
    s.addText(item, {
      x: 0.42, y: 2.78 + i * 0.48, w: 1.15, h: 0.3,
      fontFace: FONT_B, fontSize: 9, color: i === 0 ? C.white : C.muted, margin: 0,
    });
  });

  // Main content area
  // Top KPI row (4 cards)
  const kpis = [
    { val: "14 872", lbl: "Transactions", icon: "💳", color: C.navyMid },
    { val: "284", lbl: "Fraudes détectées", icon: "🚨", color: C.danger },
    { val: "1.91%", lbl: "Taux de fraude", icon: "%", color: C.warning },
    { val: "v1.4.2", lbl: "Modèle actif", icon: "🧠", color: C.success },
  ];
  kpis.forEach(({ val, lbl, icon, color }, i) => {
    const kx = 1.75 + i * 1.98;
    s.addShape("rect", {
      x: kx, y: 2.0, w: 1.85, h: 0.95,
      fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
      shadow: mkShadow(), rectRadius: 0.08,
    });
    s.addText(val, {
      x: kx + 0.1, y: 2.05, w: 1.5, h: 0.42,
      fontFace: FONT_H, fontSize: 20, bold: true, color, margin: 0,
    });
    s.addText(lbl, {
      x: kx + 0.1, y: 2.48, w: 1.5, h: 0.32,
      fontFace: FONT_B, fontSize: 9.5, color: C.slate, margin: 0,
    });
    s.addText(icon, {
      x: kx + 1.45, y: 2.06, w: 0.32, h: 0.32,
      fontFace: "Arial", fontSize: 14, margin: 0,
    });
  });

  // Area chart placeholder
  s.addShape("rect", {
    x: 1.75, y: 3.1, w: 4.8, h: 2.1,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.08,
  });
  s.addText("📈  Activité transactions — 14 derniers jours", {
    x: 1.9, y: 3.15, w: 4.5, h: 0.3,
    fontFace: FONT_B, fontSize: 10.5, bold: true, color: C.navyMid, margin: 0,
  });
  // Simulated area chart lines
  const chartPoints = [40, 55, 48, 62, 70, 58, 75, 68, 80, 72, 85, 78, 90, 88];
  chartPoints.forEach((val, i) => {
    if (i < chartPoints.length - 1) {
      const x1 = 1.85 + i * 0.33;
      const y1 = 4.95 - (val / 100) * 1.4;
      const x2 = 1.85 + (i + 1) * 0.33;
      const y2 = 4.95 - (chartPoints[i + 1] / 100) * 1.4;
      s.addShape("LINE", { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: C.success, pt: 2 } });
    }
  });
  // Fraud line (smaller)
  const fraudPts = [3, 5, 2, 7, 4, 8, 3, 6, 4, 7, 5, 3, 6, 5];
  fraudPts.forEach((val, i) => {
    if (i < fraudPts.length - 1) {
      const x1 = 1.85 + i * 0.33;
      const y1 = 4.95 - (val / 10) * 1.4;
      const x2 = 1.85 + (i + 1) * 0.33;
      const y2 = 4.95 - (fraudPts[i + 1] / 10) * 1.4;
      s.addShape("LINE", { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: C.danger, pt: 1.5 } });
    }
  });
  s.addShape("ellipse", { x: 2.1, y: 5.07, w: 0.12, h: 0.12, fill: { color: C.success }, line: { color: C.success } });
  s.addText("Légitimes", { x: 2.25, y: 5.04, w: 0.8, h: 0.18, fontFace: FONT_B, fontSize: 8, color: C.slate, margin: 0 });
  s.addShape("ellipse", { x: 3.25, y: 5.07, w: 0.12, h: 0.12, fill: { color: C.danger }, line: { color: C.danger } });
  s.addText("Fraudes", { x: 3.4, y: 5.04, w: 0.6, h: 0.18, fontFace: FONT_B, fontSize: 8, color: C.slate, margin: 0 });

  // Right panel: recent alerts
  s.addShape("rect", {
    x: 6.7, y: 3.1, w: 2.85, h: 2.1,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.08,
  });
  s.addText("🚨  Alertes récentes", {
    x: 6.85, y: 3.15, w: 2.5, h: 0.28,
    fontFace: FONT_B, fontSize: 10.5, bold: true, color: C.navyMid, margin: 0,
  });
  const alertRows = [
    ["TXN-00142", "Mobile", "✕ Critique"],
    ["TXN-00138", "ATM", "✕ Élevé"],
    ["TXN-00131", "Web", "✕ Moyen"],
    ["TXN-00129", "POS", "✓ Légitime"],
  ];
  alertRows.forEach(([id, ch, status], i) => {
    const rowY = 3.5 + i * 0.38;
    const rowBg = i % 2 === 0 ? "F8FAFC" : C.white;
    s.addShape("rect", { x: 6.7, y: rowY, w: 2.85, h: 0.36, fill: { color: rowBg }, line: { color: rowBg } });
    s.addText(id, { x: 6.78, y: rowY + 0.05, w: 1.1, h: 0.26, fontFace: FONT_B, fontSize: 9, color: C.navyMid, bold: true, margin: 0 });
    s.addText(ch, { x: 7.9, y: rowY + 0.05, w: 0.6, h: 0.26, fontFace: FONT_B, fontSize: 9, color: C.slate, margin: 0 });
    const sc = status.startsWith("✕") ? C.danger : C.success;
    s.addText(status, { x: 8.52, y: rowY + 0.05, w: 1.0, h: 0.26, fontFace: FONT_B, fontSize: 9, color: sc, bold: true, margin: 0 });
  });

  s.addNotes("Le tableau de bord se rafraîchit toutes les 30 secondes. Les 4 KPIs en haut (transactions, fraudes, taux, modèle) sont calculés en temps réel depuis la base de données. Le graphique d'activité montre les 14 derniers jours.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — DÉTECTION TEMPS RÉEL & ALERTES
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Détection & Gestion des Alertes", "Pipeline de scoring temps réel et workflow de qualification");

  // Left: scoring flow diagram
  const steps = [
    { icon: "📲", label: "Transaction reçue", sub: "API /fraud/score", color: C.navyMid },
    { icon: "🔍", label: "Extraction features", sub: "30 variables comportementales", color: C.navyLight },
    { icon: "🧠", label: "Scoring IA", sub: "LightGBM < 50ms", color: C.sky },
    { icon: "⚡", label: "Résultat + Alerte", sub: "Persistance + SSE push", color: C.warning },
    { icon: "🔔", label: "Notification temps réel", sub: "Dashboard admin alerté", color: C.success },
  ];

  steps.forEach(({ icon, label, sub, color }, i) => {
    const sy = 1.62 + i * 0.77;
    // Step box
    s.addShape("rect", {
      x: 0.35, y: sy, w: 4.0, h: 0.65,
      fill: { color: C.white }, line: { color, pt: 1.5 },
      shadow: mkShadow(), rectRadius: 0.08,
    });
    // Step number circle
    s.addShape("ellipse", {
      x: 0.42, y: sy + 0.1, w: 0.42, h: 0.42,
      fill: { color }, line: { color },
    });
    s.addText(`${i + 1}`, {
      x: 0.42, y: sy + 0.09, w: 0.42, h: 0.42,
      fontFace: FONT_B, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
    s.addText(icon, { x: 0.92, y: sy + 0.08, w: 0.4, h: 0.4, fontFace: "Arial", fontSize: 18, margin: 0 });
    s.addText(label, {
      x: 1.35, y: sy + 0.05, w: 2.8, h: 0.28,
      fontFace: FONT_B, fontSize: 13, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(sub, {
      x: 1.35, y: sy + 0.33, w: 2.8, h: 0.25,
      fontFace: FONT_B, fontSize: 10.5, color: C.slate, margin: 0,
    });
    // Connector arrow
    if (i < steps.length - 1) {
      s.addText("↓", {
        x: 1.5, y: sy + 0.65, w: 0.5, h: 0.2,
        fontFace: "Arial", fontSize: 14, color: C.muted, align: "center", margin: 0,
      });
    }
  });

  // Right: alert drawer mockup
  s.addShape("rect", {
    x: 4.75, y: 1.55, w: 5.0, h: 3.9,
    fill: { color: C.white }, line: { color: "CBD5E1", pt: 1 },
    shadow: mkShadowStrong(), rectRadius: 0.1,
  });
  // Drawer header
  s.addShape("rect", {
    x: 4.75, y: 1.55, w: 5.0, h: 0.65,
    fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 4.75, y: 1.95, w: 5.0, h: 0.25,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addText("🚨  Alerte #1247 — TXN-00142", {
    x: 4.9, y: 1.58, w: 4.6, h: 0.55,
    fontFace: FONT_H, fontSize: 13, bold: true, color: C.white, margin: 0,
  });
  // Alert fields
  const alertFields = [
    ["Transaction ID", "TXN-00142-CI-2026"],
    ["Score de risque", "94% — CRITIQUE"],
    ["Montant", "2 450 000 XOF"],
    ["Canal", "Mobile Money"],
    ["Pays", "Côte d'Ivoire"],
    ["Heure", "14:32:07 UTC"],
  ];
  alertFields.forEach(([label, value], i) => {
    const fy = 2.32 + i * 0.4;
    const isScore = label === "Score de risque";
    s.addText(label, {
      x: 4.9, y: fy, w: 1.6, h: 0.3,
      fontFace: FONT_B, fontSize: 11, color: C.slate, margin: 0,
    });
    s.addText(value, {
      x: 6.55, y: fy, w: 3.0, h: 0.3,
      fontFace: FONT_B, fontSize: 11, bold: isScore, color: isScore ? C.danger : C.navyMid, margin: 0,
    });
    // Separator
    s.addShape("LINE", {
      x: 4.88, y: fy + 0.33, w: 4.72, h: 0,
      line: { color: "E2E8F0", pt: 0.5 },
    });
  });
  // Action buttons
  const actions = [
    { lbl: "✓ Confirmer fraude", bg: C.danger },
    { lbl: "⏸ Mettre en attente", bg: C.warning },
    { lbl: "✗ Faux positif", bg: C.success },
  ];
  actions.forEach(({ lbl, bg }, i) => {
    const bx = 4.85 + i * 1.65;
    s.addShape("rect", {
      x: bx, y: 5.12, w: 1.55, h: 0.28,
      fill: { color: bg }, line: { color: bg }, rectRadius: 0.06,
    });
    s.addText(lbl, {
      x: bx, y: 5.12, w: 1.55, h: 0.28,
      fontFace: FONT_B, fontSize: 9.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addNotes("Le pipeline de scoring est entièrement asynchrone. Le résultat est disponible en moins de 50ms. Les alertes sont poussées en temps réel via SSE (Server-Sent Events) sans que l'analyste ait besoin de recharger la page. Trois actions possibles : confirmer, mettre en attente, ou rejeter comme faux positif.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — NOTIFICATIONS TEMPS RÉEL (SSE)
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Notifications Temps Réel", "Server-Sent Events (SSE) — alertes instantanées sans rechargement de page");

  // Left: SSE diagram
  s.addShape("rect", {
    x: 0.35, y: 1.55, w: 4.2, h: 1.1,
    fill: { color: C.navyMid }, line: { color: C.navyMid }, rectRadius: 0.1,
  });
  s.addText("🏦 Serveur Backend (FastAPI)", {
    x: 0.5, y: 1.65, w: 3.9, h: 0.5,
    fontFace: FONT_B, fontSize: 14, bold: true, color: C.white, align: "center", margin: 0,
  });
  s.addText("Redis Pub/Sub · fraud:tenant:{id}", {
    x: 0.5, y: 2.1, w: 3.9, h: 0.35,
    fontFace: FONT_B, fontSize: 11, color: C.skyLight, align: "center", margin: 0,
  });

  s.addShape("rect", {
    x: 0.35, y: 4.15, w: 4.2, h: 0.95,
    fill: { color: C.sky }, line: { color: C.sky }, rectRadius: 0.1,
  });
  s.addText("🖥️ Client Next.js (EventSource)", {
    x: 0.5, y: 4.25, w: 3.9, h: 0.4,
    fontFace: FONT_B, fontSize: 13, bold: true, color: C.white, align: "center", margin: 0,
  });
  s.addText("/api/v1/events/stream?token=…&tenant_id=…", {
    x: 0.5, y: 4.6, w: 3.9, h: 0.35,
    fontFace: FONT_B, fontSize: 10, color: C.offWhite, align: "center", margin: 0,
  });

  // Arrow down
  s.addShape("LINE", { x: 2.45, y: 2.65, w: 0, h: 1.5, line: { color: C.warning, pt: 2.5 } });
  s.addText("⬇", { x: 2.28, y: 3.9, w: 0.35, h: 0.3, fontFace: "Arial", fontSize: 18, color: C.warning, margin: 0 });
  s.addText("event: new_alert\ndata: {score, amount, risk_level…}", {
    x: 2.75, y: 2.9, w: 2.5, h: 0.6,
    fontFace: "Courier New", fontSize: 10, color: C.navyMid, margin: 0,
  });

  // SSE features
  const features = [
    { icon: "🔄", title: "Reconnexion auto", desc: "Backoff exponentiel 1s → 30s en cas de coupure réseau" },
    { icon: "🔐", title: "Auth par token", desc: "JWT Bearer passé en query param (EventSource ne supporte pas les headers)" },
    { icon: "💓", title: "Heartbeat 25s", desc: "Keep-alive pour maintenir la connexion à travers les proxies" },
    { icon: "📢", title: "Fan-out Redis", desc: "Un message publié → tous les onglets du même tenant reçoivent l'alerte" },
  ];
  features.forEach(({ icon, title, desc }, i) => {
    const fy = 1.55 + i * 1.05;
    s.addShape("rect", {
      x: 4.9, y: fy, w: 4.8, h: 0.9,
      fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    s.addText(icon, { x: 5.05, y: fy + 0.18, w: 0.45, h: 0.45, fontFace: "Arial", fontSize: 22, margin: 0 });
    s.addText(title, {
      x: 5.55, y: fy + 0.1, w: 3.9, h: 0.3,
      fontFace: FONT_B, fontSize: 13, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(desc, {
      x: 5.55, y: fy + 0.42, w: 3.9, h: 0.4,
      fontFace: FONT_B, fontSize: 11, color: C.slate, margin: 0,
    });
  });

  // Notification bell mockup
  s.addShape("rect", {
    x: 4.9, y: 5.1, w: 4.8, h: 0.4,
    fill: { color: C.navyMid }, line: { color: C.navyMid }, rectRadius: 0.08,
  });
  s.addText("🔔  Cloche topbar : badge rouge avec compteur non-lus · Dropdown 5 dernières alertes · Lien → page Alertes", {
    x: 5.05, y: 5.13, w: 4.5, h: 0.32,
    fontFace: FONT_B, fontSize: 10.5, color: C.white, margin: 0,
  });

  s.addNotes("SSE est préféré à WebSocket car il est unidirectionnel (serveur → client), traverse mieux les proxies et load balancers, et supporte la reconnexion native. Redis Pub/Sub permet le fan-out horizontal si plusieurs instances backend tournent.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — EXPORT & CONFORMITÉ BCEAO
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Export & Conformité BCEAO", "Instruction 008-05-2015 — Données traçables, exportables, conservées 5 ans");

  // Top: regulatory reference banner
  s.addShape("rect", {
    x: 0.35, y: 1.55, w: 9.3, h: 0.6,
    fill: { color: "EFF6FF" }, line: { color: C.sky, pt: 1.5 }, rectRadius: 0.08,
  });
  s.addText("⚖️  Référence réglementaire : BCEAO Instruction N° 008-05-2015 — Conservation des données de transactions pendant 5 ans · Déclaration mensuelle des transactions suspectes", {
    x: 0.55, y: 1.6, w: 8.9, h: 0.45,
    fontFace: FONT_B, fontSize: 11, color: C.navyMid, margin: 0,
  });

  // Left: 3 export endpoints
  const exports_data = [
    {
      icon: "💳", title: "Transactions",
      endpoint: "GET /tenants/{id}/export/transactions",
      filters: "Période · Fraude · Risque · Canal · Pays",
      color: C.navyMid,
    },
    {
      icon: "🚨", title: "Alertes fraude",
      endpoint: "GET /tenants/{id}/export/alerts",
      filters: "Période · Statut de traitement",
      color: C.danger,
    },
    {
      icon: "📋", title: "Journal d'audit",
      endpoint: "GET /export/audit-log",
      filters: "Période · Type d'action · Tenant",
      color: C.gold,
    },
  ];
  exports_data.forEach(({ icon, title, endpoint, filters, color }, i) => {
    const ey = 2.3 + i * 1.05;
    s.addShape("rect", {
      x: 0.35, y: ey, w: 5.2, h: 0.9,
      fill: { color: C.white }, line: { color, pt: 1.5 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    s.addText(icon, { x: 0.5, y: ey + 0.18, w: 0.5, h: 0.5, fontFace: "Arial", fontSize: 22, margin: 0 });
    s.addText(title, {
      x: 1.05, y: ey + 0.06, w: 3.5, h: 0.3,
      fontFace: FONT_H, fontSize: 14, bold: true, color, margin: 0,
    });
    s.addText(endpoint, {
      x: 1.05, y: ey + 0.35, w: 4.3, h: 0.25,
      fontFace: "Courier New", fontSize: 10, color: C.slate, margin: 0,
    });
    s.addText(`Filtres : ${filters}`, {
      x: 1.05, y: ey + 0.6, w: 4.3, h: 0.22,
      fontFace: FONT_B, fontSize: 10, color: C.muted, margin: 0,
    });
  });

  // Right column: technical features
  s.addShape("rect", {
    x: 5.8, y: 2.25, w: 3.85, h: 3.15,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.1,
  });
  s.addText("🛠️  Caractéristiques techniques", {
    x: 5.95, y: 2.33, w: 3.55, h: 0.35,
    fontFace: FONT_H, fontSize: 13, bold: true, color: C.navyMid, margin: 0,
  });

  const techFeats = [
    ["📡", "Streaming sans limite", "SQLAlchemy yield_per(500) — pas de saturation mémoire même sur 500k lignes"],
    ["📄", "BOM UTF-8 (utf-8-sig)", "Compatibilité Excel directe, sans problème d'encodage des caractères africains"],
    ["🔒", "Traçabilité complète", "Chaque export génère une entrée dans le journal d'audit (EXPORT_*)"],
    ["👁️", "Contrôle d'accès", "Admin voit tout · Tenant admin scopé à son seul établissement"],
  ];
  techFeats.forEach(([icon, title, desc], i) => {
    const ty = 2.78 + i * 0.65;
    s.addText(icon, { x: 5.95, y: ty, w: 0.35, h: 0.35, fontFace: "Arial", fontSize: 16, margin: 0 });
    s.addText(title, {
      x: 6.35, y: ty, w: 3.15, h: 0.26,
      fontFace: FONT_B, fontSize: 11, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(desc, {
      x: 6.35, y: ty + 0.27, w: 3.15, h: 0.32,
      fontFace: FONT_B, fontSize: 10.5, color: C.slate, margin: 0,
    });
  });

  // CSV columns table
  s.addShape("rect", {
    x: 0.35, y: 5.42, w: 9.3, h: 0.0,
    fill: { color: C.cardBorder }, line: { color: C.cardBorder, pt: 0.5 },
  });

  s.addNotes("Les exports sont en streaming — pas de chargement de 500k lignes en RAM. Le BOM UTF-8 permet à Excel d'ouvrir directement les CSV en France/Afrique sans problème d'encodage. Chaque export est tracé dans le journal d'audit pour garantir l'imputabilité.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — PORTAIL CLIENT
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Portail Client Dédié", "Interface séparée pour les établissements financiers (Tenant Admin)");

  // Left: portal navigation mockup
  s.addShape("rect", {
    x: 0.35, y: 1.55, w: 4.5, h: 3.95,
    fill: { color: C.white }, line: { color: "CBD5E1", pt: 1 },
    shadow: mkShadowStrong(), rectRadius: 0.1,
  });
  // Header bar
  s.addShape("rect", {
    x: 0.35, y: 1.55, w: 4.5, h: 0.42,
    fill: { color: "F1F5F9" }, line: { color: "E2E8F0" }, rectRadius: 0.1,
  });
  s.addShape("rect", {
    x: 0.35, y: 1.82, w: 4.5, h: 0.15,
    fill: { color: "F1F5F9" }, line: { color: "F1F5F9" },
  });
  ["EF4444", "F59E0B", "22C55E"].forEach((col, i) => {
    s.addShape("ellipse", { x: 0.55 + i * 0.25, y: 1.63, w: 0.14, h: 0.14, fill: { color: col }, line: { color: col } });
  });
  s.addText("🔒 localhost:3000/portal", {
    x: 1.3, y: 1.62, w: 2.5, h: 0.2,
    fontFace: FONT_B, fontSize: 8.5, color: C.slate, valign: "middle", margin: 0,
  });

  // Blue sidebar
  s.addShape("rect", {
    x: 0.35, y: 1.97, w: 1.2, h: 3.53,
    fill: { color: "1D4ED8" }, line: { color: "1D4ED8" },
  });
  s.addText("🛡️\nPortail", {
    x: 0.35, y: 2.02, w: 1.2, h: 0.55,
    fontFace: FONT_B, fontSize: 8.5, bold: true, color: C.white, align: "center", margin: 0,
  });
  const portalNav = ["📊 Tableau bord", "💳 Transactions", "🚨 Alertes", "📊 Analytique", "⚖️ Conformité", "⚙️ Config"];
  portalNav.forEach((item, i) => {
    if (i === 0) {
      s.addShape("rect", { x: 0.35, y: 2.72 + i * 0.45, w: 1.2, h: 0.36, fill: { color: "2563EB" }, line: { color: "2563EB" } });
    }
    s.addText(item, {
      x: 0.4, y: 2.75 + i * 0.45, w: 1.1, h: 0.28,
      fontFace: FONT_B, fontSize: 8, color: i === 0 ? C.white : "BFDBFE", margin: 0,
    });
  });

  // Main content of portal
  // KPI mini cards
  [["3 247", "Txn ce mois", "2563EB"], ["42", "Alertes", C.danger], ["1.29%", "Taux fraude", C.warning]].forEach(([v, l, col], i) => {
    const kx = 1.65 + i * 1.05;
    s.addShape("rect", {
      x: kx, y: 2.05, w: 0.95, h: 0.78,
      fill: { color: C.white }, line: { color: "E2E8F0", pt: 1 },
      shadow: mkShadow(), rectRadius: 0.07,
    });
    s.addText(v, {
      x: kx + 0.05, y: 2.1, w: 0.85, h: 0.36,
      fontFace: FONT_H, fontSize: 17, bold: true, color: col, align: "center", margin: 0,
    });
    s.addText(l, {
      x: kx + 0.05, y: 2.45, w: 0.85, h: 0.25,
      fontFace: FONT_B, fontSize: 8.5, color: C.slate, align: "center", margin: 0,
    });
  });

  // Conformité section in portal
  s.addShape("rect", {
    x: 1.65, y: 2.95, w: 3.05, h: 2.4,
    fill: { color: "F0F9FF" }, line: { color: "BAE6FD", pt: 1 }, rectRadius: 0.08,
  });
  s.addText("⚖️  Exports Conformité BCEAO", {
    x: 1.75, y: 3.02, w: 2.85, h: 0.3,
    fontFace: FONT_B, fontSize: 11, bold: true, color: "1D4ED8", margin: 0,
  });
  // Date picker
  s.addShape("rect", {
    x: 1.75, y: 3.4, w: 2.85, h: 0.55,
    fill: { color: C.white }, line: { color: "BAE6FD", pt: 1 }, rectRadius: 0.06,
  });
  s.addText("📅  01/05/2026  →  31/05/2026", {
    x: 1.85, y: 3.48, w: 2.6, h: 0.3,
    fontFace: FONT_B, fontSize: 10, color: C.navyMid, margin: 0,
  });
  const expBtns = ["📊 Toutes transactions", "🚨 Fraudes uniquement", "✓ Alertes confirmées"];
  expBtns.forEach((lbl, i) => {
    s.addShape("rect", {
      x: 1.75, y: 4.07 + i * 0.4, w: 2.85, h: 0.32,
      fill: { color: C.white }, line: { color: "BAE6FD", pt: 1 }, rectRadius: 0.06,
    });
    s.addText(lbl + "  ⬇", {
      x: 1.85, y: 4.1 + i * 0.4, w: 2.65, h: 0.25,
      fontFace: FONT_B, fontSize: 10, color: "1D4ED8", margin: 0,
    });
  });

  // Right: key differentiators
  s.addShape("rect", {
    x: 5.2, y: 1.55, w: 4.55, h: 3.95,
    fill: { color: C.white }, line: { color: C.cardBorder, pt: 1 },
    shadow: mkShadow(), rectRadius: 0.1,
  });
  s.addText("✦  Ce qui différencie le portail client", {
    x: 5.35, y: 1.65, w: 4.2, h: 0.38,
    fontFace: FONT_H, fontSize: 14, bold: true, color: C.navyMid, margin: 0,
  });

  const diffs = [
    { icon: "🔒", title: "Isolation totale", desc: "Un tenant ne voit jamais les données d'un autre établissement" },
    { icon: "🌐", title: "URL dédiée", desc: "/portal — layout distinct, branding bleu, accès direct par lien" },
    { icon: "📤", title: "Export autonome", desc: "Le responsable génère ses CSV BCEAO sans solliciter l'équipe IT" },
    { icon: "📊", title: "Analytique propre", desc: "Scoring, canaux, pays — filtré exclusivement sur son propre tenant" },
    { icon: "⚡", title: "Alertes temps réel", desc: "Notifications SSE identiques à l'interface admin" },
  ];
  diffs.forEach(({ icon, title, desc }, i) => {
    const dy = 2.18 + i * 0.67;
    s.addShape("rect", {
      x: 5.3, y: dy, w: 4.3, h: 0.57,
      fill: { color: i % 2 === 0 ? C.cardBg : C.white },
      line: { color: C.cardBorder, pt: 0.5 }, rectRadius: 0.07,
    });
    s.addText(icon, { x: 5.38, y: dy + 0.1, w: 0.38, h: 0.38, fontFace: "Arial", fontSize: 18, margin: 0 });
    s.addText(title, {
      x: 5.8, y: dy + 0.04, w: 3.6, h: 0.26,
      fontFace: FONT_B, fontSize: 12, bold: true, color: C.navyMid, margin: 0,
    });
    s.addText(desc, {
      x: 5.8, y: dy + 0.3, w: 3.6, h: 0.24,
      fontFace: FONT_B, fontSize: 10.5, color: C.slate, margin: 0,
    });
  });

  s.addNotes("Le portail client est une interface Next.js distincte (route group /portal) qui partage le même déploiement mais avec un layout, une navigation et des couleurs différentes. Le tenant_admin est redirigé automatiquement vers /portal après login, l'admin vers le dashboard principal.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — SÉCURITÉ
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Sécurité & Protection des Données", "Défense en profondeur — 11 contrôles de sécurité implémentés");

  // 2 columns x 3 rows of security cards
  const secItems = [
    { icon: "🔑", title: "Auth RS256 / JWKS", desc: "JWT Keycloak vérifié avec clé publique JWKS. Cache 1h avec fallback sur cache périmé en cas de panne Keycloak.", color: C.navyMid },
    { icon: "🚦", title: "Rate Limiting", desc: "100 req/min par IP. Fallback en mémoire si Redis indisponible — jamais fail-open.", color: C.sky },
    { icon: "🔐", title: "Blacklist JWT (JTI)", desc: "Invalidation immédiate des tokens après logout ou révocation. Stockée dans Redis.", color: C.purple },
    { icon: "📋", title: "Journal d'audit", desc: "Chaque action (alerte, export, login) tracée avec tenant_id, acteur, horodatage et résultat.", color: C.gold },
    { icon: "🏥", title: "Validation config", desc: "Clé secrète faible ou CORS=* → erreur au démarrage en production. Jamais de secrets par défaut.", color: C.danger },
    { icon: "🛡️", title: "Headers sécurité", desc: "CSP, X-Frame-Options DENY, HSTS (prod), X-Content-Type-Options sur toutes les réponses.", color: C.success },
    { icon: "🔒", title: "Isolation tenant", desc: "Chaque requête API filtre par tenant_id. Un tenant ne peut jamais accéder aux données d'un autre.", color: "7C3AED" },
    { icon: "📊", title: "Hashage modèle IA", desc: "SHA-256 du fichier .pkl vérifié au démarrage. Détecte toute corruption ou substitution malveillante.", color: C.navyLight },
    { icon: "🔄", title: "Rotation des secrets", desc: "JWKS rechargé toutes les heures. Token JWT expiration courte (15min). Refresh token séparé.", color: "0891B2" },
  ];

  secItems.forEach(({ icon, title, desc, color }, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = 0.35 + col * 3.22;
    const cy = 1.55 + row * 1.38;

    s.addShape("rect", {
      x: cx, y: cy, w: 3.05, h: 1.2,
      fill: { color: C.white }, line: { color, pt: 1.5 },
      shadow: mkShadow(), rectRadius: 0.1,
    });
    s.addShape("ellipse", {
      x: cx + 0.15, y: cy + 0.18, w: 0.52, h: 0.52,
      fill: { color, transparency: 80 }, line: { color, pt: 1 },
    });
    s.addText(icon, {
      x: cx + 0.12, y: cy + 0.14, w: 0.58, h: 0.58,
      fontFace: "Arial", fontSize: 20, align: "center", valign: "middle", margin: 0,
    });
    s.addText(title, {
      x: cx + 0.78, y: cy + 0.1, w: 2.15, h: 0.3,
      fontFace: FONT_B, fontSize: 12, bold: true, color, margin: 0,
    });
    s.addText(desc, {
      x: cx + 0.78, y: cy + 0.42, w: 2.15, h: 0.68,
      fontFace: FONT_B, fontSize: 10, color: C.slate, margin: 0,
    });
  });

  s.addNotes("11 contrôles de sécurité alignés OWASP Top 10. L'isolation tenant est le contrôle le plus critique : chaque query SQL inclut un filtre tenant_id qui ne peut pas être contourné par l'utilisateur. Le rate limiting a un fallback en mémoire — pas de fail-open si Redis tombe.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — TABLEAU RÉCAPITULATIF FONCTIONNALITÉS
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Récapitulatif des Fonctionnalités", "Couverture complète du cycle de vie de la fraude — de la détection à la conformité");

  const tableData = [
    [
      { text: "Fonctionnalité", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 11 } },
      { text: "Admin", options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center", fontSize: 11 } },
      { text: "Compliance", options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center", fontSize: 11 } },
      { text: "Tenant Admin", options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center", fontSize: 11 } },
      { text: "Analyste", options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center", fontSize: 11 } },
    ],
    ...([
      ["Tableau de bord temps réel", "✓", "✓", "✓", "✓"],
      ["Scoring IA des transactions", "✓", "—", "—", "—"],
      ["Gestion des alertes (qualifier/rejeter)", "✓", "—", "✓", "✓"],
      ["Historique transactions paginé", "✓", "✓", "✓", "✓"],
      ["Notifications SSE temps réel", "✓", "—", "✓", "✓"],
      ["Export CSV transactions (BCEAO)", "✓", "✓", "✓", "—"],
      ["Export CSV alertes", "✓", "✓", "✓", "—"],
      ["Journal d'audit complet", "✓", "✓", "—", "—"],
      ["Rapport conformité BCEAO", "✓", "✓", "✓", "—"],
      ["Gestion tenants & modèles IA", "✓", "—", "—", "—"],
      ["Portail client dédié (/portal)", "—", "—", "✓", "—"],
    ].map((row, ri) => {
      const isEven = ri % 2 === 0;
      const rowBg = isEven ? C.white : "F0F6FF";
      return row.map((cell, ci) => {
        if (ci === 0) {
          return { text: cell, options: { fontSize: 11, color: C.navyMid, fill: { color: rowBg } } };
        }
        const isCheck = cell === "✓";
        const isDash = cell === "—";
        return {
          text: cell,
          options: {
            fontSize: 13, bold: isCheck, align: "center",
            color: isCheck ? C.success : (isDash ? C.muted : C.navyMid),
            fill: { color: rowBg },
          },
        };
      });
    })),
  ];

  s.addTable(tableData, {
    x: 0.35, y: 1.55, w: 9.3, h: 3.95,
    colW: [3.5, 1.2, 1.2, 1.45, 1.2],
    border: { pt: 0.5, color: "E2E8F0" },
    rowH: 0.33,
  });

  s.addNotes("Matrice complète des droits par rôle. Le tableau montre la granularité du contrôle d'accès. Un analyste peut qualifier des alertes mais ne peut pas exporter. Un compliance officer peut tout lire et exporter mais ne peut pas modifier les données.");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 13 — FEUILLE DE ROUTE
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setLightBg(s);
  addDarkBand(s, "Feuille de Route", "Prochaines étapes — Q3/Q4 2026");

  const phases = [
    {
      quarter: "Livré", color: C.success, status: "✅ Terminé",
      items: [
        "Tableau de bord enrichi — KPIs réels & graphiques avancés",
        "Webhooks fraude — déclenchement auto à la détection",
        "Notifications SSE temps réel (bell + badge)",
        "Dark mode & portail conformité export",
      ],
    },
    {
      quarter: "Q3 2026", color: C.sky, status: "En cours",
      items: [
        "API Keys — UI génération & révocation",
        "Dashboard multi-tenant comparatif (admin)",
        "Pages 404 / 500 personnalisées",
        "Explainabilité IA (SHAP values sur alertes)",
      ],
    },
    {
      quarter: "Q4 2026", color: C.gold, status: "Planifié",
      items: [
        "Modèle IA v2 (XGBoost + ensemble)",
        "Intégration SWIFT GPI cross-border",
        "Application mobile (React Native)",
        "Certification ISO 27001 & déploiement UEMOA",
      ],
    },
  ];

  phases.forEach(({ quarter, color, status, items }, i) => {
    const px = 0.35 + i * 3.22;

    // Top status badge
    s.addShape("rect", {
      x: px + 0.5, y: 1.55, w: 2.0, h: 0.38,
      fill: { color }, line: { color }, rectRadius: 0.1,
    });
    s.addText(status, {
      x: px + 0.5, y: 1.55, w: 2.0, h: 0.38,
      fontFace: FONT_B, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // Quarter label
    s.addText(quarter, {
      x: px, y: 2.05, w: 3.0, h: 0.52,
      fontFace: FONT_H, fontSize: 28, bold: true, color, align: "center", margin: 0,
    });

    // Items box
    s.addShape("rect", {
      x: px, y: 2.68, w: 3.05, h: 2.75,
      fill: { color: C.white }, line: { color, pt: 1.5 },
      shadow: mkShadow(), rectRadius: 0.1,
    });

    items.forEach((item, ii) => {
      const iy = 2.85 + ii * 0.62;
      s.addShape("ellipse", {
        x: px + 0.2, y: iy + 0.08, w: 0.28, h: 0.28,
        fill: { color }, line: { color },
      });
      s.addText(item, {
        x: px + 0.58, y: iy, w: 2.35, h: 0.5,
        fontFace: FONT_B, fontSize: 11, color: C.navyMid, margin: 0,
      });
    });
  });

  // Progress bar at bottom
  s.addShape("rect", {
    x: 0.35, y: 5.2, w: 9.3, h: 0.22,
    fill: { color: "E2E8F0" }, line: { color: "E2E8F0" }, rectRadius: 0.05,
  });
  s.addShape("rect", {
    x: 0.35, y: 5.2, w: 4.1, h: 0.22,
    fill: { color: C.sky }, line: { color: C.sky }, rectRadius: 0.05,
  });
  s.addText("Progression globale : 44%", {
    x: 0.35, y: 5.42, w: 9.3, h: 0.2,
    fontFace: FONT_B, fontSize: 10, color: C.slate, align: "center", margin: 0,
  });

  s.addNotes("La roadmap Q3 2026 est déjà en cours de développement. Prioriser les features à haute valeur réglementaire (explainabilité SHAP pour justifier les décisions d'alerte aux auditeurs BCEAO).");
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 14 — CONCLUSION
// ════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Decorative circles
  [[9.5, 0.8, 2.2], [9.2, 4.5, 1.5], [0.3, 5.0, 1.0]].forEach(([cx, cy, r]) => {
    s.addShape("ellipse", {
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      fill: { color: C.navyLight, transparency: 65 },
      line: { color: C.sky, pt: 1, transparency: 40 },
    });
  });

  s.addText("🛡️", {
    x: 4.2, y: 0.5, w: 1.6, h: 1.2,
    fontFace: "Arial", fontSize: 55, align: "center", valign: "middle", margin: 0,
  });

  s.addText("FraudGuard", {
    x: 1, y: 1.6, w: 8, h: 0.9,
    fontFace: FONT_H, fontSize: 48, bold: true, color: C.white, align: "center", margin: 0,
  });

  s.addShape("rect", {
    x: 3.2, y: 2.55, w: 3.6, h: 0.07,
    fill: { color: C.sky }, line: { color: C.sky },
  });

  s.addText("Protéger chaque transaction.\nConformer chaque rapport.", {
    x: 0.5, y: 2.72, w: 9, h: 0.95,
    fontFace: FONT_B, fontSize: 19, color: C.skyLight, align: "center", italic: true, margin: 0,
  });

  // 3 summary pillars
  const pillars = [
    { icon: "⚡", text: "Détection\n< 50ms" },
    { icon: "⚖️", text: "Conforme\nBCEAO" },
    { icon: "🔒", text: "Sécurisé\nISO-ready" },
  ];
  pillars.forEach(({ icon, text }, i) => {
    const px = 2.3 + i * 2.15;
    s.addShape("ellipse", {
      x: px, y: 3.88, w: 1.4, h: 1.4,
      fill: { color: C.navyLight }, line: { color: C.sky, pt: 2 },
    });
    s.addText(icon, {
      x: px, y: 3.88, w: 1.4, h: 0.75,
      fontFace: "Arial", fontSize: 28, align: "center", valign: "middle", margin: 0,
    });
    s.addText(text, {
      x: px - 0.2, y: 4.6, w: 1.8, h: 0.55,
      fontFace: FONT_B, fontSize: 12, bold: true, color: C.skyLight, align: "center", margin: 0,
    });
  });

  // Contact
  s.addShape("rect", {
    x: 0, y: 5.05, w: 10, h: 0.575,
    fill: { color: C.navyMid }, line: { color: C.navyMid },
  });
  s.addText("📧  melombaoh@gmail.com  ·  🐙  github.com/melessmb/fraud_guard  ·  Box Africa  ·  2026", {
    x: 0.5, y: 5.1, w: 9, h: 0.45,
    fontFace: FONT_B, fontSize: 12, color: C.muted, align: "center", margin: 0,
  });

  s.addNotes("Slide de conclusion. FraudGuard est une solution complète, opérationnelle, alignée BCEAO. Ouverture sur les prochaines étapes et invitation aux questions.");
}

// ── Write ─────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "FraudGuard_Presentation.pptx" })
  .then(() => console.log("✅ FraudGuard_Presentation.pptx généré"))
  .catch(err => { console.error("❌", err); process.exit(1); });
