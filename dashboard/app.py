"""Dashboard d'administration FraudGuard — style fintech clair."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional
import random

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st

# ── Config page ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="FraudGuard Admin",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Palette & CSS ─────────────────────────────────────────────────────────────
GREEN       = "#16a34a"
GREEN_BG    = "#f0fdf4"
GREEN_BORDER= "#bbf7d0"
RED         = "#ef4444"
RED_BG      = "#fee2e2"
AMBER       = "#f59e0b"
AMBER_BG    = "#fef3c7"
GRAY_BG     = "#f5f5f4"
BORDER      = "#e5e7eb"
TEXT        = "#111827"
TEXT_MUT    = "#6b7280"
WHITE       = "#ffffff"

st.markdown(f"""
<style>
/* Reset & base */
html, body, [data-testid="stApp"] {{
    background: {GRAY_BG} !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}}
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stHeader"] {{
    display: none !important;
}}
.block-container {{
    padding: 0 !important;
    max-width: 100% !important;
}}

/* Sidebar */
[data-testid="stSidebar"] {{
    background: {WHITE} !important;
    border-right: 0.5px solid {BORDER} !important;
}}
[data-testid="stSidebar"] .stRadio label {{
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    padding: 9px 12px !important;
    border-radius: 8px !important;
    font-size: 14px !important;
    color: {TEXT_MUT} !important;
    cursor: pointer !important;
    width: 100% !important;
}}
[data-testid="stSidebar"] .stRadio [data-testid="stMarkdownContainer"] p {{
    font-size: 13px !important;
    margin: 0 !important;
}}

/* Cards */
.fg-card {{
    background: {WHITE};
    border-radius: 12px;
    border: 0.5px solid {BORDER};
    padding: 18px 20px;
}}
.fg-kpi-label {{
    font-size: 12px;
    color: {TEXT_MUT};
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}}
.fg-kpi-label a {{
    font-size: 11px;
    color: {GREEN};
    font-weight: 500;
    text-decoration: none;
}}
.fg-kpi-value {{
    font-size: 24px;
    font-weight: 600;
    color: {TEXT};
    line-height: 1.15;
    margin-bottom: 3px;
}}
.fg-delta-pos {{ font-size: 12px; color: {GREEN}; font-weight: 500; }}
.fg-delta-neg {{ font-size: 12px; color: {RED};   font-weight: 500; }}
.fg-delta-neu {{ font-size: 12px; color: {AMBER}; font-weight: 500; }}

/* Section title */
.fg-section {{
    font-size: 15px;
    font-weight: 600;
    color: {TEXT};
    margin-bottom: 14px;
}}

/* Badges */
.badge-fraud   {{ display:inline-block; background:{RED_BG};   color:#b91c1c; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}
.badge-review  {{ display:inline-block; background:{AMBER_BG}; color:#92400e; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}
.badge-ok      {{ display:inline-block; background:{GREEN_BG}; color:#166534; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}

/* Alert table */
.fg-table {{ width:100%; border-collapse:collapse; font-size:13px; }}
.fg-table th {{ color:{TEXT_MUT}; font-weight:400; text-align:left; padding:6px 10px; border-bottom:0.5px solid {BORDER}; }}
.fg-table td {{ padding:9px 10px; border-bottom:0.5px solid {BORDER}; color:{TEXT}; }}
.fg-table tr:last-child td {{ border-bottom:none; }}

/* Progress bars */
.fg-bar-wrap {{ height:5px; background:#f3f4f6; border-radius:3px; margin-top:4px; }}
.fg-bar {{ height:5px; border-radius:3px; background:{GREEN}; }}

/* Topbar */
.fg-topbar {{
    background: {WHITE};
    border-bottom: 0.5px solid {BORDER};
    padding: 14px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}}
.fg-topbar-title {{ font-size: 18px; font-weight: 600; color: {TEXT}; }}
.fg-topbar-sub   {{ font-size: 12px; color: {TEXT_MUT}; margin-top: 1px; }}
.fg-avatar {{
    width: 30px; height: 30px; border-radius: 50%;
    background: {GREEN}; color: #fff;
    font-size: 11px; font-weight: 600;
    display: inline-flex; align-items: center; justify-content: center;
}}
</style>
""", unsafe_allow_html=True)

# ── Session state defaults ────────────────────────────────────────────────────
_D = {
    "api_url":    "http://localhost:8780",
    "admin_key":  "",
    "tenant_key": "",
    "tenant_id":  1,
    "score_history": [],
}
for k, v in _D.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── API helpers ───────────────────────────────────────────────────────────────
def _hdrs(*, admin=False, tenant=False) -> dict:
    h: dict[str, str] = {}
    if admin  and st.session_state["admin_key"]:
        h["X-Admin-Key"] = st.session_state["admin_key"]
    if tenant and st.session_state["tenant_key"]:
        h["X-API-Key"] = st.session_state["tenant_key"]
    return h

def api_get(path: str, *, admin=False, tenant=False, params=None) -> Optional[Any]:
    try:
        r = requests.get(
            f"{st.session_state['api_url']}{path}",
            headers=_hdrs(admin=admin, tenant=tenant),
            params=params, timeout=6,
        )
        if r.status_code == 403:
            st.warning("Clé manquante ou incorrecte (403).")
            return None
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        st.error("API hors ligne — vérifiez que le backend est démarré.")
    except requests.exceptions.HTTPError as e:
        st.error(f"Erreur {e.response.status_code} : {e.response.text[:200]}")
    except Exception as e:
        st.error(f"Erreur : {e}")
    return None

def api_post(path: str, payload: dict, *, admin=False, tenant=False) -> Optional[Any]:
    try:
        r = requests.post(
            f"{st.session_state['api_url']}{path}",
            json=payload,
            headers=_hdrs(admin=admin, tenant=tenant),
            timeout=10,
        )
        if r.status_code == 403:
            st.warning("Clé manquante ou incorrecte (403).")
            return None
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        st.error("API hors ligne.")
    except requests.exceptions.HTTPError as e:
        st.error(f"Erreur {e.response.status_code} : {e.response.text[:200]}")
    except Exception as e:
        st.error(f"Erreur : {e}")
    return None

def risk_color(s: float) -> str:
    return GREEN if s < 0.5 else (AMBER if s < 0.7 else RED)

def risk_label(s: float) -> str:
    return "Faible" if s < 0.5 else ("Moyen" if s < 0.7 else "Élevé")

# ── Sparkline helper ──────────────────────────────────────────────────────────
def sparkline_fig(values: list[float], color: str) -> go.Figure:
    fig = go.Figure(go.Scatter(
        y=values, mode="lines",
        line=dict(color=color, width=1.8),
        fill="tozeroy",
        fillcolor=color.replace(")", ",0.08)").replace("rgb", "rgba") if "rgb" in color else f"{color}14",
    ))
    fig.update_layout(
        height=40, margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=False), yaxis=dict(visible=False),
        showlegend=False,
    )
    return fig

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:10px;padding:4px 0 18px;">
      <div style="width:32px;height:32px;border-radius:8px;background:{GREEN};display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span style="font-size:16px;font-weight:600;color:{TEXT};">FraudGuard</span>
    </div>
    """, unsafe_allow_html=True)

    st.markdown(f"<p style='font-size:11px;color:{TEXT_MUT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;'>Menu</p>", unsafe_allow_html=True)
    page = st.radio("", [
        "📊  Dashboard",
        "📈  Analytique",
        "🚨  Alertes",
        "⚡  Scoring",
        "🏢  Tenants",
        "🤖  Modèles",
    ], label_visibility="collapsed")

    st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:16px 0 12px;'>", unsafe_allow_html=True)
    st.markdown(f"<p style='font-size:11px;color:{TEXT_MUT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;'>Configuration</p>", unsafe_allow_html=True)

    st.session_state["api_url"]    = st.text_input("URL API",           value=st.session_state["api_url"],    label_visibility="collapsed", placeholder="http://localhost:8780")
    st.session_state["admin_key"]  = st.text_input("Clé Admin",         value=st.session_state["admin_key"],  type="password", label_visibility="collapsed", placeholder="X-Admin-Key")
    st.session_state["tenant_key"] = st.text_input("Clé Tenant",        value=st.session_state["tenant_key"], type="password", label_visibility="collapsed", placeholder="X-API-Key")
    st.session_state["tenant_id"]  = st.number_input("Tenant ID", min_value=1, value=st.session_state["tenant_id"], label_visibility="collapsed")

    st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:12px 0;'>", unsafe_allow_html=True)
    try:
        _h = requests.get(f"{st.session_state['api_url']}/health", timeout=2)
        ver = _h.json().get("version", "?") if _h.ok else "?"
        st.markdown(f"<div style='display:flex;align-items:center;gap:7px;font-size:12px;'><span style='width:7px;height:7px;border-radius:50%;background:{GREEN};display:inline-block;'></span><span style='color:{GREEN};font-weight:500;'>API en ligne — v{ver}</span></div>", unsafe_allow_html=True)
    except Exception:
        st.markdown(f"<div style='display:flex;align-items:center;gap:7px;font-size:12px;'><span style='width:7px;height:7px;border-radius:50%;background:{RED};display:inline-block;'></span><span style='color:{RED};font-weight:500;'>API hors ligne</span></div>", unsafe_allow_html=True)

# ── Top bar ───────────────────────────────────────────────────────────────────
tid  = st.session_state["tenant_id"]
now  = datetime.now()
jours = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
mois  = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
date_str = f"{jours[now.weekday()]} {now.day} {mois[now.month-1]} {now.year}"

st.markdown(f"""
<div class="fg-topbar">
  <div>
    <div class="fg-topbar-title">Bonjour, Admin</div>
    <div class="fg-topbar-sub">{date_str} &nbsp;·&nbsp; Tenant actif : ID {tid}</div>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{TEXT_MUT}" stroke-width="1.8" aria-label="Notifications"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border:0.5px solid {BORDER};border-radius:20px;">
      <div class="fg-avatar">AD</div>
      <span style="font-size:13px;color:{TEXT};font-weight:500;">Admin</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{TEXT_MUT}" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Dashboard
# ═══════════════════════════════════════════════════════════════════════════════
if "Dashboard" in page:
    st.markdown("<div style='padding:20px 28px 0;'>", unsafe_allow_html=True)

    metrics = api_get(f"/api/v1/tenants/{tid}/metrics")
    alerts  = api_get(f"/api/v1/tenants/{tid}/alerts")

    # KPI sparkline data (simulé si pas de données temps-réel)
    random.seed(42)
    spark_txn    = [random.randint(150, 300) for _ in range(14)]
    spark_fraud  = [random.randint(1, 8)     for _ in range(14)]
    spark_rate   = [round(random.uniform(2.0, 4.5), 1) for _ in range(14)]
    spark_score  = [round(random.uniform(0.72, 0.92), 2) for _ in range(14)]

    txn_count   = metrics.get("transaction_count", 0) if metrics else 0
    fraud_count = metrics.get("fraud_count", 0)        if metrics else 0
    fraud_rate  = metrics.get("detection_rate", 0)     if metrics else 0.0
    model_ver   = metrics.get("model_version", "—")    if metrics else "—"

    # ── KPI row ───────────────────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4, gap="small")

    with k1:
        st.markdown(f"""<div class="fg-card">
          <div class="fg-kpi-label">Total transactions <a href="#">Voir plus</a></div>
          <div class="fg-kpi-value">{txn_count:,}</div>
          <div class="fg-delta-pos">+12% vs mois dernier</div>
        </div>""", unsafe_allow_html=True)
        st.plotly_chart(sparkline_fig(spark_txn, GREEN), use_container_width=True, config={"displayModeBar": False}, key="sp1")

    with k2:
        st.markdown(f"""<div class="fg-card">
          <div class="fg-kpi-label">Fraudes détectées <a href="#">Voir plus</a></div>
          <div class="fg-kpi-value">{fraud_count:,}</div>
          <div class="fg-delta-neg">+4% vs mois dernier</div>
        </div>""", unsafe_allow_html=True)
        st.plotly_chart(sparkline_fig(spark_fraud, RED), use_container_width=True, config={"displayModeBar": False}, key="sp2")

    with k3:
        st.markdown(f"""<div class="fg-card">
          <div class="fg-kpi-label">Taux de fraude <a href="#">Voir plus</a></div>
          <div class="fg-kpi-value">{fraud_rate:.1%}</div>
          <div class="fg-delta-pos">−0.4% vs mois dernier</div>
        </div>""", unsafe_allow_html=True)
        st.plotly_chart(sparkline_fig(spark_rate, GREEN), use_container_width=True, config={"displayModeBar": False}, key="sp3")

    with k4:
        st.markdown(f"""<div class="fg-card">
          <div class="fg-kpi-label">Modèle actif <a href="#">Voir plus</a></div>
          <div class="fg-kpi-value" style="font-size:16px;margin-top:4px;">{model_ver}</div>
          <div class="fg-delta-neu">Seuil : 0.70</div>
        </div>""", unsafe_allow_html=True)
        st.plotly_chart(sparkline_fig(spark_score, AMBER), use_container_width=True, config={"displayModeBar": False}, key="sp4")

    # ── Activité chart ────────────────────────────────────────────────────────
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-card'>", unsafe_allow_html=True)

    # Période selector
    hdr_l, hdr_r = st.columns([3, 1])
    hdr_l.markdown(f"<div class='fg-section' style='margin-bottom:0;'>Activité des transactions</div>", unsafe_allow_html=True)
    with hdr_r:
        period = st.segmented_control("p", ["1S", "1M", "6M", "1A"], default="1S", label_visibility="collapsed")

    nb = {"1S": 7, "1M": 30, "6M": 180, "1A": 365}.get(period or "1S", 7)
    dates = [now - timedelta(days=i) for i in range(nb - 1, -1, -1)]
    leg_vals   = [random.randint(100, 400) for _ in dates]
    fraud_vals = [random.randint(0, 12)    for _ in dates]
    date_strs  = [d.strftime("%d %b") for d in dates]

    fig_area = go.Figure()
    fig_area.add_trace(go.Scatter(
        x=date_strs, y=leg_vals, name="Légitimes",
        mode="lines", line=dict(color=GREEN, width=2),
        fill="tozeroy", fillcolor=f"{GREEN}18",
    ))
    fig_area.add_trace(go.Scatter(
        x=date_strs, y=fraud_vals, name="Fraudes",
        mode="lines", line=dict(color=RED, width=1.5),
        fill="tozeroy", fillcolor=f"{RED}12",
    ))
    fig_area.update_layout(
        height=220, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        legend=dict(orientation="h", y=1.12, x=0, font=dict(size=12)),
        xaxis=dict(showgrid=False, tickfont=dict(size=11, color=TEXT_MUT), tickangle=0,
                   nticks=8, showline=False, zeroline=False),
        yaxis=dict(showgrid=True, gridcolor="#f3f4f6", tickfont=dict(size=11, color=TEXT_MUT),
                   showline=False, zeroline=False),
        hovermode="x unified",
    )
    st.plotly_chart(fig_area, use_container_width=True, config={"displayModeBar": False})
    st.markdown("</div>", unsafe_allow_html=True)

    # ── Bottom row ────────────────────────────────────────────────────────────
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    col_table, col_canal = st.columns([2, 1], gap="small")

    with col_table:
        st.markdown(f"""<div class="fg-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span class="fg-section" style="margin:0;">Alertes récentes</span>
          </div>""", unsafe_allow_html=True)

        df_alerts = pd.DataFrame(alerts) if alerts else pd.DataFrame()
        if not df_alerts.empty:
            rows = df_alerts.head(5)
            table_rows = ""
            for _, row in rows.iterrows():
                score = row.get("score", 0)
                badge = f'<span class="badge-fraud">Fraude</span>' if score >= 0.7 else f'<span class="badge-review">Révision</span>' if score >= 0.5 else f'<span class="badge-ok">Légitime</span>'
                ts = str(row.get("timestamp", ""))[:16].replace("T", " · ")
                table_rows += f"""<tr>
                  <td style='color:{TEXT_MUT};'>{ts}</td>
                  <td><strong>{row.get('transaction_id','—')}</strong></td>
                  <td style='color:{TEXT_MUT};'>{row.get('channel','—')}</td>
                  <td style='text-align:right;font-weight:500;'>{row.get('amount',0):,.0f} {row.get('currency','XOF')}</td>
                  <td style='text-align:center;'>{badge}</td>
                </tr>"""
            st.markdown(f"""<table class="fg-table">
              <thead><tr>
                <th>Date</th><th>Transaction</th><th>Canal</th>
                <th style='text-align:right;'>Montant</th><th style='text-align:center;'>Statut</th>
              </tr></thead>
              <tbody>{table_rows}</tbody>
            </table>""", unsafe_allow_html=True)
        else:
            st.markdown("<p style='color:#6b7280;font-size:13px;'>Aucune alerte disponible.</p>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with col_canal:
        canals = {"mobile_money": 50, "web": 25, "pos": 15, "atm": 10}
        if not df_alerts.empty and "channel" in df_alerts.columns:
            vc = df_alerts["channel"].value_counts(normalize=True) * 100
            canals = {k: round(v) for k, v in vc.items()}

        bars_html = ""
        for name, pct in canals.items():
            bars_html += f"""
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:12px;color:{TEXT_MUT};">{name}</span>
                <span style="font-size:12px;font-weight:500;color:{TEXT};">{pct}%</span>
              </div>
              <div class="fg-bar-wrap"><div class="fg-bar" style="width:{pct}%;opacity:{0.4 + pct/100};"></div></div>
            </div>"""

        st.markdown(f"""<div class="fg-card" style="height:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <span class="fg-section" style="margin:0;">Par canal</span>
          </div>
          {bars_html}
          <div style="margin-top:14px;padding-top:12px;border-top:0.5px solid {BORDER};">
            <div style="display:flex;justify-content:space-between;">
              <div>
                <div style="font-size:20px;font-weight:600;color:{TEXT};">80%</div>
                <div style="font-size:11px;color:{GREEN};">transactions légitimes</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px;font-weight:600;color:{TEXT};">20%</div>
                <div style="font-size:11px;color:{RED};">sous surveillance</div>
              </div>
            </div>
            <div class="fg-bar-wrap" style="margin-top:8px;height:7px;">
              <div class="fg-bar" style="width:80%;height:7px;"></div>
            </div>
          </div>
        </div>""", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Analytique
# ═══════════════════════════════════════════════════════════════════════════════
elif "Analytique" in page:
    st.markdown("<div style='padding:20px 28px;'>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-section' style='font-size:18px;'>Analytique</div>", unsafe_allow_html=True)
    alerts = api_get(f"/api/v1/tenants/{tid}/alerts")
    if alerts:
        df = pd.DataFrame(alerts)
        if not df.empty:
            c1, c2 = st.columns(2, gap="small")
            with c1:
                vc = df["channel"].value_counts().reset_index()
                vc.columns = ["Canal", "Fraudes"]
                fig = go.Figure(go.Bar(
                    x=vc["Canal"], y=vc["Fraudes"],
                    marker_color=GREEN, text=vc["Fraudes"], textposition="outside",
                ))
                fig.update_layout(
                    title="Fraudes par canal", height=280,
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    margin=dict(l=0, r=0, t=40, b=0),
                    yaxis=dict(showgrid=True, gridcolor="#f3f4f6"),
                    xaxis=dict(showgrid=False),
                )
                st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
                st.markdown("</div>", unsafe_allow_html=True)
            with c2:
                fig2 = go.Figure(go.Histogram(
                    x=df["score"], nbinsx=20,
                    marker_color=RED, opacity=0.8,
                ))
                fig2.add_vline(x=0.7, line_dash="dash", line_color=AMBER, annotation_text="Seuil 0.70")
                fig2.update_layout(
                    title="Distribution des scores",
                    height=280, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    margin=dict(l=0, r=0, t=40, b=0),
                    yaxis=dict(showgrid=True, gridcolor="#f3f4f6"),
                    xaxis=dict(showgrid=False),
                )
                st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
                st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
                st.markdown("</div>", unsafe_allow_html=True)

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
            fig3 = go.Figure(go.Scatter(
                x=df["amount"], y=df["score"],
                mode="markers",
                marker=dict(color=RED, opacity=0.6, size=7),
            ))
            fig3.add_hline(y=0.7, line_dash="dash", line_color=AMBER, annotation_text="Seuil")
            fig3.update_layout(
                title="Score vs Montant", height=240,
                xaxis_title="Montant (XOF)", yaxis_title="Score de fraude",
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                margin=dict(l=0, r=0, t=40, b=0),
                yaxis=dict(showgrid=True, gridcolor="#f3f4f6"),
                xaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})
            st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.info("Aucune donnée disponible.")
    st.markdown("</div>", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Alertes
# ═══════════════════════════════════════════════════════════════════════════════
elif "Alertes" in page:
    st.markdown("<div style='padding:20px 28px;'>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-section' style='font-size:18px;'>Alertes de fraude</div>", unsafe_allow_html=True)

    f1, f2 = st.columns([3, 2], gap="small")
    with f1:
        filtre_canal = st.multiselect("Canal", ["mobile_money", "web", "pos", "atm"], placeholder="Tous les canaux")
    with f2:
        montant_min = st.number_input("Montant minimum (XOF)", min_value=0, value=0, step=10_000)

    data = api_get(f"/api/v1/tenants/{tid}/alerts")
    if data is not None:
        df = pd.DataFrame(data)
        if df.empty:
            st.success("Aucune fraude détectée pour ce tenant.")
        else:
            if filtre_canal:
                df = df[df["channel"].isin(filtre_canal)]
            if montant_min > 0:
                df = df[df["amount"] >= montant_min]

            st.markdown(f"<div class='fg-card'>", unsafe_allow_html=True)
            st.markdown(f"<div style='font-size:13px;color:{TEXT_MUT};margin-bottom:10px;'>{len(df)} alerte(s) correspondante(s)</div>", unsafe_allow_html=True)

            if not df.empty:
                rows_html = ""
                for _, row in df.iterrows():
                    score = row.get("score", 0)
                    badge = f'<span class="badge-fraud">Fraude</span>' if score >= 0.7 else f'<span class="badge-review">Révision</span>' if score >= 0.5 else f'<span class="badge-ok">Légitime</span>'
                    ts = str(row.get("timestamp", ""))[:16].replace("T", " · ")
                    rows_html += f"""<tr>
                      <td style='color:{TEXT_MUT};'>{ts}</td>
                      <td><strong>{row.get('transaction_id','—')}</strong></td>
                      <td style='color:{TEXT_MUT};'>{row.get('channel','—')}</td>
                      <td style='text-align:right;font-weight:500;'>{row.get('amount',0):,.0f} {row.get('currency','XOF')}</td>
                      <td style='text-align:center;'>{score:.2%}</td>
                      <td style='text-align:center;'>{badge}</td>
                    </tr>"""
                st.markdown(f"""<table class="fg-table">
                  <thead><tr>
                    <th>Date</th><th>Transaction</th><th>Canal</th>
                    <th style='text-align:right;'>Montant</th>
                    <th style='text-align:center;'>Score</th>
                    <th style='text-align:center;'>Statut</th>
                  </tr></thead>
                  <tbody>{rows_html}</tbody>
                </table>""", unsafe_allow_html=True)
            else:
                st.info("Aucune alerte ne correspond aux filtres.")
            st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Scoring
# ═══════════════════════════════════════════════════════════════════════════════
elif "Scoring" in page:
    st.markdown("<div style='padding:20px 28px;'>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-section' style='font-size:18px;'>Scoring temps réel</div>", unsafe_allow_html=True)

    st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
    with st.form("score_form"):
        c1, c2 = st.columns(2)
        with c1:
            txn_id   = st.text_input("ID Transaction", value=f"txn-{now.strftime('%H%M%S')}")
            amount   = st.number_input("Montant", min_value=0.0, value=50_000.0, step=1_000.0)
            currency = st.selectbox("Devise", ["XOF", "USD", "EUR", "GNF"])
            channel  = st.selectbox("Canal", ["mobile_money", "web", "pos", "atm"])
        with c2:
            country   = st.selectbox("Pays", ["CI", "SN", "GH", "BJ", "ML"])
            device_fp = st.text_input("Device Fingerprint", value="fp-demo-001")
            ip_addr   = st.text_input("Adresse IP", value="41.203.72.1")
            ts        = st.text_input("Timestamp", value=now.strftime("%Y-%m-%dT%H:%M:%S"))
        submit = st.form_submit_button("Analyser la transaction", type="primary", use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

    if submit:
        with st.spinner("Analyse en cours…"):
            result = api_post("/api/v1/score", {
                "transaction_id": txn_id, "tenant_id": tid,
                "amount": amount, "currency": currency, "channel": channel,
                "country": country, "device_fingerprint": device_fp,
                "ip_address": ip_addr, "timestamp": ts,
            }, tenant=True)

        if result:
            score = result.get("score", 0.0)
            is_fraud = result.get("is_fraud", False)
            model_ver = result.get("model_version", "—")
            explanations = result.get("explanations") or {}

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            cg, cs = st.columns(2, gap="small")

            with cg:
                color = risk_color(score)
                fig_g = go.Figure(go.Indicator(
                    mode="gauge+number",
                    value=round(score * 100, 1),
                    number={"suffix": "%", "font": {"size": 40, "color": color}},
                    title={"text": f"Score · <b>{risk_label(score)}</b>", "font": {"size": 14, "color": TEXT_MUT}},
                    gauge={
                        "axis": {"range": [0, 100], "tickcolor": BORDER},
                        "bar":  {"color": color, "thickness": 0.25},
                        "bgcolor": WHITE,
                        "borderwidth": 0,
                        "steps": [
                            {"range": [0, 50],  "color": "#f0fdf4"},
                            {"range": [50, 70], "color": "#fef3c7"},
                            {"range": [70, 100],"color": "#fee2e2"},
                        ],
                        "threshold": {"line": {"color": RED, "width": 3}, "thickness": 0.8, "value": 70},
                    },
                ))
                fig_g.update_layout(
                    height=280, margin=dict(t=60, b=10, l=30, r=30),
                    paper_bgcolor=WHITE, font_color=TEXT,
                )
                st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
                st.plotly_chart(fig_g, use_container_width=True, config={"displayModeBar": False})
                if is_fraud:
                    st.markdown(f"<div style='text-align:center;margin-top:-8px;'><span class='badge-fraud' style='font-size:13px;padding:5px 16px;'>Fraude détectée — transaction bloquée</span></div>", unsafe_allow_html=True)
                else:
                    st.markdown(f"<div style='text-align:center;margin-top:-8px;'><span class='badge-ok' style='font-size:13px;padding:5px 16px;'>Transaction légitime — approuvée</span></div>", unsafe_allow_html=True)
                st.markdown(f"<p style='text-align:center;font-size:11px;color:{TEXT_MUT};margin-top:8px;'>Modèle : <code>{model_ver}</code></p>", unsafe_allow_html=True)
                st.markdown("</div>", unsafe_allow_html=True)

            with cs:
                shap_vals = {k: v for k, v in explanations.items() if isinstance(v, (int, float))}
                if shap_vals:
                    shap_df = pd.DataFrame(
                        sorted(shap_vals.items(), key=lambda x: abs(x[1]), reverse=True),
                        columns=["Feature", "Impact"]
                    ).head(8)
                    colors = [RED if v > 0 else GREEN for v in shap_df["Impact"]]
                    fig_s = go.Figure(go.Bar(
                        x=shap_df["Impact"], y=shap_df["Feature"],
                        orientation="h", marker_color=colors,
                    ))
                    fig_s.update_layout(
                        title="Facteurs déterminants (SHAP)",
                        height=280, margin=dict(t=40, b=10, l=10, r=10),
                        paper_bgcolor=WHITE, plot_bgcolor=WHITE,
                        font_color=TEXT,
                        yaxis=dict(categoryorder="total ascending", tickfont=dict(size=12)),
                        xaxis=dict(showgrid=True, gridcolor="#f3f4f6", zeroline=True, zerolinecolor=BORDER),
                    )
                    st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
                    st.plotly_chart(fig_s, use_container_width=True, config={"displayModeBar": False})
                    st.markdown("</div>", unsafe_allow_html=True)
                else:
                    st.info("Explications SHAP non disponibles.")

            st.session_state["score_history"].append({
                "Transaction": txn_id, "Montant": f"{amount:,.0f} {currency}",
                "Canal": channel, "Pays": country,
                "Score": f"{score:.2%}", "Risque": risk_label(score),
                "Verdict": "Fraude" if is_fraud else "Légitime",
                "Heure": now.strftime("%H:%M:%S"),
            })

    if st.session_state["score_history"]:
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
        ch, cc = st.columns([7, 1])
        ch.markdown(f"<div class='fg-section'>Historique de session</div>", unsafe_allow_html=True)
        with cc:
            if st.button("Effacer"):
                st.session_state["score_history"] = []
                st.rerun()
        st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
        st.dataframe(pd.DataFrame(st.session_state["score_history"]), use_container_width=True, hide_index=True)
        st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Tenants
# ═══════════════════════════════════════════════════════════════════════════════
elif "Tenants" in page:
    st.markdown("<div style='padding:20px 28px;'>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-section' style='font-size:18px;'>Gestion des tenants</div>", unsafe_allow_html=True)

    if not st.session_state["admin_key"]:
        st.markdown(f"<div class='fg-card'><p style='color:{AMBER};font-size:13px;'>La clé Admin (X-Admin-Key) est requise pour accéder à cette section.</p></div>", unsafe_allow_html=True)
    else:
        tab_l, tab_c, tab_p = st.tabs(["Liste", "Créer", "Politiques"])

        with tab_l:
            data = api_get("/api/v1/tenants", admin=True)
            if data:
                df_t = pd.DataFrame(data)
                if not df_t.empty:
                    k1, k2 = st.columns(2)
                    k1.metric("Total tenants", len(df_t))
                    env = df_t["environment"].value_counts().to_dict() if "environment" in df_t.columns else {}
                    k2.metric("En production", env.get("production", 0))
                    st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)
                    cols = [c for c in ["id","name","country","environment","created_at"] if c in df_t.columns]
                    st.dataframe(df_t[cols], use_container_width=True, hide_index=True)

        with tab_c:
            with st.form("form_create"):
                t_name  = st.text_input("Nom de l'organisation")
                t_cty   = st.selectbox("Pays", ["CI", "SN", "GH", "BJ", "ML"])
                t_env   = st.selectbox("Environnement", ["sandbox", "production"])
                t_key   = st.text_input("Clé API", type="password")
                st.caption("La clé sera hashée (HMAC-SHA256) avant stockage.")
                if st.form_submit_button("Créer le tenant", type="primary"):
                    if not t_name or not t_key:
                        st.error("Nom et clé API sont obligatoires.")
                    else:
                        res = api_post("/api/v1/tenants", {"name": t_name, "country": t_cty, "environment": t_env, "api_key": t_key}, admin=True)
                        if res:
                            st.success(f"Tenant **{t_name}** créé — ID : `{res.get('id','—')}`")

        with tab_p:
            pol_tid = st.number_input("Tenant ID", min_value=1, value=tid)
            cur = api_get(f"/api/v1/tenants/{pol_tid}/policies")
            if cur:
                k1, k2, k3 = st.columns(3)
                k1.metric("Seuil alerte", f"{cur.get('score_threshold',0.7):.0%}")
                k2.metric("Seuil rejet auto", f"{cur.get('auto_reject_threshold',0.9):.0%}")
                k3.metric("Modèle", cur.get("model_id", "fraud_v1"))
            with st.form("form_policy"):
                p_th  = st.slider("Seuil d'alerte", 0.0, 1.0, float(cur.get("score_threshold", 0.7) if cur else 0.7), 0.01)
                p_rej = st.slider("Seuil rejet auto", 0.0, 1.0, float(cur.get("auto_reject_threshold", 0.9) if cur else 0.9), 0.01)
                p_mid = st.text_input("Modèle", value=cur.get("model_id","fraud_v1") if cur else "fraud_v1")
                if st.form_submit_button("Enregistrer", type="primary"):
                    res = api_post(f"/api/v1/tenants/{pol_tid}/policies", {"score_threshold": p_th, "auto_reject_threshold": p_rej, "model_id": p_mid}, admin=True)
                    if res:
                        st.success("Politique mise à jour.")
    st.markdown("</div>", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Modèles
# ═══════════════════════════════════════════════════════════════════════════════
elif "Modèles" in page:
    st.markdown("<div style='padding:20px 28px;'>", unsafe_allow_html=True)
    st.markdown(f"<div class='fg-section' style='font-size:18px;'>Gestion des modèles ML</div>", unsafe_allow_html=True)

    versions = api_get("/api/v1/model/versions")
    if versions:
        df_m = pd.DataFrame(versions)
        if not df_m.empty:
            ICON = {"production": "🟢", "staging": "🟡", "archived": "⚫"}
            df_m["Statut"] = df_m["stage"].apply(lambda s: f"{ICON.get(s,'⚪')} {s}")
            cols = [c for c in ["version","Statut","auc_roc","description","created_at"] if c in df_m.columns]
            st.dataframe(df_m[cols], use_container_width=True, hide_index=True)

            if "auc_roc" in df_m.columns and df_m["auc_roc"].notna().any():
                fig = go.Figure(go.Bar(
                    x=df_m.dropna(subset=["auc_roc"])["version"],
                    y=df_m.dropna(subset=["auc_roc"])["auc_roc"],
                    marker_color=GREEN, text=df_m.dropna(subset=["auc_roc"])["auc_roc"].round(3),
                    textposition="outside",
                ))
                fig.add_hline(y=0.90, line_dash="dash", line_color=AMBER, annotation_text="Cible 0.90")
                fig.update_layout(
                    title="Performance (AUC-ROC)", height=260,
                    yaxis=dict(range=[0.80, 1.00], showgrid=True, gridcolor="#f3f4f6"),
                    xaxis=dict(showgrid=False),
                    paper_bgcolor=WHITE, plot_bgcolor=WHITE,
                    margin=dict(t=40, b=0, l=0, r=0),
                )
                st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
                st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state["admin_key"]:
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
        st.markdown("<div class='fg-card'>", unsafe_allow_html=True)
        st.markdown(f"<div class='fg-section'>Promouvoir en production</div>", unsafe_allow_html=True)
        cv, cb = st.columns([3, 1])
        ver_input = cv.text_input("Version", value="v1", label_visibility="collapsed")
        with cb:
            if st.button("Promouvoir", type="primary", use_container_width=True):
                res = api_post(f"/api/v1/model/versions/{ver_input}/promote", {}, admin=True)
                if res:
                    st.success(f"Version `{ver_input}` promue en production.")
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.info("Clé Admin requise pour promouvoir un modèle.")
    st.markdown("</div>", unsafe_allow_html=True)
