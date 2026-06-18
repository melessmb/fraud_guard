"""Dashboard d'administration FraudGuard — style fintech clair."""

from __future__ import annotations

import base64
import json
import os
import random
import time
from datetime import datetime, timedelta
from typing import Any, Optional

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from streamlit_option_menu import option_menu

# ── Config page ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="FraudGuard Admin",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Palette ───────────────────────────────────────────────────────────────────
GREEN        = "#16a34a"
GREEN_BG     = "#f0fdf4"
RED          = "#ef4444"
RED_BG       = "#fee2e2"
AMBER        = "#f59e0b"
AMBER_BG     = "#fef3c7"
GRAY_BG      = "#f5f5f4"
BORDER       = "#e5e7eb"
TEXT         = "#111827"
TEXT_MUT     = "#6b7280"
WHITE        = "#ffffff"
BLUE         = "#2563eb"
BLUE_BG      = "#eff6ff"

# ── Bootstrap Icons via unpkg ─────────────────────────────────────────────────
st.markdown(
    '<link rel="stylesheet" href="https://unpkg.com/bootstrap-icons@1.11.3/font/bootstrap-icons.css">',
    unsafe_allow_html=True,
)

# ── CSS global ────────────────────────────────────────────────────────────────
st.markdown(f"""
<style>
/* ── Base ── */
html, body, [data-testid="stApp"] {{
    background: {GRAY_BG} !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}}
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stHeader"] {{ display: none !important; }}
.block-container {{ padding: 0 !important; max-width: 100% !important; }}

/* ── st.container(border=True) → fg-card look ── */
[data-testid="stVerticalBlockBorderWrapper"] {{
    background: {WHITE} !important;
    border-radius: 12px !important;
    border: 0.5px solid {BORDER} !important;
    box-shadow: none !important;
    padding: 6px 4px !important;
}}
/* Supprime le padding interne Streamlit dans les cartes */
[data-testid="stVerticalBlockBorderWrapper"] > div > [data-testid="stVerticalBlock"] {{
    gap: 0 !important;
}}
/* Retire le padding excessif autour des graphiques Plotly dans les cartes */
[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stPlotlyChart"] {{
    margin-top: -8px !important;
    margin-bottom: -4px !important;
}}

/* ── Sidebar ── */
[data-testid="stSidebar"] {{
    background: {WHITE} !important;
    border-right: 0.5px solid {BORDER} !important;
}}
[data-testid="stSidebar"] .stRadio label {{
    display: flex !important; align-items: center !important; gap: 10px !important;
    padding: 9px 12px !important; border-radius: 8px !important;
    font-size: 14px !important; color: {TEXT_MUT} !important;
    cursor: pointer !important; width: 100% !important;
}}

/* ── KPI text ── */
.fg-kpi-label {{
    font-size: 12px; color: {TEXT_MUT}; margin: 2px 0 4px;
    display: flex; justify-content: space-between; align-items: center;
}}
.fg-kpi-value {{ font-size: 24px; font-weight: 600; color: {TEXT}; line-height: 1.2; margin-bottom: 2px; }}
.fg-delta-pos {{ font-size: 12px; color: {GREEN}; font-weight: 500; margin-bottom: 4px; }}
.fg-delta-neg {{ font-size: 12px; color: {RED};   font-weight: 500; margin-bottom: 4px; }}
.fg-delta-neu {{ font-size: 12px; color: {AMBER}; font-weight: 500; margin-bottom: 4px; }}
.fg-section   {{ font-size: 15px; font-weight: 600; color: {TEXT}; margin: 0 0 12px; }}

/* ── Badges ── */
.badge-admin  {{ display:inline-block; background:{BLUE_BG};  color:{BLUE};  font-size:10px; font-weight:600; padding:2px 8px; border-radius:20px; }}
.badge-tenant {{ display:inline-block; background:{GREEN_BG}; color:#166534; font-size:10px; font-weight:600; padding:2px 8px; border-radius:20px; }}
.badge-fraud  {{ display:inline-block; background:{RED_BG};   color:#b91c1c; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}
.badge-review {{ display:inline-block; background:{AMBER_BG}; color:#92400e; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}
.badge-ok     {{ display:inline-block; background:{GREEN_BG}; color:#166534; font-size:11px; font-weight:600; padding:2px 10px; border-radius:20px; }}

/* ── Table ── */
.fg-table {{ width:100%; border-collapse:collapse; font-size:13px; }}
.fg-table th {{ color:{TEXT_MUT}; font-weight:500; text-align:left; padding:6px 10px; border-bottom:0.5px solid {BORDER}; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }}
.fg-table td {{ padding:9px 10px; border-bottom:0.5px solid {BORDER}; color:{TEXT}; }}
.fg-table tr:last-child td {{ border-bottom:none; }}

/* ── Progress bars ── */
.fg-bar-wrap {{ height:5px; background:#f3f4f6; border-radius:3px; margin-top:4px; }}
.fg-bar {{ height:5px; border-radius:3px; background:{GREEN}; }}

/* ── Topbar ── */
.fg-topbar {{
    background: {WHITE}; border-bottom: 0.5px solid {BORDER};
    padding: 14px 28px; display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 0;
}}
.fg-topbar-title {{ font-size: 18px; font-weight: 600; color: {TEXT}; }}
.fg-topbar-sub   {{ font-size: 12px; color: {TEXT_MUT}; margin-top: 1px; }}
.fg-avatar {{
    width:30px; height:30px; border-radius:50%;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:600; color:#fff;
}}

/* ── Page content wrapper ── */
.fg-page {{ padding: 20px 28px; }}

/* ── Bootstrap Icons sizing ── */
.bi {{ font-size: 15px; line-height: 1; vertical-align: -2px; }}
.bi-lg {{ font-size: 20px; }}
.bi-xl {{ font-size: 28px; }}

/* ── KPI icon chip ── */
.fg-kpi-icon {{
    width:32px; height:32px; border-radius:8px;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:15px; margin-bottom:8px;
}}

/* ── Info row table ── */
.fg-info-table {{ width:100%; border-collapse:collapse; font-size:13px; }}
.fg-info-table td {{ padding:8px 0; border-bottom:0.5px solid {BORDER}; }}
.fg-info-table tr:last-child td {{ border-bottom:none; }}
.fg-info-label {{ color:{TEXT_MUT}; font-size:12px; display:flex; align-items:center; gap:6px; }}

/* ── option_menu overrides ── */
.nav-link {{ border-radius:8px !important; }}
.nav-link-selected {{ background-color:{GREEN_BG} !important; color:{GREEN} !important; }}
</style>
""", unsafe_allow_html=True)

# ── Session state ─────────────────────────────────────────────────────────────
_DEFAULTS: dict = {
    "api_url":       os.getenv("API_URL",           "http://localhost:8780"),
    "kc_client":     os.getenv("KEYCLOAK_CLIENT_ID", "fraudguard-dashboard"),
    "access_token":  None,
    "user_info":     {},
    "tenant_id":     1,
    "score_history": [],
}
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Auth helpers ──────────────────────────────────────────────────────────────
def _decode_token(token: str) -> dict:
    try:
        part = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (4 - len(part) % 4)))
    except Exception:
        return {}


def _is_authenticated() -> bool:
    token = st.session_state.get("access_token")
    if not token:
        return False
    return _decode_token(token).get("exp", 0) > time.time()


def _login(username: str, password: str) -> Optional[str]:
    url = f"{st.session_state['api_url']}/api/v1/auth/login"
    try:
        r = requests.post(url, json={
            "username":  username,
            "password":  password,
            "client_id": st.session_state["kc_client"],
        }, timeout=10)
        if r.status_code == 401:
            return "Identifiants incorrects."
        if r.status_code == 503:
            return r.json().get("detail", "Keycloak inaccessible côté serveur.")
        r.raise_for_status()
        token = r.json()["access_token"]
        st.session_state["access_token"] = token
        payload = _decode_token(token)
        st.session_state["user_info"] = {
            "sub":      payload.get("sub", ""),
            "username": payload.get("preferred_username", username),
            "email":    payload.get("email", ""),
            "roles":    payload.get("realm_access", {}).get("roles", []),
        }
        return None
    except requests.exceptions.ConnectionError:
        return "API backend hors ligne."
    except Exception as e:
        return f"Erreur inattendue : {e}"


def _logout() -> None:
    st.session_state["access_token"] = None
    st.session_state["user_info"] = {}
    st.rerun()


def _hdrs() -> dict:
    token = st.session_state.get("access_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def _get_role() -> str:
    roles = set(st.session_state.get("user_info", {}).get("roles", []))
    for r in ("admin", "tenant_admin", "compliance", "tenant"):
        if r in roles:
            return r
    return "tenant"


def _is_admin() -> bool:
    return _get_role() == "admin"


def _has_role(*roles: str) -> bool:
    return _get_role() in roles


# ── API helpers ───────────────────────────────────────────────────────────────
def api_get(path: str, params=None) -> Optional[Any]:
    try:
        r = requests.get(
            f"{st.session_state['api_url']}{path}",
            headers=_hdrs(), params=params, timeout=6,
        )
        if r.status_code == 401:
            st.warning("Session expirée — reconnectez-vous.")
            st.session_state["access_token"] = None
            st.rerun()
        if r.status_code == 403:
            st.warning("Accès refusé (rôle insuffisant).")
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


def api_post(path: str, payload: dict) -> Optional[Any]:
    try:
        r = requests.post(
            f"{st.session_state['api_url']}{path}",
            json=payload, headers=_hdrs(), timeout=10,
        )
        if r.status_code == 401:
            st.warning("Session expirée — reconnectez-vous.")
            st.session_state["access_token"] = None
            st.rerun()
        if r.status_code == 403:
            st.warning("Accès refusé (rôle insuffisant).")
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


# ── Chart helpers ─────────────────────────────────────────────────────────────
def risk_color(s: float) -> str:
    return GREEN if s < 0.5 else (AMBER if s < 0.7 else RED)


def risk_label(s: float) -> str:
    return "Faible" if s < 0.5 else ("Moyen" if s < 0.7 else "Élevé")


def _rgba(hex_color: str, alpha: float = 0.08) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def sparkline(values: list[float], color: str) -> go.Figure:
    fig = go.Figure(go.Scatter(
        y=values, mode="lines",
        line=dict(color=color, width=1.8),
        fill="tozeroy", fillcolor=_rgba(color),
    ))
    fig.update_layout(
        height=36, margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=False), yaxis=dict(visible=False),
        showlegend=False,
    )
    return fig


def _chart_cfg() -> dict:
    return {"displayModeBar": False, "staticPlot": True}


# ═══════════════════════════════════════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════════════════════════════════════
if not _is_authenticated():
    _, center, _ = st.columns([1, 1.2, 1])
    with center:
        st.markdown("<div style='height:60px;'></div>", unsafe_allow_html=True)

        # Logo + titre
        st.markdown(f"""
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
          <div style="width:44px;height:44px;border-radius:12px;background:{GREEN};
                      display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">
            <i class="bi bi-shield-shaded" style="font-size:22px;"></i>
          </div>
          <div>
            <div style="font-size:20px;font-weight:700;color:{TEXT};">FraudGuard</div>
            <div style="font-size:12px;color:{TEXT_MUT};">Détection de fraude — Afrique de l'Ouest</div>
          </div>
        </div>
        """, unsafe_allow_html=True)

        with st.container(border=True):
            st.markdown(f"<p style='font-size:16px;font-weight:600;color:{TEXT};margin:0 0 20px;'>Connexion</p>", unsafe_allow_html=True)

            with st.form("login_form", border=False):
                username = st.text_input("Identifiant", placeholder="ex: fraudguard-admin")
                password = st.text_input("Mot de passe", type="password")
                submitted = st.form_submit_button(
                    "Se connecter", type="primary", use_container_width=True,
                )

            if submitted:
                if not username or not password:
                    st.error("Identifiant et mot de passe requis.")
                else:
                    with st.spinner("Connexion en cours…"):
                        err = _login(username, password)
                    if err:
                        st.error(err)
                    else:
                        st.rerun()

        st.markdown(
            f"<p style='text-align:center;font-size:11px;color:{TEXT_MUT};margin-top:12px;'>"
            "Authentification sécurisée via Keycloak</p>",
            unsafe_allow_html=True,
        )
    st.stop()


# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTIFIÉ
# ═══════════════════════════════════════════════════════════════════════════════
user      = st.session_state["user_info"]
username  = user.get("username", "—")
is_admin  = _is_admin()
cur_role  = _get_role()
initials  = "".join(w[0].upper() for w in username.replace("-", " ").split()[:2]) or "?"

_ROLE_COLORS = {
    "admin":        GREEN,
    "tenant_admin": BLUE,
    "compliance":   AMBER,
    "tenant":       "#7c3aed",
}
_ROLE_LABELS = {
    "admin":        "Admin Plateforme",
    "tenant_admin": "Admin Tenant",
    "compliance":   "Conformité",
    "tenant":       "Tenant API",
}
av_color   = _ROLE_COLORS.get(cur_role, BLUE)
role_label = _ROLE_LABELS.get(cur_role, cur_role)
role_badge = f'<span class="badge-admin" style="background:{av_color}20;color:{av_color};">{role_label}</span>'

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:10px;padding:4px 0 18px;">
      <div style="width:32px;height:32px;border-radius:8px;background:{GREEN};
                  display:flex;align-items:center;justify-content:center;color:#fff;">
        <i class="bi bi-shield-shaded" style="font-size:17px;"></i>
      </div>
      <span style="font-size:16px;font-weight:600;color:{TEXT};">FraudGuard</span>
    </div>
    """, unsafe_allow_html=True)

    _role = _get_role()
    _NAV = {
        "admin": {
            "options": ["Dashboard", "Analytique", "Alertes", "Scoring", "Tenants", "Modèles", "Conformité", "Profil"],
            "icons":   ["speedometer2", "graph-up-arrow", "exclamation-triangle", "lightning-charge",
                        "building", "cpu", "file-earmark-text", "person-circle"],
        },
        "tenant_admin": {
            "options": ["Dashboard", "Analytique", "Alertes", "Scoring", "Mon Tenant", "Conformité", "Profil"],
            "icons":   ["speedometer2", "graph-up-arrow", "exclamation-triangle", "lightning-charge",
                        "gear", "file-earmark-text", "person-circle"],
        },
        "compliance": {
            "options": ["Dashboard", "Alertes", "Conformité", "Profil"],
            "icons":   ["speedometer2", "exclamation-triangle", "file-earmark-text", "person-circle"],
        },
        "tenant": {
            "options": ["Dashboard", "Analytique", "Alertes", "Scoring", "Profil"],
            "icons":   ["speedometer2", "graph-up-arrow", "exclamation-triangle", "lightning-charge", "person-circle"],
        },
    }
    nav_options = _NAV[_role]["options"]
    nav_icons   = _NAV[_role]["icons"]

    page = option_menu(
        menu_title=None,
        options=nav_options,
        icons=nav_icons,
        default_index=0,
        styles={
            "container":       {"padding": "0", "background-color": "transparent"},
            "icon":            {"color": TEXT_MUT, "font-size": "14px"},
            "nav-link":        {"font-size": "13px", "color": TEXT_MUT,
                                "padding": "8px 12px", "border-radius": "8px",
                                "--hover-color": GREEN_BG},
            "nav-link-selected": {"background-color": GREEN_BG, "color": GREEN, "font-weight": "500"},
        },
    )

    st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:16px 0 12px;'>", unsafe_allow_html=True)
    st.markdown(f"<p style='font-size:11px;color:{TEXT_MUT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;'>Tenant actif</p>", unsafe_allow_html=True)
    if is_admin:
        st.session_state["tenant_id"] = st.number_input(
            "Tenant ID", min_value=1, value=st.session_state["tenant_id"],
            label_visibility="collapsed",
        )
    else:
        st.markdown(f"<p style='font-size:13px;color:{TEXT};font-weight:500;'>ID {st.session_state['tenant_id']}</p>", unsafe_allow_html=True)

    st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:12px 0;'>", unsafe_allow_html=True)
    try:
        _h = requests.get(f"{st.session_state['api_url']}/health", timeout=2)
        ver      = _h.json().get("version", "?") if _h.ok else "?"
        api_icon = "bi-circle-fill"
        api_col  = GREEN
        api_lbl  = f"API en ligne — v{ver}"
    except Exception:
        api_icon = "bi-circle-fill"
        api_col  = RED
        api_lbl  = "API hors ligne"
    st.markdown(f"<div style='display:flex;align-items:center;gap:7px;font-size:12px;'><i class='bi {api_icon}' style='color:{api_col};font-size:9px;'></i><span style='color:{api_col};font-weight:500;'>{api_lbl}</span></div>", unsafe_allow_html=True)

    st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:12px 0;'>", unsafe_allow_html=True)
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div class="fg-avatar" style="background:{av_color};">{initials}</div>
      <div>
        <div style="font-size:13px;font-weight:500;color:{TEXT};">{username}</div>
        <div style="margin-top:2px;">{role_badge}</div>
      </div>
    </div>
    """, unsafe_allow_html=True)
    if st.button("Se déconnecter", use_container_width=True):
        _logout()

# ── Topbar ────────────────────────────────────────────────────────────────────
tid = st.session_state["tenant_id"]
now = datetime.now()
jours = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
mois  = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
date_str = f"{jours[now.weekday()]} {now.day} {mois[now.month-1]} {now.year}"

st.markdown(f"""
<div class="fg-topbar">
  <div>
    <div class="fg-topbar-title">Bonjour, {username} <i class="bi bi-hand-wave" style="font-size:16px;"></i></div>
    <div class="fg-topbar-sub">
      <i class="bi bi-calendar3" style="font-size:11px;"></i> {date_str}
      &nbsp;·&nbsp;
      <i class="bi bi-building" style="font-size:11px;"></i> Tenant ID {tid}
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;">
    <div style="position:relative;cursor:pointer;">
      <i class="bi bi-bell" style="font-size:18px;color:{TEXT_MUT};"></i>
      <span style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;
                   background:{RED};border-radius:50%;border:2px solid {WHITE};"></span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;
                border:0.5px solid {BORDER};border-radius:20px;background:{WHITE};">
      <div class="fg-avatar" style="background:{av_color};">{initials}</div>
      <span style="font-size:13px;color:{TEXT};font-weight:500;">{username}</span>
      <i class="bi bi-chevron-down" style="font-size:11px;color:{TEXT_MUT};"></i>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Dashboard
# ═══════════════════════════════════════════════════════════════════════════════
if "Dashboard" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)

    metrics = api_get(f"/api/v1/tenants/{tid}/metrics")
    alerts  = api_get(f"/api/v1/tenants/{tid}/alerts")

    random.seed(42)
    spark_txn   = [random.randint(150, 300) for _ in range(14)]
    spark_fraud = [random.randint(1, 8)     for _ in range(14)]
    spark_rate  = [round(random.uniform(2.0, 4.5), 1) for _ in range(14)]
    spark_score = [round(random.uniform(0.72, 0.92), 2) for _ in range(14)]

    txn_count   = (metrics or {}).get("transaction_count", 0)
    fraud_count = (metrics or {}).get("fraud_count", 0)
    fraud_rate  = (metrics or {}).get("detection_rate", 0.0)
    model_ver   = (metrics or {}).get("model_version", "—")

    # ── KPI row ───────────────────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4, gap="small")

    for col, label, icon, icon_bg, value, delta, delta_cls, spark_data, spark_color in [
        (k1, "Total transactions", "bi-arrow-left-right", "#eff6ff",   f"{txn_count:,}",    "+12% vs mois dernier",  "fg-delta-pos", spark_txn,   GREEN),
        (k2, "Fraudes détectées",  "bi-shield-x",         RED_BG,      f"{fraud_count:,}",  "+4% vs mois dernier",   "fg-delta-neg", spark_fraud, RED),
        (k3, "Taux de fraude",     "bi-percent",          AMBER_BG,    f"{fraud_rate:.1%}", "−0.4% vs mois dernier", "fg-delta-pos", spark_rate,  GREEN),
        (k4, "Modèle actif",       "bi-cpu",              GREEN_BG,    model_ver,           "Seuil : 0.70",          "fg-delta-neu", spark_score, AMBER),
    ]:
        with col:
            with st.container(border=True):
                val_size = "24px" if label != "Modèle actif" else "16px"
                icon_color = {"#eff6ff": BLUE, RED_BG: RED, AMBER_BG: AMBER, GREEN_BG: GREEN}.get(icon_bg, TEXT_MUT)
                st.markdown(f"""
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <span class="fg-kpi-label" style="margin:0;">{label}</span>
                  <div class="fg-kpi-icon" style="background:{icon_bg};color:{icon_color};">
                    <i class="bi {icon}"></i>
                  </div>
                </div>
                <div class="fg-kpi-value" style="font-size:{val_size};">{value}</div>
                <div class="{delta_cls}">{delta}</div>
                """, unsafe_allow_html=True)
                st.plotly_chart(sparkline(spark_data, spark_color), width="stretch", config=_chart_cfg(), key=f"sp_{label}")

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    # ── Activité ──────────────────────────────────────────────────────────────
    with st.container(border=True):
        hdr_l, hdr_r = st.columns([4, 1])
        hdr_l.markdown("<div class='fg-section'>Activité des transactions</div>", unsafe_allow_html=True)
        with hdr_r:
            period = st.segmented_control("p", ["1S", "1M", "6M", "1A"], default="1S", label_visibility="collapsed")

        nb         = {"1S": 7, "1M": 30, "6M": 180, "1A": 365}.get(period or "1S", 7)
        dates      = [now - timedelta(days=i) for i in range(nb - 1, -1, -1)]
        leg_vals   = [random.randint(100, 400) for _ in dates]
        fraud_vals = [random.randint(0, 12)    for _ in dates]
        date_strs  = [d.strftime("%d %b") for d in dates]

        fig_area = go.Figure()
        fig_area.add_trace(go.Scatter(
            x=date_strs, y=leg_vals, name="Légitimes",
            mode="lines", line=dict(color=GREEN, width=2),
            fill="tozeroy", fillcolor=_rgba(GREEN, 0.09),
        ))
        fig_area.add_trace(go.Scatter(
            x=date_strs, y=fraud_vals, name="Fraudes",
            mode="lines", line=dict(color=RED, width=1.5),
            fill="tozeroy", fillcolor=_rgba(RED, 0.07),
        ))
        fig_area.update_layout(
            height=220, margin=dict(l=0, r=0, t=4, b=0),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            legend=dict(orientation="h", y=1.12, x=0, font=dict(size=12)),
            xaxis=dict(showgrid=False, tickfont=dict(size=11, color=TEXT_MUT),
                       nticks=8, showline=False, zeroline=False),
            yaxis=dict(showgrid=True, gridcolor="#f3f4f6",
                       tickfont=dict(size=11, color=TEXT_MUT), showline=False, zeroline=False),
            hovermode="x unified",
        )
        st.plotly_chart(fig_area, width="stretch", config={"displayModeBar": False})

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    # ── Bottom row ────────────────────────────────────────────────────────────
    col_table, col_canal = st.columns([2, 1], gap="small")
    df_alerts = pd.DataFrame(alerts) if alerts else pd.DataFrame()

    with col_table:
        with st.container(border=True):
            st.markdown("<div class='fg-section'>Alertes récentes</div>", unsafe_allow_html=True)
            if not df_alerts.empty:
                rows_html = ""
                for _, row in df_alerts.head(5).iterrows():
                    score = row.get("score", 0)
                    badge = (
                        '<span class="badge-fraud">Fraude</span>' if score >= 0.7
                        else '<span class="badge-review">Révision</span>' if score >= 0.5
                        else '<span class="badge-ok">Légitime</span>'
                    )
                    ts = str(row.get("timestamp", ""))[:16].replace("T", " ")
                    rows_html += f"""<tr>
                      <td style='color:{TEXT_MUT};font-size:12px;'>{ts}</td>
                      <td><strong>{row.get('transaction_id','—')}</strong></td>
                      <td style='color:{TEXT_MUT};'>{row.get('channel','—')}</td>
                      <td style='text-align:right;font-weight:500;'>{row.get('amount',0):,.0f} {row.get('currency','XOF')}</td>
                      <td style='text-align:center;'>{badge}</td>
                    </tr>"""
                st.markdown(f"""<table class="fg-table"><thead><tr>
                  <th>Date</th><th>Transaction</th><th>Canal</th>
                  <th style='text-align:right;'>Montant</th><th style='text-align:center;'>Statut</th>
                </tr></thead><tbody>{rows_html}</tbody></table>""", unsafe_allow_html=True)
            else:
                st.markdown(f"<p style='color:{TEXT_MUT};font-size:13px;margin:0;'>Aucune alerte disponible.</p>", unsafe_allow_html=True)

    with col_canal:
        with st.container(border=True):
            st.markdown("<div class='fg-section'>Par canal</div>", unsafe_allow_html=True)
            canals = {"mobile_money": 50, "web": 25, "pos": 15, "atm": 10}
            if not df_alerts.empty and "channel" in df_alerts.columns:
                vc = df_alerts["channel"].value_counts(normalize=True) * 100
                canals = {k: round(v) for k, v in vc.items()}

            for name, pct in canals.items():
                st.markdown(f"""
                <div style="margin-bottom:10px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="font-size:12px;color:{TEXT_MUT};">{name}</span>
                    <span style="font-size:12px;font-weight:500;color:{TEXT};">{pct}%</span>
                  </div>
                  <div class="fg-bar-wrap"><div class="fg-bar" style="width:{pct}%;"></div></div>
                </div>""", unsafe_allow_html=True)

            st.markdown(f"""
            <div style="margin-top:14px;padding-top:12px;border-top:0.5px solid {BORDER};
                        display:flex;justify-content:space-between;">
              <div>
                <div style="font-size:20px;font-weight:600;color:{TEXT};">80%</div>
                <div style="font-size:11px;color:{GREEN};">légitimes</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px;font-weight:600;color:{TEXT};">20%</div>
                <div style="font-size:11px;color:{RED};">surveillance</div>
              </div>
            </div>""", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Analytique
# ═══════════════════════════════════════════════════════════════════════════════
elif "Analytique" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Analytique</div>", unsafe_allow_html=True)

    alerts = api_get(f"/api/v1/tenants/{tid}/alerts")
    if alerts:
        df = pd.DataFrame(alerts)
        if not df.empty:
            c1, c2 = st.columns(2, gap="small")
            with c1:
                with st.container(border=True):
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
                    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})

            with c2:
                with st.container(border=True):
                    fig2 = go.Figure(go.Histogram(x=df["score"], nbinsx=20, marker_color=RED, opacity=0.8))
                    fig2.add_vline(x=0.7, line_dash="dash", line_color=AMBER, annotation_text="Seuil 0.70")
                    fig2.update_layout(
                        title="Distribution des scores", height=280,
                        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                        margin=dict(l=0, r=0, t=40, b=0),
                        yaxis=dict(showgrid=True, gridcolor="#f3f4f6"),
                        xaxis=dict(showgrid=False),
                    )
                    st.plotly_chart(fig2, width="stretch", config={"displayModeBar": False})

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            with st.container(border=True):
                fig3 = go.Figure(go.Scatter(
                    x=df["amount"], y=df["score"], mode="markers",
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
                st.plotly_chart(fig3, width="stretch", config={"displayModeBar": False})
    else:
        st.info("Aucune donnée disponible.")
    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Alertes
# ═══════════════════════════════════════════════════════════════════════════════
elif "Alertes" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Alertes de fraude</div>", unsafe_allow_html=True)

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

            with st.container(border=True):
                st.markdown(f"<p style='font-size:13px;color:{TEXT_MUT};margin:0 0 10px;'>{len(df)} alerte(s)</p>", unsafe_allow_html=True)
                if not df.empty:
                    rows_html = ""
                    for _, row in df.iterrows():
                        score = row.get("score", 0)
                        badge = (
                            '<span class="badge-fraud">Fraude</span>' if score >= 0.7
                            else '<span class="badge-review">Révision</span>' if score >= 0.5
                            else '<span class="badge-ok">Légitime</span>'
                        )
                        ts = str(row.get("timestamp", ""))[:16].replace("T", " ")
                        rows_html += f"""<tr>
                          <td style='color:{TEXT_MUT};font-size:12px;'>{ts}</td>
                          <td><strong>{row.get('transaction_id','—')}</strong></td>
                          <td style='color:{TEXT_MUT};'>{row.get('channel','—')}</td>
                          <td style='text-align:right;font-weight:500;'>{row.get('amount',0):,.0f} {row.get('currency','XOF')}</td>
                          <td style='text-align:center;font-weight:500;'>{score:.2%}</td>
                          <td style='text-align:center;'>{badge}</td>
                        </tr>"""
                    st.markdown(f"""<table class="fg-table"><thead><tr>
                      <th>Date</th><th>Transaction</th><th>Canal</th>
                      <th style='text-align:right;'>Montant</th>
                      <th style='text-align:center;'>Score</th>
                      <th style='text-align:center;'>Statut</th>
                    </tr></thead><tbody>{rows_html}</tbody></table>""", unsafe_allow_html=True)
                else:
                    st.info("Aucune alerte ne correspond aux filtres.")
    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Scoring
# ═══════════════════════════════════════════════════════════════════════════════
elif "Scoring" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Scoring temps réel</div>", unsafe_allow_html=True)

    with st.container(border=True):
        with st.form("score_form", border=False):
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

    if submit:
        with st.spinner("Analyse en cours…"):
            result = api_post("/api/v1/score", {
                "transaction_id": txn_id, "tenant_id": tid,
                "amount": amount, "currency": currency, "channel": channel,
                "country": country, "device_fingerprint": device_fp,
                "ip_address": ip_addr, "timestamp": ts,
            })
        if result:
            score        = result.get("score", 0.0)
            is_fraud     = result.get("is_fraud", False)
            model_ver    = result.get("model_version", "—")
            explanations = result.get("explanations") or {}

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            cg, cs = st.columns(2, gap="small")

            with cg:
                with st.container(border=True):
                    color = risk_color(score)
                    fig_g = go.Figure(go.Indicator(
                        mode="gauge+number",
                        value=round(score * 100, 1),
                        number={"suffix": "%", "font": {"size": 40, "color": color}},
                        title={"text": f"Score · <b>{risk_label(score)}</b>", "font": {"size": 14, "color": TEXT_MUT}},
                        gauge={
                            "axis": {"range": [0, 100], "tickcolor": BORDER},
                            "bar":  {"color": color, "thickness": 0.25},
                            "bgcolor": WHITE, "borderwidth": 0,
                            "steps": [
                                {"range": [0, 50],   "color": "#f0fdf4"},
                                {"range": [50, 70],  "color": "#fef3c7"},
                                {"range": [70, 100], "color": "#fee2e2"},
                            ],
                            "threshold": {"line": {"color": RED, "width": 3}, "thickness": 0.8, "value": 70},
                        },
                    ))
                    fig_g.update_layout(
                        height=260, margin=dict(t=60, b=10, l=30, r=30),
                        paper_bgcolor=WHITE, font_color=TEXT,
                    )
                    st.plotly_chart(fig_g, width="stretch", config={"displayModeBar": False})
                    verdict_badge = (
                        "<span class='badge-fraud' style='font-size:13px;padding:5px 16px;'>Fraude — transaction bloquée</span>"
                        if is_fraud else
                        "<span class='badge-ok' style='font-size:13px;padding:5px 16px;'>Légitime — transaction approuvée</span>"
                    )
                    st.markdown(f"<div style='text-align:center;'>{verdict_badge}</div>", unsafe_allow_html=True)
                    st.markdown(f"<p style='text-align:center;font-size:11px;color:{TEXT_MUT};margin-top:6px;'>Modèle : <code>{model_ver}</code></p>", unsafe_allow_html=True)

            with cs:
                shap_vals = {k: v for k, v in explanations.items() if isinstance(v, (int, float))}
                if shap_vals:
                    with st.container(border=True):
                        shap_df = pd.DataFrame(
                            sorted(shap_vals.items(), key=lambda x: abs(x[1]), reverse=True),
                            columns=["Feature", "Impact"],
                        ).head(8)
                        colors = [RED if v > 0 else GREEN for v in shap_df["Impact"]]
                        fig_s = go.Figure(go.Bar(
                            x=shap_df["Impact"], y=shap_df["Feature"],
                            orientation="h", marker_color=colors,
                        ))
                        fig_s.update_layout(
                            title="Facteurs déterminants (SHAP)", height=280,
                            margin=dict(t=40, b=10, l=10, r=10),
                            paper_bgcolor=WHITE, plot_bgcolor=WHITE, font_color=TEXT,
                            yaxis=dict(categoryorder="total ascending", tickfont=dict(size=12)),
                            xaxis=dict(showgrid=True, gridcolor="#f3f4f6", zeroline=True, zerolinecolor=BORDER),
                        )
                        st.plotly_chart(fig_s, width="stretch", config={"displayModeBar": False})
                else:
                    st.info("Explications SHAP non disponibles.")

            st.session_state["score_history"].append({
                "Transaction": txn_id, "Montant": f"{amount:,.0f} {currency}",
                "Canal": channel, "Pays": country, "Score": f"{score:.2%}",
                "Risque": risk_label(score), "Verdict": "Fraude" if is_fraud else "Légitime",
                "Heure": now.strftime("%H:%M:%S"),
            })

    if st.session_state["score_history"]:
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
        ch, cc = st.columns([7, 1])
        ch.markdown("<div class='fg-section'>Historique de session</div>", unsafe_allow_html=True)
        with cc:
            if st.button("Effacer"):
                st.session_state["score_history"] = []
                st.rerun()
        with st.container(border=True):
            st.dataframe(pd.DataFrame(st.session_state["score_history"]), use_container_width=True, hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Modèles (admin)
# ═══════════════════════════════════════════════════════════════════════════════
elif "Modèles" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Gestion des modèles ML</div>", unsafe_allow_html=True)

    versions = api_get("/api/v1/model/versions")
    if versions:
        df_m = pd.DataFrame(versions)
        if not df_m.empty:
            ICON = {"production": "🟢", "staging": "🟡", "archived": "⚫"}
            df_m["Statut"] = df_m["stage"].apply(lambda s: f"{ICON.get(s,'⚪')} {s}")
            cols = [c for c in ["version", "Statut", "auc_roc", "description", "created_at"] if c in df_m.columns]
            st.dataframe(df_m[cols], use_container_width=True, hide_index=True)

            sub = df_m.dropna(subset=["auc_roc"]) if "auc_roc" in df_m.columns else pd.DataFrame()
            if not sub.empty:
                st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
                with st.container(border=True):
                    fig = go.Figure(go.Bar(
                        x=sub["version"], y=sub["auc_roc"],
                        marker_color=GREEN, text=sub["auc_roc"].round(3), textposition="outside",
                    ))
                    fig.add_hline(y=0.90, line_dash="dash", line_color=AMBER, annotation_text="Cible 0.90")
                    fig.update_layout(
                        title="Performance (AUC-ROC)", height=260,
                        yaxis=dict(range=[0.80, 1.00], showgrid=True, gridcolor="#f3f4f6"),
                        xaxis=dict(showgrid=False),
                        paper_bgcolor=WHITE, plot_bgcolor=WHITE,
                        margin=dict(t=40, b=0, l=0, r=0),
                    )
                    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})

    if is_admin:
        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
        with st.container(border=True):
            st.markdown("<div class='fg-section'>Promouvoir en production</div>", unsafe_allow_html=True)
            cv, cb = st.columns([3, 1])
            ver_input = cv.text_input("Version", value="v1", label_visibility="collapsed")
            with cb:
                if st.button("Promouvoir", type="primary", use_container_width=True):
                    res = api_post(f"/api/v1/model/versions/{ver_input}/promote", {})
                    if res:
                        st.success(f"Version `{ver_input}` promue en production.")
    else:
        st.info("Rôle admin requis pour promouvoir un modèle.")
    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Tenants — gestion complète (admin)
# ═══════════════════════════════════════════════════════════════════════════════
elif "Tenants" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Gestion des tenants</div>", unsafe_allow_html=True)

    if not is_admin:
        st.warning("Accès réservé aux administrateurs.")
        st.markdown("</div>", unsafe_allow_html=True)
        st.stop()

    tenants_data = api_get("/api/v1/tenants") or []
    df_t = pd.DataFrame(tenants_data) if tenants_data else pd.DataFrame()

    # ── KPIs ──────────────────────────────────────────────────────────────────
    total_t = len(df_t)
    prod_t  = int((df_t["environment"] == "production").sum()) if not df_t.empty and "environment" in df_t.columns else 0
    linked  = int(df_t["keycloak_id"].notna().sum())           if not df_t.empty and "keycloak_id"  in df_t.columns else 0

    c1, c2, c3 = st.columns(3, gap="small")
    for col, label, icon, icon_bg, val, val_color in [
        (c1, "Total tenants",   "bi-building",       "#eff6ff", total_t, BLUE),
        (c2, "En production",   "bi-rocket-takeoff", GREEN_BG,  prod_t,  GREEN),
        (c3, "Liés à Keycloak", "bi-key",            AMBER_BG,  linked,  AMBER),
    ]:
        with col:
            with st.container(border=True):
                st.markdown(f"""
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <span class="fg-kpi-label" style="margin:0;">{label}</span>
                  <div class="fg-kpi-icon" style="background:{icon_bg};color:{val_color};">
                    <i class="bi {icon}"></i>
                  </div>
                </div>
                <div class="fg-kpi-value" style="color:{val_color};">{val}</div>
                """, unsafe_allow_html=True)

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    tab_list, tab_create, tab_edit, tab_policy, tab_webhook = st.tabs(
        ["📋 Liste", "➕ Créer", "✏️ Modifier", "⚙️ Politiques", "🔔 Webhooks"]
    )

    # ── Liste ─────────────────────────────────────────────────────────────────
    with tab_list:
        if df_t.empty:
            st.info("Aucun tenant enregistré.")
        else:
            search = st.text_input("Rechercher", placeholder="Nom, pays, environnement…", label_visibility="collapsed")
            filtered = df_t.copy()
            if search:
                mask = filtered.apply(lambda r: search.lower() in str(r.values).lower(), axis=1)
                filtered = filtered[mask]

            if not filtered.empty:
                cols_show = [c for c in ["id", "name", "country", "environment", "keycloak_id", "created_at"] if c in filtered.columns]
                rows_html = ""
                for _, row in filtered.iterrows():
                    env   = row.get("environment", "")
                    e_col = GREEN if env == "production" else AMBER
                    kc    = row.get("keycloak_id") or ""
                    kc_badge = (
                        f'<span style="font-size:11px;color:{GREEN};">✓ Lié</span>' if kc
                        else f'<span style="font-size:11px;color:{RED};">✗ Non lié</span>'
                    )
                    rows_html += f"""<tr>
                      <td style='color:{TEXT_MUT};font-size:12px;'>{row.get('id','')}</td>
                      <td><strong>{row.get('name','')}</strong></td>
                      <td>{row.get('country','')}</td>
                      <td><span style='color:{e_col};font-weight:500;'>{env}</span></td>
                      <td style='text-align:center;'>{kc_badge}</td>
                      <td style='color:{TEXT_MUT};font-size:12px;'>{str(row.get('created_at',''))[:10]}</td>
                    </tr>"""
                with st.container(border=True):
                    st.markdown(f"""<table class="fg-table"><thead><tr>
                      <th>ID</th><th>Nom</th><th>Pays</th><th>Env.</th>
                      <th style='text-align:center;'>Keycloak</th><th>Créé le</th>
                    </tr></thead><tbody>{rows_html}</tbody></table>""", unsafe_allow_html=True)
                st.markdown(f"<p style='font-size:12px;color:{TEXT_MUT};margin-top:8px;'>{len(filtered)} tenant(s)</p>", unsafe_allow_html=True)

    # ── Créer ─────────────────────────────────────────────────────────────────
    with tab_create:
        with st.container(border=True):
            st.markdown(f"<p style='font-size:13px;color:{TEXT_MUT};margin-bottom:12px;'>Créez un nouveau tenant et associez-le à un compte Keycloak.</p>", unsafe_allow_html=True)
            with st.form("form_create_tenant", border=False):
                cc1, cc2 = st.columns(2)
                t_name = cc1.text_input("Nom de l'organisation *")
                t_cty  = cc2.selectbox("Pays *", ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "GN"])
                t_env  = cc1.selectbox("Environnement *", ["sandbox", "production"])
                t_kcid = cc2.text_input("Keycloak ID (sub)", placeholder="UUID — ex: 1c98084b-ab04-…")
                st.caption("Le Keycloak ID se trouve dans la console Keycloak → Users → [user] → onglet Details → ID")
                if st.form_submit_button("Créer le tenant", type="primary", use_container_width=True):
                    if not t_name:
                        st.error("Le nom est obligatoire.")
                    else:
                        res = api_post("/api/v1/tenants", {
                            "name": t_name, "country": t_cty,
                            "environment": t_env, "keycloak_id": t_kcid or None,
                        })
                        if res:
                            st.success(f"✓ Tenant **{t_name}** créé — ID `{res.get('id')}`")
                            st.rerun()

    # ── Modifier ──────────────────────────────────────────────────────────────
    with tab_edit:
        if df_t.empty:
            st.info("Aucun tenant à modifier.")
        else:
            tenant_options = {f"[{row['id']}] {row['name']}": row for _, row in df_t.iterrows()}
            selected_label = st.selectbox("Sélectionner un tenant", list(tenant_options.keys()), label_visibility="collapsed")
            sel = tenant_options[selected_label]

            with st.container(border=True):
                with st.form("form_edit_tenant", border=False):
                    ec1, ec2 = st.columns(2)
                    e_name = ec1.text_input("Nom", value=sel.get("name", ""))
                    e_cty  = ec2.selectbox("Pays", ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "GN"],
                                           index=["CI","SN","GH","BJ","ML","BF","TG","GN"].index(sel.get("country","CI")) if sel.get("country") in ["CI","SN","GH","BJ","ML","BF","TG","GN"] else 0)
                    e_env  = ec1.selectbox("Environnement", ["sandbox", "production"],
                                           index=0 if sel.get("environment","sandbox") == "sandbox" else 1)
                    e_kcid = ec2.text_input("Keycloak ID (sub)", value=sel.get("keycloak_id") or "")

                    col_save, col_del = st.columns([3, 1])
                    save_btn = col_save.form_submit_button("Enregistrer les modifications", type="primary", use_container_width=True)
                    del_btn  = col_del.form_submit_button("Supprimer", use_container_width=True)

                if save_btn:
                    res = api_post.__func__ if hasattr(api_post, '__func__') else None
                    r = requests.put(
                        f"{st.session_state['api_url']}/api/v1/tenants/{sel['id']}",
                        json={"name": e_name, "country": e_cty, "environment": e_env, "keycloak_id": e_kcid or None},
                        headers=_hdrs(), timeout=10,
                    )
                    if r.status_code == 200:
                        st.success("✓ Tenant mis à jour.")
                        st.rerun()
                    else:
                        st.error(f"Erreur : {r.json().get('detail', r.text)}")

                if del_btn:
                    r = requests.delete(
                        f"{st.session_state['api_url']}/api/v1/tenants/{sel['id']}",
                        headers=_hdrs(), timeout=10,
                    )
                    if r.status_code == 204:
                        st.success(f"✓ Tenant **{sel['name']}** supprimé.")
                        st.rerun()
                    else:
                        st.error(f"Erreur : {r.text}")

    # ── Politiques ────────────────────────────────────────────────────────────
    with tab_policy:
        if df_t.empty:
            st.info("Aucun tenant.")
        else:
            pol_options = {f"[{row['id']}] {row['name']}": row['id'] for _, row in df_t.iterrows()}
            pol_label   = st.selectbox("Tenant", list(pol_options.keys()), key="pol_sel", label_visibility="collapsed")
            pol_tid     = pol_options[pol_label]
            cur         = api_get(f"/api/v1/tenants/{pol_tid}/policies") or {}

            with st.container(border=True):
                pm1, pm2, pm3 = st.columns(3)
                pm1.metric("Seuil alerte",    f"{cur.get('score_threshold', 0.7):.0%}")
                pm2.metric("Seuil rejet auto", f"{cur.get('auto_reject_threshold', 0.9):.0%}")
                pm3.metric("Modèle",           cur.get("model_id", "fraud_v1"))

            st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
            with st.container(border=True):
                with st.form("form_policy_v2", border=False):
                    fc1, fc2 = st.columns(2)
                    p_th  = fc1.slider("Seuil d'alerte",  0.0, 1.0, float(cur.get("score_threshold",      0.7)), 0.01)
                    p_rej = fc2.slider("Seuil rejet auto", 0.0, 1.0, float(cur.get("auto_reject_threshold", 0.9)), 0.01)
                    p_mid = st.text_input("Modèle ML", value=cur.get("model_id", "fraud_v1"))
                    fc3, fc4 = st.columns(2)
                    p_max_xof = fc3.number_input("Montant max (XOF)", min_value=0.0, value=float(cur.get("max_amount_xof") or 0), step=10_000.0)
                    p_max_usd = fc4.number_input("Montant max (USD)", min_value=0.0, value=float(cur.get("max_amount_usd") or 0), step=100.0)
                    if st.form_submit_button("Enregistrer la politique", type="primary", use_container_width=True):
                        res = api_post(f"/api/v1/tenants/{pol_tid}/policies", {
                            "score_threshold": p_th, "auto_reject_threshold": p_rej,
                            "model_id": p_mid,
                            "max_amount_xof": p_max_xof or None,
                            "max_amount_usd": p_max_usd or None,
                        })
                        if res:
                            st.success("✓ Politique mise à jour.")

    # ── Webhooks ──────────────────────────────────────────────────────────────
    with tab_webhook:
        if df_t.empty:
            st.info("Aucun tenant.")
        else:
            wh_options = {f"[{row['id']}] {row['name']}": row['id'] for _, row in df_t.iterrows()}
            wh_label   = st.selectbox("Tenant", list(wh_options.keys()), key="wh_sel", label_visibility="collapsed")
            wh_tid     = wh_options[wh_label]
            wh_cur     = api_get(f"/api/v1/tenants/{wh_tid}/webhooks") or {}

            with st.container(border=True):
                if wh_cur.get("configured"):
                    st.markdown(f"""
                    <div style='display:flex;align-items:center;gap:8px;margin-bottom:12px;'>
                      <span style='color:{GREEN};font-size:13px;'>● Webhook configuré</span>
                      <code style='font-size:12px;color:{TEXT_MUT};'>{wh_cur.get('url','')}</code>
                    </div>""", unsafe_allow_html=True)
                else:
                    st.markdown(f"<p style='color:{AMBER};font-size:13px;margin-bottom:12px;'>Aucun webhook configuré pour ce tenant.</p>", unsafe_allow_html=True)

                with st.form("form_webhook", border=False):
                    wh_url    = st.text_input("URL du webhook", value=wh_cur.get("url", ""), placeholder="https://api.monapp.ci/webhooks/fraud")
                    wh_events = st.multiselect("Événements", ["fraud_detected", "high_risk", "batch_complete"],
                                               default=wh_cur.get("events", ["fraud_detected"]))
                    wh_secret = st.text_input("Secret HMAC (optionnel)", type="password")
                    if st.form_submit_button("Configurer le webhook", type="primary", use_container_width=True):
                        if not wh_url:
                            st.error("L'URL est obligatoire.")
                        else:
                            res = api_post(f"/api/v1/tenants/{wh_tid}/webhooks", {
                                "url": wh_url, "events": wh_events,
                                "secret": wh_secret or None,
                            })
                            if res:
                                st.success(f"✓ Webhook configuré sur `{wh_url}`")

    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Profil utilisateur
# ═══════════════════════════════════════════════════════════════════════════════
elif "Profil" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Mon profil</div>", unsafe_allow_html=True)

    token   = st.session_state.get("access_token", "")
    payload = _decode_token(token)
    exp     = payload.get("exp", 0)
    iat     = payload.get("iat", 0)
    remaining = max(0, int(exp - time.time()))
    minutes, seconds = divmod(remaining, 60)

    # ── Identité ──────────────────────────────────────────────────────────────
    pr1, pr2 = st.columns([1, 2], gap="small")

    with pr1:
        with st.container(border=True):
            st.markdown(f"""
            <div style="text-align:center;padding:12px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:{av_color};
                          display:flex;align-items:center;justify-content:center;
                          font-size:26px;font-weight:700;color:#fff;margin:0 auto 12px;">
                {initials}
              </div>
              <div style="font-size:17px;font-weight:600;color:{TEXT};">{username}</div>
              <div style="font-size:12px;color:{TEXT_MUT};margin:4px 0 8px;">{user.get('email','—')}</div>
              {role_badge}
            </div>
            """, unsafe_allow_html=True)

            st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:12px 0;'>", unsafe_allow_html=True)

            exp_color = GREEN if remaining > 300 else (AMBER if remaining > 60 else RED)
            st.markdown(f"""
            <div style="font-size:12px;color:{TEXT_MUT};margin-bottom:4px;">Session</div>
            <div style="font-size:18px;font-weight:600;color:{exp_color};">{minutes:02d}:{seconds:02d}</div>
            <div style="font-size:11px;color:{TEXT_MUT};">avant expiration du token</div>
            """, unsafe_allow_html=True)

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            if st.button("Se déconnecter", use_container_width=True):
                _logout()

    with pr2:
        with st.container(border=True):
            st.markdown("<div class='fg-section'>Informations du compte</div>", unsafe_allow_html=True)
            info_rows = [
                ("bi-person",          "Identifiant",   username),
                ("bi-envelope",        "Email",         user.get("email") or "—"),
                ("bi-shield-check",    "Rôles",         ", ".join(user.get("roles", []))),
                ("bi-key",             "Keycloak ID",   user.get("sub", "—")[:24] + "…" if len(user.get("sub",""))>24 else user.get("sub","—")),
                ("bi-clock",           "Token émis",    datetime.fromtimestamp(iat).strftime("%d/%m/%Y %H:%M") if iat else "—"),
                ("bi-calendar-check",  "Token expire",  datetime.fromtimestamp(exp).strftime("%d/%m/%Y %H:%M") if exp else "—"),
            ]
            rows_html = "".join(f"""
            <tr>
              <td style='width:160px;padding:8px 0;border-bottom:0.5px solid {BORDER};'>
                <span class="fg-info-label">
                  <i class="bi {ic}" style="color:{TEXT_MUT};font-size:13px;"></i> {k}
                </span>
              </td>
              <td style='padding:8px 0;border-bottom:0.5px solid {BORDER};font-size:13px;color:{TEXT};'>
                <code style='background:{GRAY_BG};padding:2px 6px;border-radius:4px;font-size:12px;'>{v}</code>
              </td>
            </tr>""" for ic, k, v in info_rows)
            st.markdown(f"""<table style='width:100%;border-collapse:collapse;'><tbody>{rows_html}</tbody></table>""", unsafe_allow_html=True)

        st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

        # ── Tenant lié ────────────────────────────────────────────────────────
        with st.container(border=True):
            st.markdown("<div class='fg-section'>Tenant associé</div>", unsafe_allow_html=True)
            my_tenant = api_get("/api/v1/auth/me/tenant")
            if my_tenant:
                env   = my_tenant.get("environment", "")
                e_col = GREEN if env == "production" else AMBER
                st.markdown(f"""
                <div style="display:flex;align-items:center;gap:16px;padding:4px 0;">
                  <div style="width:44px;height:44px;border-radius:10px;background:{GREEN_BG};
                              display:flex;align-items:center;justify-content:center;font-size:20px;">🏢</div>
                  <div>
                    <div style="font-size:16px;font-weight:600;color:{TEXT};">{my_tenant.get('name','—')}</div>
                    <div style="font-size:12px;color:{TEXT_MUT};margin-top:2px;">
                      ID {my_tenant.get('id','?')} &nbsp;·&nbsp;
                      {my_tenant.get('country','?')} &nbsp;·&nbsp;
                      <span style='color:{e_col};font-weight:500;'>{env}</span>
                    </div>
                  </div>
                </div>
                """, unsafe_allow_html=True)

                st.markdown("<hr style='border:none;border-top:0.5px solid #e5e7eb;margin:12px 0;'>", unsafe_allow_html=True)

                metrics = api_get(f"/api/v1/tenants/{my_tenant['id']}/metrics")
                if metrics:
                    m1, m2, m3 = st.columns(3)
                    m1.metric("Transactions (24h)", metrics.get("transaction_count", 0))
                    m2.metric("Fraudes (24h)",      metrics.get("fraud_count", 0))
                    m3.metric("Taux de détection",  f"{metrics.get('detection_rate', 0):.1%}")
            else:
                st.markdown(f"""
                <div style="padding:16px;background:{AMBER_BG};border-radius:8px;text-align:center;">
                  <div style="font-size:13px;color:#92400e;">Aucun tenant lié à votre compte Keycloak.</div>
                  <div style="font-size:12px;color:{TEXT_MUT};margin-top:4px;">
                    Contactez un administrateur pour associer votre compte.
                  </div>
                </div>""", unsafe_allow_html=True)

    # ── Modifier son profil ───────────────────────────────────────────────────
    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)
    with st.container(border=True):
        st.markdown("<div class='fg-section'>Modifier mon profil Keycloak</div>", unsafe_allow_html=True)
        st.markdown(f"""
        <p style='font-size:13px;color:{TEXT_MUT};'>
          La gestion du mot de passe et des informations personnelles se fait directement dans la console Keycloak.
        </p>
        """, unsafe_allow_html=True)
        st.link_button("Ouvrir mon compte Keycloak →", "http://localhost:8080/realms/fraudguard/account")

    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Mon Tenant (tenant_admin uniquement)
# ═══════════════════════════════════════════════════════════════════════════════
elif "Mon Tenant" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Mon entreprise</div>", unsafe_allow_html=True)

    my_tenant = api_get("/api/v1/auth/me/tenant")
    if not my_tenant:
        st.warning("Aucun tenant lié à votre compte. Contactez un administrateur FraudGuard.")
        st.markdown("</div>", unsafe_allow_html=True)
        st.stop()

    tenant_id_me = my_tenant["id"]
    env_col = GREEN if my_tenant.get("environment") == "production" else AMBER

    # ── En-tête tenant ────────────────────────────────────────────────────────
    with st.container(border=True):
        h1, h2 = st.columns([2, 1])
        with h1:
            st.markdown(f"""
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:12px;background:{GREEN_BG};
                          display:flex;align-items:center;justify-content:center;color:{GREEN};">
                <i class="bi bi-building bi-lg"></i>
              </div>
              <div>
                <div style="font-size:18px;font-weight:700;color:{TEXT};">{my_tenant.get('name')}</div>
                <div style="font-size:12px;color:{TEXT_MUT};margin-top:2px;">
                  <i class="bi bi-geo-alt"></i> {my_tenant.get('country')} &nbsp;·&nbsp;
                  <span style="color:{env_col};font-weight:500;">{my_tenant.get('environment')}</span>
                  &nbsp;·&nbsp; ID {tenant_id_me}
                </div>
              </div>
            </div>
            """, unsafe_allow_html=True)
        with h2:
            metrics = api_get(f"/api/v1/tenants/{tenant_id_me}/metrics")
            if metrics:
                st.metric("Transactions 24h", metrics.get("transaction_count", 0))

    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

    tab_info, tab_pol, tab_wh = st.tabs(["📋 Informations", "⚙️ Politiques de risque", "🔔 Webhooks"])

    with tab_info:
        c1, c2 = st.columns(2)
        with c1:
            with st.container(border=True):
                st.markdown("<div class='fg-section'>Détails</div>", unsafe_allow_html=True)
                for icon, label, val in [
                    ("bi-building",     "Nom",           my_tenant.get("name", "—")),
                    ("bi-geo-alt",      "Pays",          my_tenant.get("country", "—")),
                    ("bi-server",       "Environnement", my_tenant.get("environment", "—")),
                    ("bi-key",          "Keycloak ID",   (my_tenant.get("keycloak_id") or "—")[:20] + "…"),
                    ("bi-calendar",     "Créé le",       str(my_tenant.get("created_at", "—"))[:10]),
                ]:
                    st.markdown(f"""
                    <div style="display:flex;justify-content:space-between;padding:7px 0;
                                border-bottom:0.5px solid {BORDER};font-size:13px;">
                      <span style="color:{TEXT_MUT};display:flex;align-items:center;gap:6px;">
                        <i class="bi {icon}" style="font-size:13px;"></i> {label}
                      </span>
                      <span style="font-weight:500;color:{TEXT};">{val}</span>
                    </div>""", unsafe_allow_html=True)
        with c2:
            with st.container(border=True):
                st.markdown("<div class='fg-section'>Activité (24h)</div>", unsafe_allow_html=True)
                if metrics:
                    st.metric("Transactions",     metrics.get("transaction_count", 0))
                    st.metric("Fraudes détectées", metrics.get("fraud_count", 0))
                    st.metric("Taux de détection", f"{metrics.get('detection_rate', 0):.1%}")
                else:
                    st.info("Aucune activité sur les dernières 24h.")

    with tab_pol:
        cur = api_get(f"/api/v1/tenants/{tenant_id_me}/policies") or {}
        with st.container(border=True):
            pm1, pm2, pm3 = st.columns(3)
            pm1.metric("Seuil alerte",    f"{cur.get('score_threshold', 0.7):.0%}")
            pm2.metric("Seuil rejet auto", f"{cur.get('auto_reject_threshold', 0.9):.0%}")
            pm3.metric("Modèle actif",     cur.get("model_id", "fraud_v1"))
        st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
        with st.container(border=True):
            with st.form("form_my_policy", border=False):
                fc1, fc2 = st.columns(2)
                p_th  = fc1.slider("Seuil d'alerte (score fraude)",  0.0, 1.0, float(cur.get("score_threshold", 0.7)), 0.01)
                p_rej = fc2.slider("Seuil rejet automatique", 0.0, 1.0, float(cur.get("auto_reject_threshold", 0.9)), 0.01)
                st.caption("Les transactions dont le score dépasse le seuil de rejet sont bloquées automatiquement.")
                if st.form_submit_button("Enregistrer", type="primary", use_container_width=True):
                    res = api_post(f"/api/v1/tenants/{tenant_id_me}/policies", {
                        "score_threshold": p_th, "auto_reject_threshold": p_rej,
                        "model_id": cur.get("model_id", "fraud_v1"),
                    })
                    if res:
                        st.success("✓ Politique mise à jour.")

    with tab_wh:
        wh = api_get(f"/api/v1/tenants/{tenant_id_me}/webhooks") or {}
        with st.container(border=True):
            if wh.get("configured"):
                st.markdown(f"""
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                  <i class="bi bi-check-circle-fill" style="color:{GREEN};"></i>
                  <span style="font-size:13px;">Webhook actif : <code>{wh.get('url','')}</code></span>
                </div>""", unsafe_allow_html=True)
            else:
                st.markdown(f"<p style='color:{AMBER};font-size:13px;margin-bottom:12px;'><i class='bi bi-exclamation-circle'></i> Aucun webhook configuré.</p>", unsafe_allow_html=True)
            with st.form("form_my_webhook", border=False):
                wh_url    = st.text_input("URL du webhook", value=wh.get("url", ""))
                wh_events = st.multiselect("Événements", ["fraud_detected", "high_risk", "batch_complete"],
                                           default=wh.get("events", ["fraud_detected"]))
                wh_secret = st.text_input("Secret HMAC (optionnel)", type="password")
                if st.form_submit_button("Configurer", type="primary", use_container_width=True):
                    if not wh_url:
                        st.error("L'URL est obligatoire.")
                    else:
                        res = api_post(f"/api/v1/tenants/{tenant_id_me}/webhooks",
                                       {"url": wh_url, "events": wh_events, "secret": wh_secret or None})
                        if res:
                            st.success(f"✓ Webhook configuré.")
    st.markdown("</div>", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE : Conformité — compliance + tenant_admin + admin
# ═══════════════════════════════════════════════════════════════════════════════
elif "Conformité" in page:
    st.markdown("<div class='fg-page'>", unsafe_allow_html=True)
    st.markdown("<div class='fg-section' style='font-size:18px;'>Conformité & Audit</div>", unsafe_allow_html=True)

    tab_report, tab_audit, tab_retention = st.tabs(
        ["📊 Rapport BCEAO", "📋 Journal d'audit", "🗄️ Rétention des données"]
    )

    # ── Rapport BCEAO ─────────────────────────────────────────────────────────
    with tab_report:
        fc1, fc2 = st.columns(2)
        from_d = fc1.date_input("Du", value=datetime.now() - timedelta(days=30))
        to_d   = fc2.date_input("Au", value=datetime.now())

        report = api_get("/api/v1/compliance/report", params={
            "from_date": from_d.isoformat(),
            "to_date":   to_d.isoformat(),
        })

        if report:
            txn = report.get("transactions", {})
            total_r = txn.get("total", 0)
            fraud_r = txn.get("fraud_detected", 0)
            rate_r  = txn.get("fraud_rate", 0)
            anon_r  = txn.get("anonymized", 0)

            k1, k2, k3, k4 = st.columns(4)
            for col, label, icon, val, clr in [
                (k1, "Transactions",    "bi-arrow-left-right", f"{total_r:,}",   TEXT),
                (k2, "Fraudes",         "bi-shield-x",         f"{fraud_r:,}",   RED),
                (k3, "Taux de fraude",  "bi-percent",          f"{rate_r:.2%}",  AMBER),
                (k4, "Pseudonymisées",  "bi-incognito",        f"{anon_r:,}",    BLUE),
            ]:
                with col:
                    with st.container(border=True):
                        st.markdown(f"""
                        <div class="fg-kpi-label">
                          <span>{label}</span>
                          <i class="bi {icon}" style="color:{clr};"></i>
                        </div>
                        <div class="fg-kpi-value" style="color:{clr};">{val}</div>
                        """, unsafe_allow_html=True)

            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

            c1, c2 = st.columns(2)
            with c1:
                by_channel = txn.get("by_channel", {})
                if by_channel:
                    with st.container(border=True):
                        st.markdown("<div class='fg-section'>Par canal</div>", unsafe_allow_html=True)
                        for ch, cnt in sorted(by_channel.items(), key=lambda x: -x[1]):
                            pct = int(cnt / total_r * 100) if total_r else 0
                            st.markdown(f"""
                            <div style="margin-bottom:8px;">
                              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                                <span style="color:{TEXT_MUT};">{ch}</span>
                                <span style="font-weight:500;">{cnt} ({pct}%)</span>
                              </div>
                              <div class="fg-bar-wrap"><div class="fg-bar" style="width:{pct}%;"></div></div>
                            </div>""", unsafe_allow_html=True)

            with c2:
                by_country = txn.get("by_country", {})
                if by_country:
                    with st.container(border=True):
                        st.markdown("<div class='fg-section'>Par pays</div>", unsafe_allow_html=True)
                        for co, cnt in sorted(by_country.items(), key=lambda x: -x[1]):
                            pct = int(cnt / total_r * 100) if total_r else 0
                            st.markdown(f"""
                            <div style="margin-bottom:8px;">
                              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                                <span style="color:{TEXT_MUT};">{co}</span>
                                <span style="font-weight:500;">{cnt} ({pct}%)</span>
                              </div>
                              <div class="fg-bar-wrap"><div class="fg-bar" style="width:{pct}%;background:{BLUE};"></div></div>
                            </div>""", unsafe_allow_html=True)

            st.markdown(f"""
            <div style="margin-top:16px;padding:12px 16px;background:{GREEN_BG};border-radius:8px;
                        border:0.5px solid {GREEN_BORDER};font-size:12px;color:#166534;">
              <i class="bi bi-info-circle"></i>
              &nbsp;{report.get('regulatory_reference', '')} &nbsp;·&nbsp;
              Rapport généré le {report.get('generated_at','')[:16]}
            </div>""", unsafe_allow_html=True)

    # ── Journal d'audit ───────────────────────────────────────────────────────
    with tab_audit:
        audit_data = api_get("/api/v1/compliance/audit-log", params={"limit": 50})
        if audit_data:
            rows = audit_data.get("rows", [])
            total_a = audit_data.get("total", 0)
            st.markdown(f"<p style='font-size:12px;color:{TEXT_MUT};margin-bottom:8px;'>{total_a} action(s) enregistrée(s)</p>", unsafe_allow_html=True)
            if rows:
                df_audit = pd.DataFrame(rows)
                cols_show = [c for c in ["timestamp", "action_type", "actor_type", "resource_type", "resource_id", "outcome"] if c in df_audit.columns]
                with st.container(border=True):
                    st.dataframe(df_audit[cols_show], use_container_width=True, hide_index=True)
            else:
                st.info("Aucune action dans le journal.")
        else:
            st.info("Journal d'audit vide ou inaccessible.")

    # ── Rétention (admin uniquement) ──────────────────────────────────────────
    with tab_retention:
        if not is_admin:
            st.info("La gestion de la rétention est réservée aux administrateurs FraudGuard.")
        else:
            stats = api_get("/api/v1/compliance/retention-stats")
            if stats:
                r1, r2, r3 = st.columns(3)
                r1.metric("Total enregistrements", stats.get("total_records", 0))
                r2.metric("Expirés (à purger)",    stats.get("expired_records", 0))
                r3.metric("Pseudonymisés",          stats.get("anonymized_records", 0))
                st.markdown(f"""
                <div style="padding:10px 14px;background:{AMBER_BG};border-radius:8px;font-size:12px;color:#92400e;margin:12px 0;">
                  <i class="bi bi-clock-history"></i>
                  &nbsp;Politique de rétention : {stats.get('retention_policy_years', 5)} ans ({stats.get('regulatory_reference','')})
                </div>""", unsafe_allow_html=True)

                if stats.get("expired_records", 0) > 0:
                    with st.container(border=True):
                        st.markdown(f"<p style='color:{RED};font-size:13px;'><i class='bi bi-exclamation-triangle'></i> {stats['expired_records']} enregistrement(s) expiré(s) à purger.</p>", unsafe_allow_html=True)
                        if st.button("Purger les données expirées", type="primary"):
                            res = requests.delete(
                                f"{st.session_state['api_url']}/api/v1/compliance/expired",
                                headers=_hdrs(), timeout=10,
                            )
                            if res.status_code == 200:
                                st.success(f"✓ {res.json().get('records_deleted', 0)} enregistrement(s) supprimé(s).")
                            else:
                                st.error("Erreur lors de la purge.")

    st.markdown("</div>", unsafe_allow_html=True)
