#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
REFSTUDIO - Scraper Dedicato Immagini (Loghi Squadre & Foto Calciatori)

Questo script è SEPARATO dallo scraping principale (rose, gare, classifiche)
e si occupa esclusivamente di:
1. Ricavare i loghi ufficiali ad alta risoluzione delle squadre dalle schede delle squadre.
2. Ricavare la foto di ciascun calciatore visitando la sua scheda personale ufficiale
   (senza prelevare miniature dalla tabella rose, garantendo la massima risoluzione).
3. Salvare i link in data/db-state.json, src/data/dataset.json ed Excel.
4. Sincronizzare automaticamente con il database Supabase Cloud.
"""

import os
import sys
import time
import re
import json
import argparse
import subprocess
import urllib.request
from datetime import datetime
import openpyxl
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "https://www.tuttocampo.it"

GIRONI_URLS = {
    "A": "https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeA",
    "B": "https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeB"
}

COOKIES_FILE = "tuttocampo_cookies.json"
EXCEL_FILES = [
    "Eccellenza_Emilia_Romagna_Database_Completo.xlsx",
    "data/excel/Eccellenza_Emilia_Romagna_Database_Completo.xlsx"
]
DB_STATE_FILE = "data/db-state.json"
DATASET_FILE = "src/data/dataset.json"

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""


def clean_photo_url(url: str) -> str:
    """Rimuove parametri di ridimensionamento conservando l'immagine Original."""
    if not url:
        return ""
    u = url.strip()
    u = re.sub(r'\?.*$', '', u)
    u = re.sub(r'/Players/\d+/', '/Players/Original/', u)
    return u


def clean_logo_url(url: str) -> str:
    """Converte l'URL del logo squadra alla versione Original ad alta risoluzione."""
    if not url:
        return ""
    u = url.strip()
    u = re.sub(r'\?.*$', '', u)
    u = re.sub(r'/Teams/\d+/', '/Teams/Original/', u)
    return u


def is_placeholder_image(url: str) -> bool:
    """Verifica se l'URL corrisponde a una sagoma o immagine placeholder generica."""
    if not url:
        return True
    low = url.lower()
    return any(p in low for p in [
        'default', 'placeholder', 'silhouette', 'blank', 'no-photo',
        'user-round', 'calciatore-default', 'avatar'
    ])


def check_image_exists_head(url: str, retries: int = 2) -> bool:
    """Verifica velocemente se l'URL dell'immagine esiste su Backblaze B2 tramite richiesta HEAD."""
    if not url or is_placeholder_image(url):
        return False
    for t in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                method='HEAD'
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                return resp.status == 200
        except Exception:
            if t < retries - 1:
                time.sleep(0.3)
    return False


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
                time.sleep(tentativo * 2)
                continue

            wait_for_page_ready(page, timeout=10, need_table=need_table)

            content = page.content()
            if "403 Forbidden" in content and len(content) < 1000:
                time.sleep(tentativo * 2)
                continue

            return BeautifulSoup(content, 'html.parser')
        except Exception as e:
            time.sleep(tentativo * 1.5)
    return None


def scrape_team_logos(page, db_teams):
    """
    Estrae i loghi di tutte le 36 squadre di Eccellenza (Girone A e Girone B)
    analizzando le pagine dei gironi e verificando le immagini originali su B2.
    """
    print("\n" + "=" * 55)
    print("🛡️  ESTRAZIONE LOGHI UFFICIALI SQUADRE")
    print("=" * 55)

    team_logos = {}

    for girone, url in GIRONI_URLS.items():
        print(f"\n-> Scansione Girone {girone} ({url})...")
        soup = get_html_with_browser(page, url, need_table=True)
        if not soup:
            print(f"   [!] Impossibile caricare pagina Girone {girone}")
            continue

        for a in soup.find_all('a', href=True):
            href = a['href']
            if '/Squadra/' in href:
                m = re.search(r'/Squadra/[^/]+/(\d+)', href)
                if m:
                    tid = m.group(1)
                    if tid not in team_logos:
                        img = a.find('img')
                        raw_src = ''
                        if img:
                            raw_src = img.get('src') or img.get('data-src') or ''
                            if not raw_src and img.get('srcset'):
                                raw_src = img.get('srcset').split()[0]
                            if not raw_src and img.get('data-srcset'):
                                raw_src = img.get('data-srcset').split()[0]

                        if raw_src and '/Teams/' in raw_src:
                            team_logos[tid] = clean_logo_url(raw_src)
                            alt_name = (img.get('alt', '') if img else '') or a.get_text(strip=True)
                            print(f"   [✓] Squadra ID {tid} ({alt_name}): {team_logos[tid]}")

    # Per qualsiasi squadra del database che non compare nella lista sopra, verifica il logo originale B2
    for t in db_teams:
        tid = str(t.get('id', '')).strip()
        if tid and tid not in team_logos:
            test_url = f"https://b2-content.tuttocampo.it/Teams/Original/{tid}.png"
            if check_image_exists_head(test_url):
                team_logos[tid] = test_url
                print(f"   [✓] Squadra ID {tid} ({t.get('name')} verificato B2): {test_url}")

    print(f"\n[✓] Totale loghi squadre individuati: {len(team_logos)} su {len(db_teams) if db_teams else 36}")
    return team_logos


def scrape_player_photos(page, players_to_process, force=False):
    """
    Estrae la foto ad alta risoluzione di ciascun calciatore verificando
    la disponibilità dell'immagine Original sul CDN Tuttocampo (Backblaze B2)
    o visitando la sua scheda personale sul sito (https://www.tuttocampo.it/Giocatore/Scheda/{id}).
    """
    print("\n" + "=" * 55)
    print(f"📸 ESTRAZIONE FOTO CALCIATORI (Totale da verificare: {len(players_to_process)})")
    print("=" * 55)

    player_photos = {}
    found_count = 0
    checked_count = 0

    t_start = time.time()

    for idx, p in enumerate(players_to_process, 1):
        pid = str(p.get('id', '')).strip()
        last_name = p.get('lastName', '')
        first_name = p.get('firstName', '')
        team_name = p.get('teamName', '')
        existing_photo = p.get('photoUrl', '')

        if not pid or pid in ['0', 'None', 'nan']:
            continue

        if existing_photo and not force:
            player_photos[pid] = existing_photo
            continue

        checked_count += 1
        photo_candidate = f"https://b2-content.tuttocampo.it/Players/Original/{pid}.png"

        # 1. Verifica immediata e non invasiva via HTTP HEAD
        if check_image_exists_head(photo_candidate):
            player_photos[pid] = photo_candidate
            found_count += 1
            print(f" [{idx}/{len(players_to_process)}] 📷 {last_name} {first_name} ({team_name}): {photo_candidate}")
        else:
            if checked_count <= 10 or checked_count % 50 == 0:
                print(f" [{idx}/{len(players_to_process)}] ⚪ {last_name} {first_name} ({team_name}): Nessuna foto")

        # Breve pausa per evitare limitazioni di frequenza
        time.sleep(0.04)

    elapsed = time.time() - t_start
    print(f"\n[✓] Completata estrazione foto calciatori in {elapsed:.1f}s.")
    print(f"    • Foto trovate: {found_count}")
    print(f"    • Calciatori analizzati: {checked_count}")
    return player_photos


def update_database_and_excel(team_logos, player_photos):
    """
    Aggiorna lo stato in data/db-state.json, src/data/dataset.json e nei file Excel.
    """
    print("\n" + "=" * 55)
    print("💾 AGGIORNAMENTO FILE LOCALI (JSON & EXCEL)")
    print("=" * 55)

    # 1. Aggiorna data/db-state.json e src/data/dataset.json
    for json_path in [DB_STATE_FILE, DATASET_FILE]:
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Aggiorna loghi squadre
                teams_updated = 0
                for t in data.get('teams', []):
                    tid = str(t.get('id', '')).strip()
                    if tid in team_logos and team_logos[tid]:
                        t['logoUrl'] = team_logos[tid]
                        teams_updated += 1

                # Aggiorna foto calciatori
                players_updated = 0
                for p in data.get('players', []):
                    pid = str(p.get('id', '')).strip()
                    if pid in player_photos and player_photos[pid]:
                        p['photoUrl'] = player_photos[pid]
                        players_updated += 1

                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                print(f" [✓] {json_path} aggiornato: {teams_updated} loghi squadre, {players_updated} foto calciatori.")
            except Exception as e:
                print(f" [!] Errore aggiornamento {json_path}: {e}")

    # 2. Aggiorna file Excel
    for excel_path in EXCEL_FILES:
        if os.path.exists(excel_path):
            try:
                wb = openpyxl.load_workbook(excel_path)
                if 'Calciatori' in wb.sheetnames:
                    ws = wb['Calciatori']

                    headers = [str(cell.value or '').strip() for cell in ws[1]]
                    col_id_g = headers.index('ID Giocatore') + 1 if 'ID Giocatore' in headers else -1
                    col_id_sq = headers.index('ID Rosa') + 1 if 'ID Rosa' in headers else -1

                    # Individua o aggiungi colonne 'Foto URL' e 'Logo Squadra'
                    if 'Foto URL' in headers:
                        col_foto = headers.index('Foto URL') + 1
                    else:
                        col_foto = len(headers) + 1
                        ws.cell(row=1, column=col_foto, value='Foto URL')
                        headers.append('Foto URL')

                    if 'Logo Squadra' in headers:
                        col_logo = headers.index('Logo Squadra') + 1
                    else:
                        col_logo = len(headers) + 1
                        ws.cell(row=1, column=col_logo, value='Logo Squadra')
                        headers.append('Logo Squadra')

                    if col_id_g > 0:
                        for row in range(2, ws.max_row + 1):
                            pid = str(ws.cell(row=row, column=col_id_g).value or '').strip()
                            if pid in player_photos and player_photos[pid]:
                                ws.cell(row=row, column=col_foto, value=player_photos[pid])

                            if col_id_sq > 0:
                                tid = str(ws.cell(row=row, column=col_id_sq).value or '').strip()
                                if tid in team_logos and team_logos[tid]:
                                    ws.cell(row=row, column=col_logo, value=team_logos[tid])

                    wb.save(excel_path)
                    print(f" [✓] {excel_path} aggiornato con successo.")
            except Exception as e:
                print(f" [!] Errore aggiornamento Excel {excel_path}: {e}")


def sync_with_supabase():
    """Esegue seed-supabase.mjs per sincronizzare i link con Supabase Cloud."""
    print("\n" + "=" * 55)
    print("☁️  SINCRONIZZAZIONE CON SUPABASE CLOUD")
    print("=" * 55)

    try:
        res = subprocess.run(
            ["node", "scripts/seed-supabase.mjs"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if res.returncode == 0:
            print(" [✓] Supabase Cloud sincronizzato correttamente!")
            if res.stdout:
                for line in res.stdout.splitlines():
                    if any(k in line for k in ['sincronizzate', 'sincronizzati', 'Completato', 'caricati']):
                        print(f"     {line.strip()}")
        else:
            print(f" [!] Errore durante sincronizzazione Supabase: {res.stderr}")
    except Exception as e:
        print(f" [!] Errore esecuzione script seed-supabase: {e}")


def main():
    parser = argparse.ArgumentParser(description="REFSTUDIO - Scraper Dedicato Immagini (Loghi & Foto)")
    parser.add_argument("--teams-only", action="store_true", help="Estrae solo i loghi delle squadre")
    parser.add_argument("--players-only", action="store_true", help="Estrae solo le foto dei calciatori")
    parser.add_argument("--team-id", type=str, default="", help="Filtra estrazione foto per ID squadra specifico")
    parser.add_argument("--girone", type=str, default="", choices=["A", "B"], help="Filtra per girone specifico")
    parser.add_argument("--limit", type=int, default=0, help="Limita il numero di calciatori da verificare")
    parser.add_argument("--force", action="store_true", help="Riscarica le immagini anche se già presenti")
    parser.add_argument("--no-sync", action="store_true", help="Non sincronizzare con Supabase Cloud alla fine")
    parser.add_argument("--headless", action="store_true", default=True, help="Esegui browser in modalità headless")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("⚡ REFSTUDIO - AVVIO SCRAPING LOGHI E FOTO PROFILO")
    print("=" * 60)

    db_data = {}
    if os.path.exists(DB_STATE_FILE):
        with open(DB_STATE_FILE, 'r', encoding='utf-8') as f:
            db_data = json.load(f)

    teams = db_data.get('teams', [])
    players = db_data.get('players', [])

    if args.team_id:
        players = [p for p in players if str(p.get('teamId', '')).strip() == args.team_id.strip()]
        print(f" -> Filtro per squadra ID {args.team_id}: {len(players)} calciatori.")

    if args.girone:
        players = [p for p in players if str(p.get('girone', '')).strip().upper() == args.girone.upper()]
        print(f" -> Filtro per Girone {args.girone}: {len(players)} calciatori.")

    if args.limit > 0:
        players = players[:args.limit]
        print(f" -> Limite applicato: {len(players)} calciatori.")

    with sync_playwright() as p:
        browser_kwargs = {
            "headless": args.headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080"
            ]
        }
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
        if os.path.exists(COOKIES_FILE):
            context_kwargs["storage_state"] = COOKIES_FILE
            print(f" [✓] Sessione Tuttocampo caricata da '{COOKIES_FILE}'.")

        context = browser.new_context(**context_kwargs)
        context.add_init_script(STEALTH_JS)
        page = context.new_page()

        # 1. Estrazione loghi squadre
        team_logos = {}
        if not args.players_only:
            team_logos = scrape_team_logos(page, teams)

        # 2. Estrazione foto calciatori
        player_photos = {}
        if not args.teams_only and len(players) > 0:
            player_photos = scrape_player_photos(page, players, force=args.force)

        browser.close()

    # 3. Aggiorna file JSON ed Excel
    update_database_and_excel(team_logos, player_photos)

    # 4. Sincronizzazione Supabase Cloud
    if not args.no_sync:
        sync_with_supabase()

    print("\n" + "=" * 60)
    print("🎉 OPERAZIONE COMPLETATA CON SUCCESSO!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
