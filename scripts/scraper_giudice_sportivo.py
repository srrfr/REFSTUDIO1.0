#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
REFSTUDIO - Raccolta e Parsing Comunicati Giudice Sportivo FIGC CRER (Eccellenza)
Scarica i comunicati ufficiali dal portale regionale FIGC CRER (https://figccrer.it/comunicati),
individua le sezioni della Giustizia Sportiva relative al Campionato di Eccellenza,
unisce le pagine in un unico PDF consolidato ("GiudiceSportivo_Eccellenza.pdf")
ed estrae i provvedimenti disciplinari (squalifiche, diffide, inibizioni dirigenti/staff)
pronti per l'integrazione nelle rose e nei profili squadra di REFSTUDIO.
"""

import os
import sys
import re
import time
import json
import shutil
import argparse
from pathlib import Path
from urllib.parse import urljoin

try:
    import pymupdf as fitz
except ImportError:
    import fitz

import pandas as pd
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader, PdfWriter
from tqdm import tqdm

# Forza l'output console in UTF-8 per evitare UnicodeEncodeError su console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "https://figccrer.it/comunicati"

ROOT_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = ROOT_DIR / "data" / "comunicati" / "downloads"
OUTPUT_DIR = ROOT_DIR / "data" / "comunicati" / "output"
PUBLIC_DIR = ROOT_DIR / "public" / "comunicati"

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

FINAL_PDF = OUTPUT_DIR / "GiudiceSportivo_Eccellenza.pdf"
PUBLIC_PDF = PUBLIC_DIR / "GiudiceSportivo_Eccellenza.pdf"
LOG_FILE = OUTPUT_DIR / "estrazioni.csv"
PUBLIC_LOG = PUBLIC_DIR / "estrazioni.csv"
SANCTIONS_JSON = OUTPUT_DIR / "provvedimenti_disciplinari.json"
PUBLIC_JSON = PUBLIC_DIR / "provvedimenti_disciplinari.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}


def get_all_pdf_links(max_pages=None, reverse=False):
    """
    Recupera tutti i link dei PDF presenti nelle varie pagine
    del portale comunicati FIGC CRER, ordinati per numero di CU.
    """
    pdf_links = []
    seen = set()
    session = requests.Session()
    session.headers.update(HEADERS)

    page = 1

    while True:
        if max_pages and page > max_pages:
            break

        url = BASE_URL if page == 1 else f"{BASE_URL}?page={page}"
        print(f"[*] Scansione pagina comunicati {page}...")

        try:
            r = session.get(url, timeout=30)
            if r.status_code != 200:
                break
        except Exception as e:
            print(f" [!] Connessione interrotta a pagina {page}: {e}")
            break

        soup = BeautifulSoup(r.text, "html.parser")
        found_current_page = 0

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if ".pdf" in href.lower():
                full_url = urljoin(BASE_URL, href)
                if full_url not in seen:
                    seen.add(full_url)
                    pdf_links.append(full_url)
                    found_current_page += 1

        if found_current_page == 0:
            break

        page += 1
        time.sleep(0.3)

    # Ordinamento naturale per numero di comunicato (es. cu1, cu2, ..., cu46)
    def cu_sort_key(u):
        filename = u.split("/")[-1].lower()
        match = re.search(r'cu(\d+)', filename)
        if match:
            return (0, int(match.group(1)))
        return (1, filename)

    pdf_links.sort(key=cu_sort_key, reverse=reverse)
    return pdf_links


def download_pdf(url, force=False):
    """
    Scarica il file PDF conservando una copia locale nella cartella downloads.
    """
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = url.split("/")[-1].split("?")[0]
    filename = re.sub(r"[^\w\-\.]", "_", filename)
    filepath = DOWNLOAD_DIR / filename

    if filepath.exists() and not force:
        return filepath

    r = requests.get(url, headers=HEADERS, timeout=120)
    r.raise_for_status()

    with open(filepath, "wb") as f:
        f.write(r.content)

    return filepath


def find_eccellenza_section(pdf_path):
    """
    Analizza il documento PDF ed individua con alta precisione le pagine di
    inizio e fine della sezione Giudice Sportivo per il campionato di Eccellenza.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f" [!] Errore apertura PDF {pdf_path.name}: {e}")
        return None

    start_page = None
    end_page = None

    for page_number in range(len(doc)):
        text_up = doc[page_number].get_text().upper()

        has_gs = ("GIUSTIZIA SPORTIVA" in text_up or "GIUDICE SPORTIVO" in text_up)
        has_ecc = ("CAMPIONATO ECCELLENZA" in text_up or "COPPA ITALIA ECCELLENZA" in text_up)
        has_femm_only = ("ECCELLENZA FEMMINILE" in text_up and "CAMPIONATO ECCELLENZA" not in text_up)
        has_provv = (
            "PROVVEDIMENTI DISCIPLINARI" in text_up
            or "CALCIATORI ESPULSI" in text_up
            or "AMMONIZIONE" in text_up
            or "SQUALIFICA" in text_up
            or "INIBIZIONE" in text_up
        )

        if start_page is None:
            if has_gs and has_ecc and not has_femm_only and has_provv:
                start_page = page_number
            elif has_ecc and not has_femm_only and has_provv and page_number > 0:
                # Caso in cui il titolo "GIUSTIZIA SPORTIVA" era sul fondo della pagina precedente
                prev_text = doc[page_number - 1].get_text().upper()
                if "GIUSTIZIA SPORTIVA" in prev_text or "GIUDICE SPORTIVO" in prev_text:
                    start_page = page_number

        if start_page is not None and page_number >= start_page:
            # Termina quando comincia una categoria successiva di Giustizia Sportiva
            fine_sezione = (
                "CAMPIONATO PROMOZIONE" in text_up
                or "COPPA ITALIA PROMOZIONE" in text_up
                or "CAMPIONATO PRIMA CATEGORIA" in text_up
                or "CAMPIONATO SECONDA CATEGORIA" in text_up
                or "CAMPIONATO TERZA CATEGORIA" in text_up
                or "CAMPIONATO JUNIORES" in text_up
                or "SETTORE GIOVANILE E SCOLASTICO" in text_up
                or "CALCIO FEMMINILE" in text_up
                or "CALCIO A CINQUE" in text_up
                or "CALCIO A 5" in text_up
            )
            if fine_sezione:
                end_page = page_number
                break

    if start_page is None:
        return None

    if end_page is None:
        end_page = len(doc) - 1

    return start_page, end_page


def add_pages(writer, pdf_path, start_page, end_page):
    """
    Estrae le pagine identificate e le aggiunge al writer PDF consolidato.
    """
    reader = PdfReader(str(pdf_path))
    for page_num in range(start_page, end_page + 1):
        if page_num < len(reader.pages):
            writer.add_page(reader.pages[page_num])


def extract_disciplinary_from_pages(pdf_path, start_page, end_page, cu_number, cu_url):
    """
    Parser semantico a stati: estrae e struttura con precisione tutti i provvedimenti
    (espulsioni, diffide, squalifiche, inibizioni) dall'intervallo di pagine di Eccellenza,
    distinguendo rigorosamente tra CAMPIONATO ECCELLENZA e COPPA ITALIA ECCELLENZA.
    """
    records = []
    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return records

    current_competition = "CAMPIONATO ECCELLENZA"
    current_role = "CALCIATORE"
    current_sanction = None
    prev_name = None
    prev_record_idx = None

    for p_num in range(start_page, end_page + 1):
        page_lines = [l.strip() for l in doc[p_num].get_text().split("\n") if l.strip()]

        for line in page_lines:
            l_up = line.upper()

            # Riconoscimento competizione corrente
            if "COPPA ITALIA ECCELLENZA" in l_up:
                current_competition = "COPPA ITALIA ECCELLENZA"
                current_sanction = None
                prev_name = None
                continue
            elif "CAMPIONATO ECCELLENZA" in l_up:
                current_competition = "CAMPIONATO ECCELLENZA"
                current_sanction = None
                prev_name = None
                continue

            # Stop quando comincia la Giustizia Sportiva di un'altra categoria (es. Promozione, Prima Categoria, ecc.)
            if ("CAMPIONATO" in l_up or "COPPA ITALIA" in l_up or "COPPA EMILIA" in l_up) and "ECCELLENZA" not in l_up:
                if any(other in l_up for other in [
                    "PROMOZIONE", "PRIMA CATEGORIA", "SECONDA CATEGORIA",
                    "JUNIORES", "CALCIO A 5", "CALCIO FEMMINILE"
                ]):
                    break

            # Intestazioni Ruolo Staff o Calciatori
            if any(h in l_up for h in ["DIRIGENTI", "ALLENATORI", "MASSAGGIATORI", "MEDICI"]):
                current_role = line.strip().capitalize()
                current_sanction = None
                prev_name = None
                continue
            elif "CALCIATORI ESPULSI" in l_up:
                current_role = "Calciatore (Espulso)"
                current_sanction = None
                prev_name = None
                continue
            elif "CALCIATORI NON ESPULSI" in l_up:
                current_role = "Calciatore (Non Espulso)"
                current_sanction = None
                prev_name = None
                continue
            elif "SOCIETA" in l_up:
                current_role = "Società"
                current_sanction = None
                prev_name = None
                continue

            # Intestazioni Sanzione
            if any(s in l_up for s in ["INIBIZIONE", "SQUALIFICA", "AMMONIZIONE CON DIFFIDA", "AMMONIZIONE"]):
                current_sanction = line.strip()
                prev_name = None
                continue

            # Caso 1: riga singola "NOME COGNOME (SQUADRA)"
            m_single = re.match(r"^([A-Z\s\'.]+)\s*\(([^)]+)\)$", line)
            if m_single and current_sanction:
                cand_name = m_single.group(1).strip()
                cand_team = m_single.group(2).strip()
                if (
                    len(cand_name) >= 3
                    and not cand_name.startswith("GARE DEL")
                    and not cand_name.startswith("CAMPIONATO")
                    and not cand_name.startswith("COPPA")
                ):
                    tipo = determine_tipo(current_sanction, current_role, current_competition)
                    rec = {
                        "tipo": tipo,
                        "competizione": current_competition,
                        "ruolo": current_role,
                        "nome": cand_name,
                        "squadra": cand_team,
                        "sanzione": current_sanction,
                        "motivo": "",
                        "comunicato": cu_number,
                        "url_comunicato": cu_url,
                    }
                    records.append(rec)
                    prev_record_idx = len(records) - 1
                prev_name = None
                continue

            # Caso 2: riga corrente "(SQUADRA)" con prev_name sulla riga precedente
            m_team = re.match(r"^\(([^)]+)\)$", line)
            if m_team and prev_name and current_sanction:
                cand_team = m_team.group(1).strip()
                cand_name = prev_name.strip()
                if (
                    len(cand_name) >= 3
                    and not cand_name.startswith("GARE DEL")
                    and not cand_name.startswith("CAMPIONATO")
                    and not cand_name.startswith("COPPA")
                ):
                    tipo = determine_tipo(current_sanction, current_role, current_competition)
                    rec = {
                        "tipo": tipo,
                        "competizione": current_competition,
                        "ruolo": current_role,
                        "nome": cand_name,
                        "squadra": cand_team,
                        "sanzione": current_sanction,
                        "motivo": "",
                        "comunicato": cu_number,
                        "url_comunicato": cu_url,
                    }
                    records.append(rec)
                    prev_record_idx = len(records) - 1
                prev_name = None
                continue

            # Candidato Nome in maiuscolo
            if (
                re.match(r"^[A-Z\s\'.]{3,}$", line)
                and not any(line.startswith(p) for p in [
                    "GARE DEL", "PROVVEDIMENTI", "IL GIUDICE", "IN BASE",
                    "CAMPIONATO", "COPPA", "ART.", "COMITATO", "RECLAMO", "DELIBERE"
                ])
            ):
                prev_name = line
                continue

            # Motivazione testuale associata all'ultimo record inserito (cattura anche frasi multilinea)
            if prev_record_idx is not None:
                is_header_or_name = (
                    any(h in l_up for h in [
                        "DIRIGENTI", "ALLENATORI", "MASSAGGIATORI", "MEDICI",
                        "CALCIATORI ESPULSI", "CALCIATORI NON ESPULSI", "SOCIETA",
                        "INIBIZIONE", "SQUALIFICA", "AMMONIZIONE",
                        "GARE DEL", "CAMPIONATO", "COPPA"
                    ])
                    or re.match(r"^[A-Z\s\'.]{3,}$", line)
                    or re.match(r"^\([^)]+\)$", line)
                    or line.isdigit()
                )

                if not is_header_or_name:
                    curr_motivo = records[prev_record_idx].get("motivo", "")
                    records[prev_record_idx]["motivo"] = (curr_motivo + " " + line).strip()

    # Assegna motivazioni contestuali predefinite se non esplicitate nel testo del bollettino
    for r in records:
        if not r.get("motivo"):
            if "CALCIATORE (ESPULSO)" in r.get("ruolo", "").upper():
                r["motivo"] = "Espulsione dal campo da parte del Direttore di Gara durante la partita"
            elif "CALCIATORE (NON ESPULSO)" in r.get("ruolo", "").upper():
                r["motivo"] = "Recidività in ammonizione (cumulo di cartellini gialli in campionato)"
            elif r.get("tipo") == "DIFFIDA":
                r["motivo"] = "IV infrazione per cumulo di ammonizioni in campionato (diffida attiva)"

    return records


def determine_tipo(sanction_str, role_str, competition_str=""):
    s_up = sanction_str.upper()
    r_up = role_str.upper()
    c_up = competition_str.upper()

    if "DIFFIDA" in s_up:
        # Se la diffida è maturata in Coppa Italia, la distinguiamo come DIFFIDA_COPPA
        if "COPPA" in c_up:
            return "DIFFIDA_COPPA"
        return "DIFFIDA"

    if any(h in r_up for h in ["DIRIGENTI", "ALLENATORI", "MASSAGGIATORI", "MEDICI"]) or "INIBIZIONE" in s_up:
        return "STAFF_INIBIZIONE"
    if "SQUALIFICA" in s_up:
        return "SQUALIFICA"
    return "AMMONIZIONE"


def sync_disciplinary_with_app(all_sanctions):
    """
    Aggiorna lo stato disciplinare dei calciatori e i profili squadra
    nel database locale (data/db-state.json e src/data/dataset.json).
    REQUISITO: La dicitura DIFFIDATO viene inserita e considerata SOLO se il
    provvedimento è relativo al solo CAMPIONATO ECCELLENZA e NON alla COPPA ITALIA ECCELLENZA.
    Le squalifiche vengono salvate con la nota e motivazione.
    """
    db_state_path = ROOT_DIR / "data" / "db-state.json"
    dataset_path = ROOT_DIR / "src" / "data" / "dataset.json"

    target_file = db_state_path if db_state_path.exists() else dataset_path
    if not target_file.exists():
        print(" [!] Nessun database locale trovato per la sincronizzazione immediata.")
        return 0

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            db = json.load(f)
    except Exception as e:
        print(f" [!] Errore lettura {target_file}: {e}")
        return 0

    players = db.get("players", [])
    if not players:
        return 0

    # 1. Reset e ricalcolo dello status disciplinare base dal campionato (Tuttocampo: >=4 gialli = DIFFIDATO)
    # e rimozione delle vecchie note di diffida generate erroneamente dalla Coppa Italia
    for p in players:
        yc = int(p.get("yellowCards") or 0)
        rc = int(p.get("redCards") or 0)
        if rc > 0:
            p["disciplinaryStatus"] = "SQUALIFICATO"
            p["disciplinaryDetails"] = {
                "tipo": "SQUALIFICA",
                "sanzione": "Squalifica per espulsione sul campo",
                "motivo": "Cartellino rosso diretto o doppia ammonizione durante la gara",
                "comunicato": "Referto Gara",
                "competizione": "Campionato Eccellenza"
            }
        elif yc >= 4:
            p["disciplinaryStatus"] = "DIFFIDATO"
            p["disciplinaryDetails"] = {
                "tipo": "DIFFIDA",
                "sanzione": "Ammonizione con diffida (IV infrazione)",
                "motivo": "Cumulo di 4 cartellini gialli in campionato (squalifica al prossimo giallo)",
                "comunicato": "Statistiche Campionato",
                "competizione": "Campionato Eccellenza"
            }
        else:
            p["disciplinaryStatus"] = "REGOLARE"
            p.pop("disciplinaryDetails", None)

        curr_notes = p.get("refereeNotes") or ""
        if "I AMMONIZIONE DIFFIDA" in curr_notes:
            curr_notes = re.sub(
                r"\|?\s*\[Giudice Sportivo CU n\. \d+\]: I AMMONIZIONE DIFFIDA\s*",
                "",
                curr_notes
            ).strip(" |")
            p["refereeNotes"] = curr_notes

    # Indicizza partite disputate per squadra per ricavare l'ultima giornata disputata
    matches = db.get("matches", [])
    team_played_max = {}
    def norm_team(s):
        return re.sub(r"[^a-z0-9]", "", str(s or "").lower())

    for m in matches:
        if m.get("played"):
            day = int(m.get("matchDay") or 0)
            h_team = norm_team(m.get("homeTeamName", ""))
            a_team = norm_team(m.get("awayTeamName", ""))
            team_played_max[h_team] = max(team_played_max.get(h_team, 0), day)
            team_played_max[a_team] = max(team_played_max.get(a_team, 0), day)

    default_max_day = max(team_played_max.values()) if team_played_max else 8

    # Mappatura Comunicato Ufficiale -> Giornata di Campionato
    CU_TO_MATCHDAY = {
        24: 0,  # Coppa Italia pre-campionato (30/08/2026)
        26: 1,  # Gare del 06/09/2026 (Giornata 1)
        27: 1,  # Gare del 09/09/2026 (Recuperi/Infrasettimanale G1)
        28: 2,  # Gare del 13/09/2026 (Giornata 2)
        30: 3,  # Gare del 20/09/2026 (Giornata 3)
        34: 4,  # Gare del 27/09/2026 (Giornata 4)
        37: 4,  # Coppa Italia (30/09/2026)
        38: 5,  # Gare del 04/10/2026 (Giornata 5)
        43: 7,  # Gare del 11/10/2026 (Giornata 7)
        46: 7,  # Coppa Italia (14/10/2026)
        47: 8,  # Gare del 18/10/2026 (Giornata 8)
    }

    def get_cu_number(cu_str):
        m = re.search(r"(\d+)", str(cu_str or ""))
        return int(m.group(1)) if m else 0

    def parse_squalifica_gare(sanz_str):
        s = str(sanz_str or "").upper()
        if "TRE GARE" in s:
            return 3
        if "DUE GARE" in s:
            return 2
        if "UNA GARA" in s:
            return 1
        m = re.search(r"(\d+)\s*GARE", s)
        if m:
            return int(m.group(1))
        return 1

    def team_tokens(s):
        cleaned = re.sub(
            r"\b(ssdarl|asd|srl|ssd|football|club|calcio|a\.s\.d\.|1909|1913|2009|2015)\b",
            "",
            str(s or ""),
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"[^a-z0-9\s]", "", cleaned.lower()).strip()
        return [t for t in cleaned.split() if len(t) >= 3]

    # Resetta status di base per tutti i giocatori a REGOLARE
    for p in players:
        p["disciplinaryStatus"] = "REGOLARE"
        p.pop("disciplinaryDetails", None)
        curr_notes = p.get("refereeNotes") or ""
        # Rimuove vecchie diciture errate o temporanee
        curr_notes = re.sub(r"\|?\s*\[Giudice Sportivo CU n\. \d+\]:\s*I AMMONIZIONE DIFFIDA\s*", "", curr_notes)
        p["refereeNotes"] = curr_notes.strip(" |")

    # Raggruppa i provvedimenti per ciascun calciatore
    player_sanctions_map = {}

    for sanz in all_sanctions:
        s_nome = norm_team(sanz["nome"])
        s_tokens = team_tokens(sanz["squadra"])
        s_team_norm = norm_team(sanz["squadra"])
        tipo = sanz["tipo"]
        comp = sanz.get("competizione", "").upper()

        # Escludi le diffide da Coppa Italia
        if tipo == "DIFFIDA_COPPA" or ("COPPA" in comp and "DIFFIDA" in tipo):
            continue

        if tipo not in ["DIFFIDA", "SQUALIFICA"]:
            continue

        for p in players:
            p_first = norm_team(p.get("firstName", ""))
            p_last = norm_team(p.get("lastName", ""))
            p_full = norm_team(f"{p.get('firstName', '')} {p.get('lastName', '')}")
            p_rev = norm_team(f"{p.get('lastName', '')} {p.get('firstName', '')}")

            name_match = (
                s_nome == p_full
                or s_nome == p_rev
                or (p_last in s_nome and p_first in s_nome)
                or s_nome in p_full
                or s_nome in p_rev
            )
            if not name_match:
                continue

            p_team = norm_team(p.get("teamName", ""))
            p_tokens = team_tokens(p.get("teamName", ""))

            token_overlap = any(t in p_tokens or t in p_team for t in s_tokens) or any(
                t in s_tokens or t in s_team_norm for t in p_tokens
            )
            direct_sub = s_team_norm in p_team or p_team in s_team_norm

            if token_overlap or direct_sub:
                pid = p.get("id")
                if pid not in player_sanctions_map:
                    player_sanctions_map[pid] = {"player": p, "sanctions": []}
                player_sanctions_map[pid]["sanctions"].append(sanz)
                break

    matched_count = 0
    active_squalificati_count = 0
    active_diffidati_count = 0
    scontate_count = 0
    diffide_superate_count = 0

    for pid, entry in player_sanctions_map.items():
        p = entry["player"]
        sanctions = entry["sanctions"]
        sanctions.sort(key=lambda x: get_cu_number(x["comunicato"]))

        p_team_key = norm_team(p.get("teamName", ""))
        team_max_day = team_played_max.get(p_team_key, default_max_day)

        # 1. Analisi DIFFIDE: rimosse se subentrata successiva squalifica per recidività in ammonizione
        active_diffida = None
        for s in sanctions:
            if s["tipo"] == "DIFFIDA" and "COPPA" not in s.get("competizione", "").upper():
                cu_diffida = get_cu_number(s["comunicato"])
                subsequent_recidivita = False
                for sub in sanctions:
                    if get_cu_number(sub["comunicato"]) > cu_diffida:
                        sanz_up = (sub.get("sanzione") or "").upper()
                        mot_up = (sub.get("motivo") or "").upper()
                        if (
                            "RECIDIVITA" in sanz_up
                            or "V INFR" in sanz_up
                            or "RECIDIVITÀ" in mot_up
                            or "RECIDIVITA" in mot_up
                        ):
                            subsequent_recidivita = True
                            diffide_superate_count += 1
                            break
                if not subsequent_recidivita:
                    active_diffida = s

        # 2. Analisi SQUALIFICHE: rimosse se scontate nelle gare successive al comunicato
        active_squalifica = None
        new_notes_list = []
        past_sanctions = []

        for s in sanctions:
            cu_num = get_cu_number(s["comunicato"])
            if s["tipo"] == "SQUALIFICA":
                matchday_sanz = CU_TO_MATCHDAY.get(cu_num, 8 if cu_num >= 47 else 7 if cu_num >= 43 else 0)
                gare_dopo = max(0, team_max_day - matchday_sanz)
                gare_tot = parse_squalifica_gare(s.get("sanzione"))
                gare_res = max(0, gare_tot - gare_dopo)

                if gare_res > 0:
                    active_squalifica = {
                        "sanction": s,
                        "gareSqualifica": gare_tot,
                        "gareScontate": gare_dopo,
                        "gareResidue": gare_res,
                    }
                    nota_gs = f"[Giudice Sportivo {s['comunicato']}]: {s['sanzione']}"
                    if gare_dopo > 0:
                        nota_gs += f" ({gare_res} gara residua da scontare)"
                    if s.get("motivo"):
                        nota_gs += f" - Motivo: {s['motivo']}"
                    new_notes_list.append(nota_gs)
                else:
                    scontate_count += 1
                    past_sanctions.append({
                        "tipo": "SQUALIFICA",
                        "sanzione": s["sanzione"],
                        "motivo": s.get("motivo") or "",
                        "comunicato": s["comunicato"],
                        "competizione": s.get("competizione") or "Campionato Eccellenza",
                        "urlComunicato": s.get("url_comunicato") or "",
                        "scontata": True,
                        "giornateSqualifica": gare_tot,
                        "giornateScontate": gare_dopo,
                        "giornateResidue": 0,
                    })
                    nota_gs = f"[Giudice Sportivo {s['comunicato']} - Scontata]: {s['sanzione']}"
                    if s.get("motivo"):
                        nota_gs += f" - Motivo: {s['motivo']}"
                    new_notes_list.append(nota_gs)

            elif s["tipo"] == "DIFFIDA":
                cu_diff = get_cu_number(s["comunicato"])
                is_active = (active_diffida == s)
                if is_active:
                    nota_gs = f"[Giudice Sportivo {s['comunicato']}]: {s['sanzione']} (Campionato Eccellenza)"
                    if s.get("motivo"):
                        nota_gs += f" - Motivo: {s['motivo']}"
                    new_notes_list.append(nota_gs)
                else:
                    nota_gs = f"[Giudice Sportivo {s['comunicato']} - Superata]: {s['sanzione']}"
                    new_notes_list.append(nota_gs)

        # 3. Assegnazione status finale e storico sanzioni pregresse
        if past_sanctions:
            p["pastSanctions"] = past_sanctions
        else:
            p.pop("pastSanctions", None)

        if active_squalifica:
            p["disciplinaryStatus"] = "SQUALIFICATO"
            s = active_squalifica["sanction"]
            p["disciplinaryDetails"] = {
                "tipo": "SQUALIFICA",
                "sanzione": s["sanzione"],
                "motivo": s.get("motivo") or "Espulsione dal campo durante la gara",
                "comunicato": s["comunicato"],
                "competizione": s.get("competizione") or "Campionato Eccellenza",
                "urlComunicato": s.get("url_comunicato") or "",
                "scontata": False,
                "giornateSqualifica": active_squalifica["gareSqualifica"],
                "giornateScontate": active_squalifica["gareScontate"],
                "giornateResidue": active_squalifica["gareResidue"],
            }
            active_squalificati_count += 1
        elif active_diffida:
            p["disciplinaryStatus"] = "DIFFIDATO"
            p["disciplinaryDetails"] = {
                "tipo": "DIFFIDA",
                "sanzione": active_diffida["sanzione"],
                "motivo": active_diffida.get("motivo")
                or "Cumulo di ammonizioni nel Campionato di Eccellenza (squalifica al prossimo giallo)",
                "comunicato": active_diffida["comunicato"],
                "competizione": "Campionato Eccellenza",
                "urlComunicato": active_diffida.get("url_comunicato") or "",
            }
            active_diffidati_count += 1
        else:
            p["disciplinaryStatus"] = "REGOLARE"
            p.pop("disciplinaryDetails", None)

        if new_notes_list:
            p["refereeNotes"] = " | ".join(new_notes_list)

        matched_count += 1

    # 4. Assegnazione sanzioni e inibizioni staff & dirigenti (Coppa Italia e Campionato) alle squadre
    teams = db.get("teams", [])
    for t in teams:
        t["staffSanctions"] = []

    staff_sanctions_all = [
        s for s in all_sanctions
        if s.get("tipo") == "STAFF_INIBIZIONE"
        or any(r in (s.get("ruolo") or "").upper() for r in ["DIRIGENT", "ALLENATOR", "MASSAGGIATOR", "MEDIC"])
        or "INIBIZIONE" in (s.get("sanzione") or "").upper()
    ]

    matched_staff_count = 0
    for s in staff_sanctions_all:
        s_team = s.get("squadra", "")
        s_norm = norm_team(s_team)
        s_toks = set(team_tokens(s_team))

        best_t = None
        best_score = 0
        for t in teams:
            t_name = t.get("name", "")
            t_norm = norm_team(t_name)
            if s_norm == t_norm:
                best_t = t
                best_score = 999
                break
            t_toks = set(team_tokens(t_name))
            common = s_toks.intersection(t_toks)
            if common:
                score = sum(len(tok) for tok in common)
                if score > best_score:
                    best_score = score
                    best_t = t

        if not best_t or best_score < 4:
            for t in teams:
                t_norm = norm_team(t.get("name", ""))
                if (len(t_norm) >= 6 and t_norm in s_norm) or (len(s_norm) >= 6 and s_norm in t_norm):
                    best_t = t
                    break

        if best_t:
            if "staffSanctions" not in best_t:
                best_t["staffSanctions"] = []
            best_t["staffSanctions"].append({
                "nome": s["nome"],
                "ruolo": s.get("ruolo") or "Dirigenti",
                "sanzione": s["sanzione"],
                "motivo": s.get("motivo") or "",
                "comunicato": s["comunicato"],
                "competizione": s.get("competizione") or "Campionato Eccellenza",
                "urlComunicato": s.get("url_comunicato") or "",
            })
            matched_staff_count += 1

    # Salva le modifiche
    try:
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(db, f, ensure_ascii=False, indent=2)

        if target_file != dataset_path and dataset_path.exists():
            with open(dataset_path, "w", encoding="utf-8") as f:
                json.dump(db, f, ensure_ascii=False, indent=2)

        print(
            f" [✓] Sincronizzati {matched_count} calciatori sanzionati: "
            f"{active_squalificati_count} Squalifiche attive, "
            f"{active_diffidati_count} Diffide attive, "
            f"{scontate_count} Squalifiche scontate (salvate in pastSanctions), "
            f"{diffide_superate_count} Diffide superate rimosse! | "
            f"{matched_staff_count} Sanzioni staff/dirigenza abbinate ai club."
        )
    except Exception as e_w:
        print(f" [!] Errore salvataggio database app: {e_w}")

    return matched_count


def main():
    parser = argparse.ArgumentParser(
        description="RefStudio - Scraping Comunicati Ufficiali Giudice Sportivo FIGC CRER (Eccellenza)"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Numero massimo di pagine del portale comunicati da scansionare",
    )
    parser.add_argument(
        "--limit-pdfs",
        type=int,
        default=None,
        help="Numero massimo di file PDF da scaricare ed elaborare",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Forza il download dei PDF anche se già presenti nella cache",
    )
    parser.add_argument(
        "--reverse",
        action="store_true",
        help="Elabora dal comunicato più recente al più vecchio (default: ordine cronologico crescente)",
    )
    parser.add_argument(
        "--sync-app",
        action="store_true",
        default=True,
        help="Aggiorna automaticamente lo status disciplinare e le note dei calciatori in REFSTUDIO",
    )
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Sincronizza direttamente i provvedimenti già presenti in cache senza effettuare nuovo scraping",
    )
    args = parser.parse_args()

    if args.sync_only:
        print("[*] Modalità sync-only: sincronizzazione diretta provvedimenti disciplinari ed inibizioni staff...")
        if SANCTIONS_JSON.exists():
            with open(SANCTIONS_JSON, "r", encoding="utf-8") as f:
                sanctions = json.load(f)
            sync_disciplinary_with_app(sanctions)
            return
        else:
            print(" [!] Nessun file provvedimenti_disciplinari.json trovato.")
            return

    print("=" * 65)
    print(" REFSTUDIO - RACCOLTA GIUDICE SPORTIVO FIGC CRER (ECCELLENZA)")
    print("=" * 65)

    print("\n[1/3] Ricerca comunicati ufficiali sul portale FIGC CRER...")
    pdf_links = get_all_pdf_links(max_pages=args.max_pages, reverse=args.reverse)
    if args.limit_pdfs:
        pdf_links = pdf_links[:args.limit_pdfs]

    print(f"\n[✓] Totale PDF da verificare: {len(pdf_links)}\n")

    writer = PdfWriter()
    report_rows = []
    all_sanctions = []
    estratti = 0

    print("[2/3] Download ed estrazione sezioni Giudice Sportivo Eccellenza...\n")
    for url in tqdm(pdf_links, desc="Elaborazione Comunicati", unit="pdf"):
        try:
            pdf_file = download_pdf(url, force=args.force)
            result = find_eccellenza_section(pdf_file)

            if result is None:
                continue

            start_page, end_page = result

            add_pages(writer, pdf_file, start_page, end_page)
            estratti += 1

            cu_match = re.search(r'cu(\d+)', pdf_file.name, re.IGNORECASE)
            cu_label = f"CU n. {cu_match.group(1)}" if cu_match else pdf_file.stem

            sanctions = extract_disciplinary_from_pages(
                pdf_file, start_page, end_page, cu_label, url
            )
            all_sanctions.extend(sanctions)

            report_rows.append({
                "file": pdf_file.name,
                "comunicato": cu_label,
                "pagina_inizio": start_page + 1,
                "pagina_fine": end_page + 1,
                "pagine_totali_estratte": end_page - start_page + 1,
                "sanzioni_rilevate": len(sanctions),
                "url": url,
            })

        except Exception as e:
            print(f"\n[!] Errore su {url}: {e}")

    print("\n[3/3] Generazione file consolidati e report...")

    # Salva il PDF finale consolidato
    with open(FINAL_PDF, "wb") as f:
        writer.write(f)

    # Copia in public/ per consentire la visualizzazione e il download diretto nell'applicazione
    try:
        shutil.copy2(FINAL_PDF, PUBLIC_PDF)
        print(f" [✓] PDF consolidato esportato in: {PUBLIC_PDF}")
    except Exception as e_copy:
        print(f" [!] Avviso copia PDF in public: {e_copy}")

    # Salva il log delle estrazioni in CSV
    if report_rows:
        df_log = pd.DataFrame(report_rows)
        df_log.to_csv(LOG_FILE, index=False, sep=";", encoding="utf-8-sig")
        try:
            shutil.copy2(LOG_FILE, PUBLIC_LOG)
        except Exception:
            pass

    # Salva i provvedimenti disciplinari estratti in formato JSON
    with open(SANCTIONS_JSON, "w", encoding="utf-8") as f_json:
        json.dump(all_sanctions, f_json, ensure_ascii=False, indent=2)

    try:
        shutil.copy2(SANCTIONS_JSON, PUBLIC_JSON)
    except Exception:
        pass

    # Sincronizza con l'applicazione
    if args.sync_app and all_sanctions:
        sync_disciplinary_with_app(all_sanctions)

    print("\n" + "=" * 65)
    print(f" Comunicati verificati : {len(pdf_links)}")
    print(f" Comunicati con Ecc.   : {estratti}")
    print(f" Provvedimenti estratti: {len(all_sanctions)}")
    print(f" PDF Finale Unificato  : {FINAL_PDF}")
    print(f" Provvedimenti JSON    : {SANCTIONS_JSON}")
    print(f" Log Estrazioni CSV    : {LOG_FILE}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
