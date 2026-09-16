import os
import sys
import time
import re
import argparse
import subprocess
from datetime import datetime
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

# Forza l'output console in UTF-8 per evitare UnicodeEncodeError su Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# =============================================================
# CONFIGURAZIONE & CREDENZIALI TUTTOCAMPO
# =============================================================
EMAIL_TUTTOCAMPO = os.getenv("TUTTOCAMPO_EMAIL", "srrfr2026")
PASSWORD_TUTTOCAMPO = os.getenv("TUTTOCAMPO_PASSWORD", "gp22wt!prBALp4y")

BASE_URL = "https://www.tuttocampo.it"

GIRONI = {
    "Girone A": "https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeA",
    "Girone B": "https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeB"
}

MESI = {
    "gen": "01", "feb": "02", "mar": "03", "apr": "04", "mag": "05", "giu": "06",
    "lug": "07", "ago": "08", "set": "09", "ott": "10", "nov": "11", "dic": "12",
    "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04", "maggio": "05",
    "giugno": "06", "luglio": "07", "agosto": "08", "settembre": "09", "ottobre": "10",
    "novembre": "11", "dicembre": "12"
}

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""


def accetta_cookie_se_presenti(page):
    """Accetta il banner dei cookie FastCMP o Iubenda e rimuove overlay bloccanti."""
    try:
        if page.locator("#fast-cmp-iframe").count() > 0:
            frame = page.frame_locator("#fast-cmp-iframe")
            btn = frame.locator("button:has-text('Accettare'), button:has-text('Accetta'), button.fast-cmp-button-primary")
            if btn.count() > 0:
                btn.first.click(timeout=3000)
                time.sleep(0.5)
    except Exception:
        pass

    try:
        btn_cookie = page.query_selector("button#iubenda-cs-accept-btn, button.iubenda-cs-accept-btn, #iubFooterBtn")
        if btn_cookie:
            btn_cookie.click()
            time.sleep(0.5)
    except Exception:
        pass

    try:
        page.evaluate("() => { document.getElementById('fast-cmp-root')?.remove(); document.querySelector('.iubenda-cs-overlay')?.remove(); }")
    except Exception:
        pass


def effettua_login_modal(page):
    """Gestisce il login tramite il popup / modale (#loginmodal) dopo aver gestito i cookie."""
    print(" -> Apertura home page per autenticazione...")
    try:
        page.goto("https://www.tuttocampo.it/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(1.5)
        accetta_cookie_se_presenti(page)
    except Exception as e:
        print(f" [!] Errore nel caricamento della home page: {e}")
        return False

    print(" -> Apertura del modale di login...")
    try:
        # Rende visibile il form direttamente nel DOM
        page.evaluate("() => { const m = document.getElementById('loginmodal'); if (m) { m.style.display = 'block'; m.style.opacity = '1'; } }")
        time.sleep(0.5)

        page.fill("#login_username, input[name='username'], input#Username", EMAIL_TUTTOCAMPO)
        page.fill("#login_password, input[name='password'], input#Password", PASSWORD_TUTTOCAMPO)

        print(" -> Invio credenziali...")
        submit_btn = page.locator("#loginmodal input[type='submit'], #loginmodal button[type='submit'], input[name='submit_login']")
        submit_btn.first.click()
        time.sleep(3)

        feedback = page.locator("#loginmodal").inner_text()
        if "utente non attivo" in feedback.lower():
            print(" [⚠️] AVVISO TUTTOCAMPO: L'account risulta 'Utente non attivo' (è necessario confermare il link di attivazione inviato da Tuttocampo via email).")
            print("      -> Procedo regolarmente con l'estrazione delle squadre, classifiche e giornate (dati pubblici).")
            return False
        elif "password" in feedback.lower() and "errat" in feedback.lower():
            print(" [⚠️] AVVISO TUTTOCAMPO: Password non corretta.")
            return False
        else:
            print(" [✓] Login completato con successo!")
            time.sleep(1)
            accetta_cookie_se_presenti(page)
            return True
    except Exception as e:
        print(f" [!] Avviso durante il login: {e}")
        return False


def get_html_with_browser(page, url):
    """Scarica il codice HTML dopo il caricamento del DOM e rimozione cookie."""
    for tentativo in range(1, 3):
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(1.5)
            accetta_cookie_se_presenti(page)

            if resp and resp.status == 403:
                print(f"  [!] Risposta 403 Forbidden per {url}, attendo e riprovo ({tentativo}/2)...")
                time.sleep(2)
                continue

            content = page.content()
            if "403 Forbidden" in content:
                print(f"  [!] Rilevato 403 Forbidden in {url}, attendo e riprovo ({tentativo}/2)...")
                time.sleep(2)
                continue

            return BeautifulSoup(content, 'html.parser')
        except Exception as e:
            print(f"  [!] Errore nel caricamento di {url} (tentativo {tentativo}): {e}")
            time.sleep(2)
    return None



# -------------------------------------------------------------
# 1. PARTE SQUADRE E ROSE CON ESTRAZIONE ID
# -------------------------------------------------------------

def get_squadre_da_girone(page, url_girone):
    """Estrae le squadre reali e il loro ID Rosa dall'URL."""
    soup = get_html_with_browser(page, url_girone)
    squadre = []
    if not soup:
        return squadre

    main_table = soup.find('table', class_=re.compile(r'ranking|standings|table', re.I)) or soup

    for a in main_table.find_all('a', href=True):
        href = a['href']
        if '/Squadra/' in href:
            img = a.find('img')
            nome_squadra = ""
            if img and img.get('alt'):
                nome_squadra = img['alt'].strip()
            elif a.get('title'):
                nome_squadra = a['title'].strip()
            else:
                nome_squadra = a.get_text(strip=True)

            nome_squadra = re.sub(r'^(logo|Logo)\s+', '', nome_squadra, flags=re.IGNORECASE).strip()

            if not nome_squadra or len(nome_squadra) <= 3:
                match = re.search(r'/Squadra/([^/]+)', href)
                if match:
                    slug = match.group(1)
                    nome_squadra = re.sub(r'([a-z])([A-Z])', r'\1 \2', slug)

            if not nome_squadra or len(nome_squadra) < 2:
                continue

            full_url = BASE_URL + href if href.startswith('/') else href

            if '/Scheda' in full_url:
                url_rosa = full_url.replace('/Scheda', '/Rosa')
            elif '/Rosa' in full_url:
                url_rosa = full_url
            else:
                base_sq = full_url.rsplit('/', 1)[0] if full_url.endswith('/') else full_url
                url_rosa = base_sq + '/Rosa'

            # Estrazione ID Rosa dall'URL (es. /Squadra/ImoleseCalcio/936424/Rosa -> 936424)
            match_id_rosa = re.search(r'/Squadra/[^/]+/(\d+)', url_rosa, re.I)
            id_rosa = match_id_rosa.group(1) if match_id_rosa else ""

            squadra_entry = {
                'nome': nome_squadra,
                'id_rosa': id_rosa,
                'url_scheda': full_url,
                'url_rosa': url_rosa
            }

            if not any(s['url_rosa'] == url_rosa for s in squadre):
                squadre.append(squadra_entry)

    return squadre


def get_rosa_squadra(page, sq_info, nome_girone):
    """Estrae i calciatori con ID Giocatore, ID Rosa, Anno di Nascita e tutte le statistiche."""
    url_rosa = sq_info['url_rosa']
    nome_squadra = sq_info['nome']
    id_rosa = sq_info['id_rosa']

    soup = get_html_with_browser(page, url_rosa)
    giocatori = []
    if not soup:
        return giocatori

    links_giocatori = soup.find_all('a', href=re.compile(r'/giocatore/|/Scheda/', re.IGNORECASE))

    for link in links_giocatori:
        nome_giocatore = link.get_text(strip=True)
        href_g = link['href']

        if not nome_giocatore or len(nome_giocatore) < 3 or 'squadra' in href_g.lower():
            continue

        url_giocatore = BASE_URL + href_g if href_g.startswith('/') else href_g

        # Estrazione ID Giocatore dall'URL (es. /Giocatore/Scheda/7291378/Scheda -> 7291378)
        match_id_g = re.search(r'/(?:Giocatore|Scheda)/(?:Scheda/)?(\d+)', url_giocatore, re.I)
        id_giocatore = match_id_g.group(1) if match_id_g else ""

        parent_row = link.find_parent('tr') or link.find_parent('div')
        dettagli_testo = ""
        if parent_row:
            dettagli_testo = " | ".join([t.strip() for t in parent_row.stripped_strings if t.strip()])

        # Parsing dettagli della riga
        parts = [p.strip() for p in dettagli_testo.split("|") if p.strip()]
        parts_cleaned = [p for p in parts if not re.match(r'^\(\d+\)$', p)]

        full_name = parts_cleaned[0] if len(parts_cleaned) > 0 else nome_giocatore
        data_nascita = parts_cleaned[1] if len(parts_cleaned) > 1 else ""
        ruolo = parts_cleaned[2] if len(parts_cleaned) > 2 else ""

        def safe_int(x):
            try: return int(x)
            except: return 0

        reti = safe_int(parts_cleaned[3]) if len(parts_cleaned) > 3 else 0
        presenze = safe_int(parts_cleaned[4]) if len(parts_cleaned) > 4 else 0
        ammonizioni = safe_int(parts_cleaned[5]) if len(parts_cleaned) > 5 else 0
        espulsioni = safe_int(parts_cleaned[6]) if len(parts_cleaned) > 6 else 0

        # Estrae l'Anno di Nascita (es. da 27-09-2000 ricava 2000)
        match_anno = re.search(r'\b(19\d\d|20\d\d)\b', data_nascita)
        anno_nascita = match_anno.group(1) if match_anno else data_nascita

        name_parts = full_name.split()
        if len(name_parts) == 1:
            cognome = name_parts[0]
            nome = ""
        elif len(name_parts) >= 2:
            cognome = name_parts[0]
            nome = " ".join(name_parts[1:])
        else:
            cognome = ""
            nome = ""

        giocatore_data = {
            'Nome': nome,
            'Cognome': cognome,
            'ID Giocatore': id_giocatore,
            'ID Rosa': id_rosa,
            'Nome Rosa': nome_squadra,
            'Categoria': 'Eccellenza',
            'Girone': nome_girone,
            'Regione': 'Emilia-Romagna',
            'Anno di nascita': anno_nascita,
            'Ruolo': ruolo,
            'Presenze': presenze,
            'Reti': reti,
            'Ammonizioni': ammonizioni,
            'Espulsioni': espulsioni
        }

        if not any(g['ID Giocatore'] == id_giocatore and g['ID Rosa'] == id_rosa for g in giocatori):
            giocatori.append(giocatore_data)

    return giocatori


# -------------------------------------------------------------
# 2. PARTE CLASSIFICA E GARE
# -------------------------------------------------------------

def get_classifica_girone(page, url_girone):
    """Estrae la classifica per il girone."""
    url_classifica = f"{url_girone}/Classifica"
    soup = get_html_with_browser(page, url_classifica)
    classifica = []
    if not soup:
        return classifica

    rows = soup.find_all('tr')
    pos = 1
    for r in rows:
        team_link = r.find('a', href=re.compile(r'/Squadra/', re.I))
        if not team_link:
            continue

        nome_sq = team_link.get_text(strip=True)
        nome_sq = re.sub(r'^(logo|Logo)\s+', '', nome_sq, flags=re.I).strip()

        if not nome_sq or len(nome_sq) < 2 or nome_sq.lower() in ['squadra', 'pos']:
            continue

        cells = r.find_all(['td', 'th'])
        valori_numerici = []
        for c in cells:
            txt = c.get_text(strip=True)
            if re.match(r'^-?\d+$', txt):
                valori_numerici.append(int(txt))

        if len(valori_numerici) >= 6:
            if valori_numerici[0] == pos or (pos == 1 and valori_numerici[0] in [1, 0]):
                valori = valori_numerici[1:]
                p_num = valori_numerici[0]
            else:
                valori = valori_numerici
                p_num = pos

            if len(valori) >= 6:
                punti = valori[0]
                giocate = valori[1]
                vittorie = valori[2]
                pareggi = valori[3]
                sconfitte = valori[4]
                gf = valori[5]
                gs = valori[6] if len(valori) > 6 else 0
                dr = (gf - gs) if len(valori) <= 7 else valori[7]

                if not any(c['Squadra'] == nome_sq for c in classifica):
                    classifica.append({
                        "Posizione": p_num,
                        "Squadra": nome_sq,
                        "Punti": punti,
                        "Partite giocate": giocate,
                        "Vittorie": vittorie,
                        "Pareggi": pareggi,
                        "Sconfitte": sconfitte,
                        "Gol fatti": gf,
                        "Gol subiti": gs,
                        "Differenza reti": dr
                    })
                    pos += 1

    return classifica


def parse_data_stringa(data_text):
    if not data_text:
        return None, ""

    match_full = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', data_text)
    if match_full:
        d, m, y = match_full.groups()
        dt_str = f"{int(d):02d}/{int(m):02d}/{y}"
        try: return datetime.strptime(dt_str, "%d/%m/%Y"), dt_str
        except: return None, dt_str

    match_m = re.search(r'(\d{1,2})\s+([a-zA-Z]{3,9})', data_text)
    if match_m:
        giorno = int(match_m.group(1))
        mese_str = match_m.group(2).lower()
        mese_num = MESI.get(mese_str, "01")
        anno = datetime.now().year
        dt_str = f"{giorno:02d}/{mese_num}/{anno}"
        try: return datetime.strptime(dt_str, "%d/%m/%Y"), dt_str
        except: return None, dt_str

    return None, data_text


def get_gare_girone(page, url_girone, num_giornate):
    gare = []
    today = datetime.now()

    for n_giornata in range(1, num_giornate + 1):
        url_giornata = f"{url_girone}/Giornata{n_giornata}"
        print(f"    -> Scansione Giornata {n_giornata}/{num_giornate}...")
        soup = get_html_with_browser(page, url_giornata)
        if not soup:
            continue

        date_header = soup.find(class_=re.compile(r'date|header|day', re.I))
        data_giornata_text = date_header.get_text(strip=True) if date_header else ""
        dt_obj, current_date_str = parse_data_stringa(data_giornata_text)

        rows = soup.find_all('tr')
        for row in rows:
            squadre_links = row.find_all('a', href=re.compile(r'/Squadra/', re.I))
            if len(squadre_links) >= 2:
                casa = re.sub(r'^(logo|Logo)\s+', '', squadre_links[0].get_text(strip=True), flags=re.I)
                trasferta = re.sub(r'^(logo|Logo)\s+', '', squadre_links[1].get_text(strip=True), flags=re.I)

                if not casa or not trasferta or casa == trasferta:
                    continue

                gol_casa = None
                gol_trasf = None
                giocata = "No"

                score_elements = row.find_all(['td', 'span', 'div'], class_=re.compile(r'score|result|goal', re.I))
                punteggi = []
                for el in score_elements:
                    txt = el.get_text(strip=True)
                    if txt.isdigit():
                        punteggi.append(int(txt))

                if len(punteggi) >= 2:
                    gol_casa = punteggi[0]
                    gol_trasf = punteggi[1]
                else:
                    riga_pulta = re.sub(r'\b\d{1,2}[:.]\d{2}\b', '', row.get_text(" ", strip=True))
                    numeri = re.findall(r'\b\d{1,2}\b', riga_pulta)
                    nums = [int(n) for n in numeri if int(n) < 15]
                    if len(nums) >= 2:
                        gol_casa = nums[0]
                        gol_trasf = nums[1]

                if gol_casa is not None and gol_trasf is not None:
                    giocata = "Si"
                elif dt_obj and dt_obj <= today:
                    giocata = "Si"
                else:
                    giocata = "No"

                gare.append({
                    "Numero giornata": n_giornata,
                    "Data": current_date_str if current_date_str else f"Giornata {n_giornata}",
                    "Giocata": giocata,
                    "Squadra ospitante": casa,
                    "Reti squadra ospitante": gol_casa if giocata == "Si" else None,
                    "Squadra ospite": trasferta,
                    "Reti squadra ospite": gol_trasf if giocata == "Si" else None
                })

    return gare


# -------------------------------------------------------------
# 3. GENERAZIONE UNICA FILE EXCEL COMPLETO (SICURA SENZA ERRORI)
# -------------------------------------------------------------

def genera_excel_completo(database_calciatori, dati_gironi, file_out="Eccellenza_Emilia_Romagna_Database_Completo.xlsx"):
    """Crea un UNICO file Excel con 5 Fogli garantendo che almeno un foglio sia sempre presente."""
    wb = openpyxl.Workbook()

    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    right_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(left=Side(style='thin', color='D9D9D9'), right=Side(style='thin', color='D9D9D9'), top=Side(style='thin', color='D9D9D9'), bottom=Side(style='thin', color='D9D9D9'))
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

    # Colonne predefinite nel caso in cui una lista sia vuota
    default_columns = {
        "Calciatori": ['Nome', 'Cognome', 'ID Giocatore', 'ID Rosa', 'Nome Rosa', 'Categoria', 'Girone', 'Regione', 'Anno di nascita', 'Ruolo', 'Presenze', 'Reti', 'Ammonizioni', 'Espulsioni'],
        "Girone A - Gare": ['Numero giornata', 'Data', 'Giocata', 'Squadra ospitante', 'Reti squadra ospitante', 'Squadra ospite', 'Reti squadra ospite'],
        "Girone A - Classifica": ['Posizione', 'Squadra', 'Punti', 'Partite giocate', 'Vittorie', 'Pareggi', 'Sconfitte', 'Gol fatti', 'Gol subiti', 'Differenza reti'],
        "Girone B - Gare": ['Numero giornata', 'Data', 'Giocata', 'Squadra ospitante', 'Reti squadra ospitante', 'Squadra ospite', 'Reti squadra ospite'],
        "Girone B - Classifica": ['Posizione', 'Squadra', 'Punti', 'Partite giocate', 'Vittorie', 'Pareggi', 'Sconfitte', 'Gol fatti', 'Gol subiti', 'Differenza reti'],
    }

    fogli_ordinati = [
        ("Calciatori", database_calciatori),
        ("Girone A - Gare", dati_gironi.get("Girone A", {}).get("gare", [])),
        ("Girone A - Classifica", dati_gironi.get("Girone A", {}).get("classifica", [])),
        ("Girone B - Gare", dati_gironi.get("Girone B", {}).get("gare", [])),
        ("Girone B - Classifica", dati_gironi.get("Girone B", {}).get("classifica", []))
    ]

    first_sheet = True
    for title_sheet, lista_dati in fogli_ordinati:
        if first_sheet:
            ws = wb.active
            ws.title = title_sheet
            first_sheet = False
        else:
            ws = wb.create_sheet(title=title_sheet)

        if lista_dati:
            df = pd.DataFrame(lista_dati)
            headers = list(df.columns)
            row_values = df.values
        else:
            headers = default_columns.get(title_sheet, [])
            row_values = []

        for col_idx, col_name in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=col_name)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border

        for row_idx, row_vals in enumerate(row_values, 2):
            for col_idx, val in enumerate(row_vals, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = data_font
                cell.border = thin_border

                if isinstance(val, (int, float)):
                    cell.alignment = right_align
                    cell.number_format = '#,##0'
                elif isinstance(val, str) and (val in ["Si", "No"] or "/" in val):
                    cell.alignment = center_align
                else:
                    cell.alignment = left_align

                if row_idx % 2 == 0:
                    cell.fill = zebra_fill

        ws.freeze_panes = "A2"
        if len(row_values) > 0:
            ws.auto_filter.ref = ws.dimensions

        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    wb.save(file_out)
    os.makedirs("data/excel", exist_ok=True)
    wb.save(os.path.join("data/excel", file_out))
    print(f"\n[✓] FILE UNICO EXCEL SALVATO CON SUCCESSO IN: '{file_out}' e 'data/excel/{file_out}'")


# -------------------------------------------------------------
# PIPELINE COMPLETA: SCRAPER + AGGIORNAMENTO AUTOMATICO APP
# -------------------------------------------------------------

def run_app_sync():
    """Esegue automaticamente il ricalcolo del database e la sincronizzazione con Supabase."""
    print("\n===========================================================")
    print("⚡ AGGIORNAMENTO AUTOMATICO DELL'APPLICAZIONE IN CORSO...")
    print("===========================================================")

    # 1. Ricalcolo database locale
    print("1. Ricostruzione dataset e mappatura note/profili...")
    res_rebuild = subprocess.run(["node", "scripts/rebuild-database.mjs"], capture_output=True, text=True)
    if res_rebuild.returncode != 0:
        print(f"❌ Errore in rebuild-database: {res_rebuild.stderr}")
        return False
    print(res_rebuild.stdout.strip())

    # 2. Sincronizzazione Supabase Cloud
    print("\n2. Sincronizzazione cloud PostgreSQL Supabase...")
    res_seed = subprocess.run(["node", "scripts/seed-supabase.mjs"], capture_output=True, text=True)
    if res_seed.returncode != 0:
        print(f"❌ Errore in seed-supabase: {res_seed.stderr}")
        return False
    print(res_seed.stdout.strip())

    print("\n🎉 AGGIORNAMENTO AUTOMATICO REFSTUDIO COMPLETATO!")
    print("Tutti i dati (rose, gare, classifiche) sono ora aggiornati in tempo reale sull'applicazione.")
    return True


# -------------------------------------------------------------
# MAIN: ESECUZIONE
# -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Tuttocampo Scraper automatico per RefStudio")
    parser.add_argument("--headless", action="store_true", help="Esegui il browser in modalità headless")
    parser.add_argument("--headed", action="store_true", help="Forza il browser con interfaccia visibile")
    parser.add_argument("--sync", action="store_true", help="Esegui automaticamente l'aggiornamento dell'app e Supabase dopo lo scraping")
    args = parser.parse_args()

    is_ci = os.getenv("CI", "false").lower() == "true" or os.getenv("GITHUB_ACTIONS", "false").lower() == "true"
    headless = True if (args.headless or is_ci or os.getenv("HEADLESS", "false").lower() == "true") else not args.headed

    database_totale_calciatori = []
    dati_gironi_gare_classifica = {}

    print("\n===========================================================")
    print("🚀 REFSTUDIO - TUTTOCAMPO SCRAPER AUTOMATICO")
    print(f"   Browser Headless: {headless}")
    print(f"   Credenziali: {EMAIL_TUTTOCAMPO}")
    print("===========================================================\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            extra_http_headers={
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "Upgrade-Insecure-Requests": "1"
            },
            locale="it-IT",
            timezone_id="Europe/Rome"
        )
        context.add_init_script(STEALTH_JS)
        page = context.new_page()

        effettua_login_modal(page)

        for nome_girone, url_girone in GIRONI.items():
            print(f"\n==========================================")
            print(f"--- INIZIO ELABORAZIONE {nome_girone.upper()} ---")
            print(f"==========================================")

            # 1. Estrazione Squadre del girone
            squadre = get_squadre_da_girone(page, url_girone)
            print(f" [✓] Trovate {len(squadre)} squadre per {nome_girone}.")

            # 2. Estrazione Calciatori per ogni squadra
            for sq in squadre:
                print(f"   -> Estraggo rosa per: {sq['nome']} (ID Rosa: {sq['id_rosa']})")
                giocatori = get_rosa_squadra(page, sq, nome_girone)
                print(f"      [+] Trovati {len(giocatori)} giocatori.")
                database_totale_calciatori.extend(giocatori)
                time.sleep(0.3)

            # 3. Estrazione Classifica
            print(f"\n   -> Estraggo Classifica per {nome_girone}...")
            classifica = get_classifica_girone(page, url_girone)
            print(f"      [+] Trovate {len(classifica)} righe di classifica.")

            # 4. Estrazione Gare: Formula (X*2)-2
            num_squadre = len(squadre)
            num_giornate = (num_squadre * 2) - 2 if num_squadre > 0 else 34
            print(f"\n   -> Estraggo {num_giornate} giornate di gare per {nome_girone}...")
            gare = get_gare_girone(page, url_girone, num_giornate)
            print(f"      [+] Estratte {len(gare)} gare totali.")

            dati_gironi_gare_classifica[nome_girone] = {
                "classifica": classifica,
                "gare": gare
            }

        browser.close()

    # Generazione file unico Excel protetta da errori
    print("\n------------------------------------------")
    print("Salvataggio file Excel unico in corso...")
    file_excel = "Eccellenza_Emilia_Romagna_Database_Completo.xlsx"
    
    # Se per qualsiasi motivo i calciatori estratti sono 0 (es. account non ancora attivato via email),
    # preserviamo e riutilizziamo la rosa dei calciatori già presente nel file Excel per non perderli!
    if len(database_totale_calciatori) == 0:
        print("⚠️ Nessun nuovo calciatore estratto in questa sessione (account Tuttocampo non ancora attivo).")
        if os.path.exists(file_excel):
            print("ℹ️ Preservo e recupero le rose dei calciatori già presenti nel file Excel esistente...")
            try:
                df_calciatori = pd.read_excel(file_excel, sheet_name="Calciatori")
                database_totale_calciatori = df_calciatori.fillna("").to_dict('records')
                print(f" [✓] Recuperati {len(database_totale_calciatori)} calciatori dal database precedente.")
            except Exception as err:
                print(f" ⚠️ Errore nel recupero calciatori esistenti: {err}")

    genera_excel_completo(database_totale_calciatori, dati_gironi_gare_classifica, file_excel)
    print("\n[✓] ESECUZIONE SCRAPING E SALVATAGGIO EXCEL COMPLETATI CON SUCCESSO!")

    # Se richiesto, esegue il sync automatico con il database e Supabase
    if args.sync or os.getenv("AUTO_SYNC", "false").lower() == "true":
        run_app_sync()



if __name__ == "__main__":
    main()
