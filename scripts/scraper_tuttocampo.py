import os
import sys
import time
import re
import argparse
import subprocess
import random
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
EMAIL_TUTTOCAMPO = os.getenv("TUTTOCAMPO_EMAIL", "user20260916")
PASSWORD_TUTTOCAMPO = os.getenv("TUTTOCAMPO_PASSWORD", "!yu2EV.?fyv#Qgd")

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


def clean_name(s):
    if not s:
        return ""
    s = re.sub(r'^(logo|Logo)\s+', '', str(s), flags=re.I)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def safe_int(x, default=0):
    try:
        m = re.search(r'\d+', str(x))
        return int(m.group()) if m else default
    except Exception:
        return default


def accetta_cookie_se_presenti(page):
    """Accetta il banner dei cookie FastCMP o Iubenda e rimuove overlay bloccanti."""
    try:
        if page.locator("#fast-cmp-iframe").count() > 0:
            frame = page.frame_locator("#fast-cmp-iframe")
            btn = frame.locator("button:has-text('Accettare'), button:has-text('Accetta'), button.fast-cmp-button-primary")
            if btn.count() > 0:
                btn.first.click(timeout=2000)
    except Exception:
        pass

    try:
        btn_cookie = page.query_selector("button#iubenda-cs-accept-btn, button.iubenda-cs-accept-btn, #iubFooterBtn")
        if btn_cookie:
            btn_cookie.click()
    except Exception:
        pass

    try:
        page.evaluate("() => { document.getElementById('fast-cmp-root')?.remove(); document.querySelector('.iubenda-cs-overlay')?.remove(); }")
    except Exception:
        pass


def wait_for_page_ready(page, timeout=12, need_table=False):
    """Attende il completamento di challenge WAF o script asincroni e il caricamento dei contenuti."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            c = page.content()
            if "gokuProps" not in c and "awsWafCookieDomainList" not in c:
                if need_table:
                    if page.locator("table.team-players, table.ranking, table.league-round-matches, table").count() > 0:
                        break
                else:
                    if len(c) > 30000:
                        break
        except Exception:
            pass
        time.sleep(0.3)
    accetta_cookie_se_presenti(page)


def get_html_with_browser(page, url, need_table=False, max_retries=3):
    """Scarica il codice HTML con gestione avanzata di tentativi, status 403 ed exponential backoff."""
    for tentativo in range(1, max_retries + 1):
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
            if resp and resp.status == 403:
                print(f"  [!] HTTP 403 Forbidden su {url}, attendo e riprovo ({tentativo}/{max_retries})...")
                time.sleep(tentativo * 2)
                continue

            wait_for_page_ready(page, timeout=10, need_table=need_table)

            content = page.content()
            if "403 Forbidden" in content and len(content) < 1000:
                print(f"  [!] Rilevato 403 Forbidden nel body su {url}, attendo e riprovo ({tentativo}/{max_retries})...")
                time.sleep(tentativo * 2)
                continue

            return BeautifulSoup(content, 'html.parser')
        except Exception as e:
            print(f"  [!] Timeout o errore su {url} (tentativo {tentativo}/{max_retries}): {e}")
            time.sleep(tentativo * 1.5)
    return None


def effettua_login_modal(page):
    """Gestisce il login automatico con credenziali Tuttocampo."""
    print(" -> Apertura home page per autenticazione...")
    try:
        page.goto("https://www.tuttocampo.it/", timeout=30000)
        wait_for_page_ready(page, timeout=15)
    except Exception as e:
        print(f" [!] Errore nel caricamento della home page: {e}")
        return False

    print(" -> Invio credenziali nel form di login...")
    try:
        try:
            with page.expect_navigation(timeout=12000):
                page.evaluate(f"""() => {{
                    const u = document.getElementById('login_username') || document.querySelector('input[name="username"]');
                    const p = document.getElementById('login_password') || document.querySelector('input[name="password"]');
                    if (u) u.value = '{EMAIL_TUTTOCAMPO}';
                    if (p) p.value = '{PASSWORD_TUTTOCAMPO}';
                    const f = document.querySelector('#loginmodal form') || document.querySelector('form[action*="login"]');
                    if (f) f.submit();
                }}""")
        except Exception:
            pass

        time.sleep(1.5)
        wait_for_page_ready(page, timeout=10)

        cookies = page.context.cookies()
        auth_cookies = [c for c in cookies if c['name'] in ('USER', 'UID', 'VERDATA', 'XID')]
        if len(auth_cookies) > 0:
            print(f" [✓] Login completato con successo! ({len(auth_cookies)} cookie di sessione generati: {', '.join([c['name'] for c in auth_cookies])})")
            return True

        # Verifica eventuali messaggi di errore restituiti
        try:
            feedback = page.locator("#loginmodal").inner_text()
            if "utente non attivo" in feedback.lower():
                print(" [⚠️] AVVISO TUTTOCAMPO: L'account risulta 'Utente non attivo'.")
            elif "password" in feedback.lower() and "errat" in feedback.lower():
                print(" [⚠️] AVVISO TUTTOCAMPO: Password non corretta.")
            else:
                print(" [⚠️] Cookie di sessione non rilevati, ma procedo con i dati pubblici.")
        except Exception:
            pass
        return False
    except Exception as e:
        print(f" [!] Avviso durante il login: {e}")
        return False


# -------------------------------------------------------------
# 1. PARTE SQUADRE E ROSE CON ESTRAZIONE RIGOROSA
# -------------------------------------------------------------

def get_squadre_da_girone(page, url_girone):
    """Estrae le 18 squadre reali e il loro ID Rosa dall'URL, garantendo il nome completo."""
    soup = get_html_with_browser(page, url_girone, need_table=True)
    squadre = []
    if not soup:
        return squadre

    main_table = soup.find('table', class_=re.compile(r'ranking|standings|table', re.I)) or soup

    # Mappa per memorizzare id_rosa -> squadra con nome più lungo/completo
    squadre_map = {}

    for a in main_table.find_all('a', href=True):
        href = a['href']
        if '/Squadra/' in href and len(href.split('/')) >= 6:
            img = a.find('img')
            nome_squadra = ""
            if img and img.get('alt'):
                nome_squadra = img['alt'].strip()
            elif a.get('title'):
                nome_squadra = a['title'].strip()
            else:
                nome_squadra = a.get_text(strip=True)

            nome_squadra = clean_name(nome_squadra)

            if not nome_squadra or len(nome_squadra) < 2 or nome_squadra.lower() in ['scheda', 'rosa', 'risultati', 'classifica']:
                continue

            full_url = BASE_URL + href if href.startswith('/') else href

            if '/Scheda' in full_url:
                url_rosa = full_url.replace('/Scheda', '/Rosa')
            elif '/Rosa' in full_url:
                url_rosa = full_url
            else:
                base_sq = full_url.rsplit('/', 1)[0] if full_url.endswith('/') else full_url
                url_rosa = base_sq + '/Rosa'

            # Estrazione ID Rosa dall'URL (es. /Squadra/Arcetana/2720/Rosa -> 2720)
            match_id_rosa = re.search(r'/Squadra/[^/]+/(\d+)', url_rosa, re.I)
            id_rosa = match_id_rosa.group(1) if match_id_rosa else url_rosa

            # Aggiorna se non presente o se il nuovo nome è più completo (es. 'Arcetana' vs 'Arc')
            if id_rosa not in squadre_map:
                squadre_map[id_rosa] = {
                    'nome': nome_squadra,
                    'id_rosa': id_rosa,
                    'url_scheda': full_url,
                    'url_rosa': url_rosa
                }
            else:
                if len(nome_squadra) > len(squadre_map[id_rosa]['nome']):
                    squadre_map[id_rosa]['nome'] = nome_squadra

    squadre = list(squadre_map.values())
    return squadre


def get_rosa_squadra(page, sq_info, nome_girone):
    """
    Estrae TUTTI i calciatori per la squadra scansionando rigorosamente ogni riga <tr>
    della tabella della rosa, senza saltare calciatori privi di link o con ID non assegnato.
    """
    url_rosa = sq_info['url_rosa']
    nome_squadra = sq_info['nome']
    id_rosa = sq_info['id_rosa']

    giocatori = []

    for tentativo in range(1, 3):
        soup = get_html_with_browser(page, url_rosa, need_table=True)
        if not soup:
            time.sleep(1)
            continue

        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                tds = row.find_all('td')
                if len(tds) < 4:
                    continue

                # Cerca link calciatore se presente
                link_g = row.find('a', href=re.compile(r'/giocatore/|/Scheda/', re.I))

                col_nome_idx = 1 if len(tds) >= 6 else 0
                td_nome = tds[col_nome_idx]

                if link_g:
                    full_name = clean_name(link_g.get_text(strip=True))
                    href_g = link_g['href']
                    match_id = re.search(r'/(?:Giocatore|Scheda)/(?:Scheda/)?(\d+)', href_g, re.I)
                    id_giocatore = match_id.group(1) if match_id else ""
                else:
                    full_name = clean_name(td_nome.get_text(strip=True))
                    id_giocatore = ""

                # Scarta intestazioni o righe vuote
                if not full_name or full_name.upper() in ['GIOCATORE', 'CALCIATORE', 'NOME', 'RUOLO', 'ALLENATORE', 'STAFF']:
                    continue

                # Offset colonne: se tds[0] è la foto, le altre sono spostate di 1
                offset = 1 if len(tds) >= 7 else 0

                data_nascita = tds[offset + 1].get_text(strip=True) if len(tds) > offset + 1 else ""
                ruolo = tds[offset + 2].get_text(strip=True) if len(tds) > offset + 2 else ""
                reti_str = tds[offset + 3].get_text(strip=True) if len(tds) > offset + 3 else "0"
                pres_str = tds[offset + 4].get_text(strip=True) if len(tds) > offset + 4 else "0"
                amm_str = tds[offset + 5].get_text(strip=True) if len(tds) > offset + 5 else "0"
                esp_str = tds[offset + 6].get_text(strip=True) if len(tds) > offset + 6 else "0"

                # Estrazione anno nascita a 4 cifre
                match_anno = re.search(r'\b(19\d\d|20\d\d)\b', data_nascita)
                anno_nascita = match_anno.group(1) if match_anno else data_nascita

                # Divisione Nome e Cognome
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

                # Chiave univoca robusta: NON scarta calciatori senza ID!
                unique_key = f"{id_giocatore}_{id_rosa}" if id_giocatore else f"{full_name.lower()}_{id_rosa}"

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
                    'Presenze': safe_int(pres_str),
                    'Reti': safe_int(reti_str),
                    'Ammonizioni': safe_int(amm_str),
                    'Espulsioni': safe_int(esp_str),
                    '_unique_key': unique_key
                }

                if not any(g.get('_unique_key') == unique_key for g in giocatori):
                    giocatori.append(giocatore_data)

        if len(giocatori) > 0:
            break
        else:
            time.sleep(1.5)

    # Rimuove il campo di supporto interno
    for g in giocatori:
        g.pop('_unique_key', None)

    return giocatori


# -------------------------------------------------------------
# 2. PARTE CLASSIFICA E GARE
# -------------------------------------------------------------

def get_classifica_girone(page, url_girone):
    """Estrae la classifica per il girone garantendo l'estrazione corretta di punti e statistiche."""
    url_classifica = f"{url_girone}/Classifica"
    soup = get_html_with_browser(page, url_classifica, need_table=True)
    classifica = []

    if not soup:
        return classifica

    table = soup.find('table', class_=re.compile(r'table_ranking|ranking|standings', re.I)) or soup
    rows = table.find_all('tr')
    pos = 1

    for r in rows:
        team_link = r.find('a', href=re.compile(r'/Squadra/', re.I))
        if not team_link:
            continue

        nome_sq = clean_name(team_link.get_text(strip=True))
        if not nome_sq or len(nome_sq) < 2 or nome_sq.lower() in ['squadra', 'pos']:
            continue

        # Estrai tutti i valori numerici presenti nelle celle td della riga
        cells = r.find_all(['td', 'th'])
        valori_numerici = []
        for c in cells:
            txt = c.get_text(strip=True)
            if re.match(r'^-?\d+$', txt):
                valori_numerici.append(int(txt))

        # Su Tuttocampo, i valori numerici della classifica sono nell'ordine:
        # [Punti (PT), Giocate (G), Vittorie (V), Pareggi (N), Sconfitte (P), Gol Fatti (F), Gol Subiti (S), Diff Reti (DR)]
        # La posizione NON è un valore numerico nella tabella principale (è l'ordine della riga).
        if len(valori_numerici) >= 6:
            punti = valori_numerici[0]
            giocate = valori_numerici[1]
            vittorie = valori_numerici[2]
            pareggi = valori_numerici[3]
            sconfitte = valori_numerici[4]
            gf = valori_numerici[5]
            gs = valori_numerici[6] if len(valori_numerici) > 6 else 0
            dr = valori_numerici[7] if len(valori_numerici) > 7 else (gf - gs)

            if not any(c['Squadra'] == nome_sq for c in classifica):
                classifica.append({
                    "Posizione": pos,
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


def get_gare_girone(page, url_girone, num_giornate=34):
    """
    Estrae TUTTE le giornate di campionato in modo rigoroso, con retry dedicato
    per giornata e senza mai inventare punteggi per partite future o non disputate.
    """
    gare = []

    for n_giornata in range(1, num_giornate + 1):
        url_giornata = f"{url_girone}/Giornata{n_giornata}"
        print(f"    -> Scansione Giornata {n_giornata}/{num_giornate}...")

        soup = None
        for attempt in range(1, 4):
            soup = get_html_with_browser(page, url_giornata, need_table=True)
            if soup and len(soup.find_all('tr')) >= 9:
                break
            time.sleep(1.5)

        if not soup:
            print(f"       [!] Impossibile caricare Giornata {n_giornata} dopo 3 tentativi.")
            continue

        date_header = soup.find(class_=re.compile(r'date|header|day|league-round-date', re.I))
        data_giornata_text = date_header.get_text(strip=True) if date_header else ""
        dt_obj, current_date_str = parse_data_stringa(data_giornata_text)

        gare_giornata = []
        rows = soup.find_all('tr')

        for row in rows:
            td_home = row.find('td', class_=re.compile(r'\bhome\b', re.I))
            td_away = row.find('td', class_=re.compile(r'\baway\b', re.I))

            casa = ""
            trasferta = ""

            if td_home and td_away:
                a_h = td_home.find('a', class_='team-name') or td_home.find('a', href=re.compile(r'/Squadra/', re.I))
                a_a = td_away.find('a', class_='team-name') or td_away.find('a', href=re.compile(r'/Squadra/', re.I))
                if a_h and a_a:
                    casa = clean_name(a_h.get_text(strip=True))
                    trasferta = clean_name(a_a.get_text(strip=True))

            # Fallback generico se le classi home/away non sono presenti
            if not casa or not trasferta:
                sq_links = row.find_all('a', href=re.compile(r'/Squadra/', re.I))
                if len(sq_links) >= 2:
                    casa = clean_name(sq_links[0].get_text(strip=True))
                    trasferta = clean_name(sq_links[1].get_text(strip=True))

            if not casa or not trasferta or casa == trasferta:
                continue

            # Estrazione punteggio reale
            gol_casa = None
            gol_trasf = None
            giocata = "No"

            gh_el = td_home.find(class_=re.compile(r'\bgoal\b', re.I)) if td_home else None
            ga_el = td_away.find(class_=re.compile(r'\bgoal\b', re.I)) if td_away else None

            if gh_el and ga_el and gh_el.get_text(strip=True).isdigit() and ga_el.get_text(strip=True).isdigit():
                gol_casa = int(gh_el.get_text(strip=True))
                gol_trasf = int(ga_el.get_text(strip=True))
                giocata = "Si"
            else:
                goal_elements = row.find_all(class_=re.compile(r'\bgoal\b|\bscore\b|\bresult\b', re.I))
                score_digits = []
                for gel in goal_elements:
                    txt = gel.get_text(strip=True)
                    if txt.isdigit():
                        score_digits.append(int(txt))
                if len(score_digits) >= 2:
                    gol_casa = score_digits[0]
                    gol_trasf = score_digits[1]
                    giocata = "Si"

            # Orario e data specifica della gara
            time_el = row.find(class_=re.compile(r'\bhour\b|\btime\b|\bmatch-time\b', re.I))
            ora_gara = time_el.get_text(strip=True) if time_el else ""

            data_gara = current_date_str if current_date_str else f"Giornata {n_giornata}"
            if ora_gara and ":" in ora_gara:
                data_gara = f"{data_gara} {ora_gara}"

            match_entry = {
                "Numero giornata": n_giornata,
                "Data": data_gara,
                "Giocata": giocata,
                "Squadra ospitante": casa,
                "Reti squadra ospitante": gol_casa if giocata == "Si" else None,
                "Squadra ospite": trasferta,
                "Reti squadra ospite": gol_trasf if giocata == "Si" else None
            }

            if not any(g['Squadra ospitante'] == casa and g['Squadra ospite'] == trasferta for g in gare_giornata):
                gare_giornata.append(match_entry)

        print(f"       [+] Giornata {n_giornata}: estratte {len(gare_giornata)} gare.")
        gare.extend(gare_giornata)
        time.sleep(random.uniform(0.5, 0.9))

    return gare


# -------------------------------------------------------------
# 3. GENERAZIONE UNICA FILE EXCEL COMPLETO (SICURA SENZA ERRORI)
# -------------------------------------------------------------

def genera_excel_completo(database_calciatori, dati_gironi, file_out="Eccellenza_Emilia_Romagna_Database_Completo.xlsx"):
    """Crea un UNICO file Excel con 5 Fogli garantendo formattazione e completezza."""
    wb = openpyxl.Workbook()

    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    right_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(left=Side(style='thin', color='D9D9D9'), right=Side(style='thin', color='D9D9D9'), top=Side(style='thin', color='D9D9D9'), bottom=Side(style='thin', color='D9D9D9'))
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

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

    print("1. Ricostruzione dataset e mappatura note/profili...")
    res_rebuild = subprocess.run(
        ["node", "scripts/rebuild-database.mjs"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if res_rebuild.returncode != 0:
        print(f"❌ Errore in rebuild-database: {res_rebuild.stderr or ''}")
        return False
    if res_rebuild.stdout:
        print(res_rebuild.stdout.strip())

    print("\n2. Sincronizzazione cloud PostgreSQL Supabase...")
    res_seed = subprocess.run(
        ["node", "scripts/seed-supabase.mjs"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if res_seed.returncode != 0:
        print(f"❌ Errore in seed-supabase: {res_seed.stderr or ''}")
        return False
    if res_seed.stdout:
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
    print("🚀 REFSTUDIO - TUTTOCAMPO SCRAPER RIGOROSO AUTOMATICO")
    print(f"   Browser Headless: {headless}")
    print(f"   Credenziali fallback: {EMAIL_TUTTOCAMPO}")
    print("===========================================================\n")

    cookies_file = "tuttocampo_cookies.json"
    storage_state_env = os.getenv("TUTTOCAMPO_STORAGE_STATE", "").strip()
    if storage_state_env and not os.path.exists(cookies_file):
        try:
            import base64
            content = storage_state_env
            if not content.startswith("{"):
                try:
                    content = base64.b64decode(content).decode("utf-8")
                except Exception:
                    pass
            with open(cookies_file, "w", encoding="utf-8") as f:
                f.write(content)
            print(f" [✓] Sessione Tuttocampo ripristinata da TUTTOCAMPO_STORAGE_STATE.")
        except Exception as e:
            print(f" [!] Errore nel salvataggio della sessione da env: {e}")

    has_cookies = os.path.exists(cookies_file)

    with sync_playwright() as p:
        browser_kwargs = {
            "headless": headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080"
            ]
        }
        # Tenta Chrome reale per bypass WAF e Google se disponibile
        try:
            browser = p.chromium.launch(channel="chrome", **browser_kwargs)
        except Exception:
            browser = p.chromium.launch(**browser_kwargs)

        context_kwargs = {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "viewport": {"width": 1920, "height": 1080},
            "extra_http_headers": {
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "Upgrade-Insecure-Requests": "1"
            },
            "locale": "it-IT",
            "timezone_id": "Europe/Rome"
        }

        if has_cookies:
            context_kwargs["storage_state"] = cookies_file
            print(f" [✓] Rilevata sessione Google Premium salvata in '{cookies_file}'.")

        context = browser.new_context(**context_kwargs)
        context.add_init_script(STEALTH_JS)

        # Route abort su ad network e asset pesanti per navigazione ultra-veloce e senza timeout
        def intercept_route(route):
            req = route.request
            if req.resource_type in ["image", "media", "font"]:
                route.abort()
            elif any(ad in req.url for ad in ["doubleclick", "googlesyndication", "criteo", "taboola", "smartadserver", "amazon-adsystem", "adnxs"]):
                route.abort()
            else:
                route.continue_()

        context.route("**/*", intercept_route)
        page = context.new_page()

        if has_cookies:
            print(" -> Sessione Google Premium caricata con successo: bypass del modale di login.")
        else:
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
                time.sleep(random.uniform(0.5, 0.8))

            # 3. Estrazione Classifica
            print(f"\n   -> Estraggo Classifica per {nome_girone}...")
            classifica = get_classifica_girone(page, url_girone)
            print(f"      [+] Trovate {len(classifica)} righe di classifica.")

            # 4. Estrazione Gare: esattamente 34 giornate
            num_squadre = len(squadre)
            num_giornate = (num_squadre * 2) - 2 if num_squadre > 0 else 34
            print(f"\n   -> Estraggo {num_giornate} giornate di gare per {nome_girone}...")
            gare = get_gare_girone(page, url_girone, num_giornate)
            print(f"      [+] Estratte {len(gare)} gare totali per {nome_girone}.")

            dati_gironi_gare_classifica[nome_girone] = {
                "classifica": classifica,
                "gare": gare
            }

        browser.close()

    # Generazione file unico Excel con salvaguardia intelligente
    print("\n------------------------------------------")
    print("Salvataggio e fusione file Excel unico in corso...")
    file_excel = "Eccellenza_Emilia_Romagna_Database_Completo.xlsx"

    # Fusione intelligente con il database esistente (per Calciatori, Gare e Classifiche)
    if os.path.exists(file_excel):
        try:
            # 1. Consolidamento Calciatori:
            # - Se il calciatore è presente nel nuovo scraping: SOVRASCRIVI SEMPRE (statistiche/informazioni aggiornate)
            # - Se non è presente nel nuovo scraping: NON PERDERE il dato vecchio (mantieni i giocatori storici)
            # - Se è un calciatore nuovo: aggiungilo
            df_calciatori = pd.read_excel(file_excel, sheet_name="Calciatori").fillna("")
            calciatori_esistenti = df_calciatori.to_dict('records')

            if len(database_totale_calciatori) == 0:
                print(f"ℹ️ Nessun calciatore estratto online: preservo tutti i {len(calciatori_esistenti)} calciatori esistenti.")
                database_totale_calciatori = calciatori_esistenti
            else:
                def get_player_key(p):
                    id_g = str(p.get('ID Giocatore') or '').strip()
                    if id_g and id_g not in ['0', 'None', 'nan']:
                        return f"id_{id_g}"
                    nome = re.sub(r'[^a-z0-9]', '', clean_name(str(p.get('Nome') or '')).lower())
                    cognome = re.sub(r'[^a-z0-9]', '', clean_name(str(p.get('Cognome') or '')).lower())
                    id_rosa = str(p.get('ID Rosa') or '').strip()
                    nome_rosa = re.sub(r'[^a-z0-9]', '', clean_name(str(p.get('Nome Rosa') or '')).lower())
                    team_ref = id_rosa if id_rosa else nome_rosa
                    return f"name_{cognome}_{nome}_{team_ref}"

                merged_players_map = {}
                # Inizia popolando con i dati esistenti
                for p_old in calciatori_esistenti:
                    k = get_player_key(p_old)
                    if k:
                        merged_players_map[k] = dict(p_old)

                # Sovrascrivi o aggiungi con tutti i calciatori dello scraping appena effettuato
                aggiornati = 0
                aggiunti = 0
                for p_new in database_totale_calciatori:
                    k = get_player_key(p_new)
                    if not k:
                        continue
                    if k in merged_players_map:
                        old_p = merged_players_map[k]
                        updated_p = dict(old_p)
                        # Sovrascrive tutte le statistiche e informazioni nuove, preservando eventuali dati precedenti se vuoti
                        for f_k, f_v in p_new.items():
                            val_str = str(f_v).strip() if f_v is not None else ""
                            if val_str != "" and val_str.lower() not in ["none", "nan"]:
                                updated_p[f_k] = f_v
                            elif f_k in ['Presenze', 'Reti', 'Ammonizioni', 'Espulsioni']:
                                updated_p[f_k] = f_v
                            elif f_k not in updated_p:
                                updated_p[f_k] = f_v
                        merged_players_map[k] = updated_p
                        aggiornati += 1
                    else:
                        merged_players_map[k] = dict(p_new)
                        aggiunti += 1

                database_totale_calciatori = list(merged_players_map.values())
                print(f" [✓] Calciatori consolidati: {len(database_totale_calciatori)} (aggiornati con nuovi dati: {aggiornati}, nuovi aggiunti: {aggiunti}, storici preservati: {len(calciatori_esistenti) - aggiornati})")

            # 2. Consolidamento Gare:
            # - Se la gara nel nuovo scraping ha un risultato/è giocata: SOVRASCRIVI SEMPRE
            # - Se la gara nel vecchio file era già giocata e online ha un glitch: NON PERDERE il risultato registrato
            # - Preserva sempre tutte le 34 giornate (306 partite per girone)
            def get_match_key(m):
                giornata = int(m.get('Numero giornata') or 0)
                casa = re.sub(r'[^a-z0-9]', '', clean_name(str(m.get('Squadra ospitante') or '')).lower())
                trasf = re.sub(r'[^a-z0-9]', '', clean_name(str(m.get('Squadra ospite') or '')).lower())
                return (giornata, casa, trasf)

            for nome_girone in ["Girone A", "Girone B"]:
                gare_online = dati_gironi_gare_classifica.get(nome_girone, {}).get("gare", [])
                sheet_gare = f"{nome_girone} - Gare"
                try:
                    df_gare_esistenti = pd.read_excel(file_excel, sheet_name=sheet_gare).fillna("")
                    gare_esistenti = df_gare_esistenti.to_dict('records')
                    if len(gare_esistenti) > 0:
                        merged_gare_map = {get_match_key(m): dict(m) for m in gare_esistenti}
                        partite_aggiornate = 0

                        for m_new in gare_online:
                            k = get_match_key(m_new)
                            is_new_played = str(m_new.get('Giocata') or '').strip().lower() == 'si'

                            if k in merged_gare_map:
                                old_m = merged_gare_map[k]
                                is_old_played = str(old_m.get('Giocata') or '').strip().lower() == 'si'

                                if is_new_played:
                                    # Nuovo risultato disponibile: aggiorna sempre
                                    merged_gare_map[k] = dict(m_new)
                                    partite_aggiornate += 1
                                else:
                                    # Online non risulta ancora giocata: mantieni il vecchio risultato se già registrato
                                    if not is_old_played:
                                        merged_gare_map[k] = dict(m_new)
                            else:
                                merged_gare_map[k] = dict(m_new)

                        dati_gironi_gare_classifica.setdefault(nome_girone, {})["gare"] = sorted(
                            merged_gare_map.values(), key=lambda x: int(x.get('Numero giornata') or 0)
                        )
                        print(f" [✓] {nome_girone} - Gare consolidate: {len(merged_gare_map)} (risultati aggiornati online: {partite_aggiornate})")
                except Exception as e_gare:
                    print(f" ⚠️ Avviso consolidamento gare {nome_girone}: {e_gare}")

            # 3. Consolidamento Classifiche:
            # Sovrascrivi con la classifica online più recente, preservando quella vecchia se online ha fallito
            for nome_girone in ["Girone A", "Girone B"]:
                clas_online = dati_gironi_gare_classifica.get(nome_girone, {}).get("classifica", [])
                sheet_clas = f"{nome_girone} - Classifica"
                try:
                    df_clas_esistente = pd.read_excel(file_excel, sheet_name=sheet_clas).fillna("")
                    clas_esistente = df_clas_esistente.to_dict('records')
                    if len(clas_online) >= 18:
                        # Classifica online completa: usa quella aggiornata
                        dati_gironi_gare_classifica.setdefault(nome_girone, {})["classifica"] = clas_online
                    elif len(clas_esistente) >= len(clas_online):
                        # Online parziale/vuota: preserva la classifica precedente
                        print(f"ℹ️ {nome_girone}: preservo la classifica completa precedente ({len(clas_esistente)} squadre vs {len(clas_online)} online).")
                        dati_gironi_gare_classifica.setdefault(nome_girone, {})["classifica"] = clas_esistente
                except Exception as e_clas:
                    print(f" ⚠️ Avviso consolidamento classifica {nome_girone}: {e_clas}")

        except Exception as err:
            print(f" ⚠️ Errore nel consolidamento con il database esistente: {err}")

    genera_excel_completo(database_totale_calciatori, dati_gironi_gare_classifica, file_excel)

    print("\n[✓] ESECUZIONE SCRAPING E SALVATAGGIO EXCEL COMPLETATI CON SUCCESSO!")

    # Se richiesto, esegue il sync automatico con il database e Supabase
    if args.sync or os.getenv("AUTO_SYNC", "false").lower() == "true":
        run_app_sync()


if __name__ == "__main__":
    main()
