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

            # Eventuale motivazione aggiuntiva associata all'ultimo record inserito
            if prev_record_idx is not None and (line.startswith("Per ") or line.startswith("per ")):
                records[prev_record_idx]["motivo"] = line.strip()

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
        elif yc >= 4:
            p["disciplinaryStatus"] = "DIFFIDATO"
        else:
            p["disciplinaryStatus"] = "REGOLARE"

        curr_notes = p.get("refereeNotes") or ""
        if "I AMMONIZIONE DIFFIDA" in curr_notes:
            curr_notes = re.sub(
                r"\|?\s*\[Giudice Sportivo CU n\. \d+\]: I AMMONIZIONE DIFFIDA\s*",
                "",
                curr_notes
            ).strip(" |")
            p["refereeNotes"] = curr_notes

    # Indicizza calciatori per nome normalizzato e squadra
    def norm(s):
        return re.sub(r"[^a-z0-9]", "", str(s or "").lower())

    matched_count = 0

    for sanz in all_sanctions:
        s_nome = norm(sanz["nome"])
        s_squadra = norm(sanz["squadra"])
        tipo = sanz["tipo"]
        comp = sanz.get("competizione", "").upper()

        # ESCLUSIONE COPPA ITALIA PER DIFFIDE:
        # Se la diffida è relativa alla Coppa Italia, NON applicare la dicitura DIFFIDATO
        if tipo == "DIFFIDA_COPPA" or ("COPPA" in comp and "DIFFIDA" in tipo):
            continue

        if tipo not in ["DIFFIDA", "SQUALIFICA"]:
            continue

        for p in players:
            p_fullname = norm(f"{p.get('firstName', '')} {p.get('lastName', '')}")
            p_revname = norm(f"{p.get('lastName', '')} {p.get('firstName', '')}")
            p_team = norm(p.get("teamName", ""))

            # Verifica corrispondenza nome e squadra (o sottostringa squadra)
            name_match = (s_nome == p_fullname or s_nome == p_revname)
            team_match = (s_squadra in p_team or p_team in s_squadra)

            if name_match and team_match:
                if tipo == "SQUALIFICA":
                    p["disciplinaryStatus"] = "SQUALIFICATO"
                    nota_gs = f"[Giudice Sportivo {sanz['comunicato']}]: {sanz['sanzione']}"
                elif tipo == "DIFFIDA" and p.get("disciplinaryStatus") != "SQUALIFICATO":
                    # Solo da CAMPIONATO ECCELLENZA
                    p["disciplinaryStatus"] = "DIFFIDATO"
                    nota_gs = f"[Giudice Sportivo {sanz['comunicato']}]: {sanz['sanzione']} (Campionato Eccellenza)"

                curr_notes = p.get("refereeNotes") or ""
                if nota_gs not in curr_notes:
                    p["refereeNotes"] = (curr_notes + " | " + nota_gs).strip(" |")

                matched_count += 1
                break

    # Salva le modifiche
    try:
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(db, f, ensure_ascii=False, indent=2)

        if target_file != dataset_path and dataset_path.exists():
            with open(dataset_path, "w", encoding="utf-8") as f:
                json.dump(db, f, ensure_ascii=False, indent=2)

        print(f" [✓] Sincronizzati {matched_count} provvedimenti disciplinari (diffide considerate ESCLUSIVAMENTE da Campionato)!")
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
    args = parser.parse_args()

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
