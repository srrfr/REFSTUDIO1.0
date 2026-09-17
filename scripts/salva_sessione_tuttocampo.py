import os
import sys
import time
import json
import argparse
from playwright.sync_api import sync_playwright

# Forza l'output console in UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

COOKIES_FILE = "tuttocampo_cookies.json"
COOKIE_INPUT_FILE = "cookie_input.txt"

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""


def parse_cookie_input(raw_input: str) -> dict:
    """
    Converte qualsiasi formato di cookie in un oggetto compatibile con Playwright storage_state:
    - Stringa intestazione HTTP: "PHPSESSID=abc; USER=xyz; UID=123"
    - JSON da Cookie-Editor / estensioni: [{"name": "USER", "value": "..."}, ...]
    - JSON storage_state nativo di Playwright: {"cookies": [...], "origins": [...]}
    """
    raw = raw_input.strip()
    # Se è racchiuso tra virgolette, le rimuove
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1].strip()

    # Formato storage_state nativo
    if raw.startswith('{') and '"cookies"' in raw:
        return json.loads(raw)

    # Formato array da estensioni (es. Cookie-Editor)
    if raw.startswith('['):
        data = json.loads(raw)
        cookies = []
        for c in data:
            cookies.append({
                "name": c.get("name"),
                "value": c.get("value"),
                "domain": c.get("domain", ".tuttocampo.it"),
                "path": c.get("path", "/"),
                "expires": c.get("expirationDate", -1),
                "httpOnly": c.get("httpOnly", False),
                "secure": c.get("secure", False),
                "sameSite": "Lax"
            })
        return {"cookies": cookies, "origins": []}

    # Formato stringa HTTP Header "nome1=val1; nome2=val2"
    cookies = []
    # Rimuove prefisso eventuale 'Cookie: '
    if raw.lower().startswith("cookie:"):
        raw = raw[7:].strip()

    for item in raw.split(";"):
        item = item.strip()
        if not item or "=" not in item:
            continue
        k, v = item.split("=", 1)
        cookies.append({
            "name": k.strip(),
            "value": v.strip(),
            "domain": ".tuttocampo.it",
            "path": "/",
            "expires": -1,
            "httpOnly": False,
            "secure": False,
            "sameSite": "Lax"
        })

    return {"cookies": cookies, "origins": []}


def verifica_sessione(cookies_file):
    """Verifica che la sessione funzioni aprendo una pagina di rosa protetta."""
    print("\n -> Test di verifica accesso su una pagina squadra protetta...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        context = browser.new_context(
            storage_state=cookies_file,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="it-IT"
        )
        context.add_init_script(STEALTH_JS)
        page = context.new_page()

        try:
            page.goto("https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeA/Squadra/Arcetana/2720/Rosa", timeout=30000)
            time.sleep(3)
            content = page.content()
            if "visibile solo agli utenti loggati" in content.lower():
                print(" [⚠️] ATTENZIONE: La pagina mostra ancora 'visibile solo agli utenti loggati'.")
                print("      Verifica di aver copiato tutti i cookie di sessione (PHPSESSID, USER, UID).")
                browser.close()
                return False
            else:
                print(" [🎉] SUCCESSO CONFERMATO! La pagina della rosa è sbloccata e visibile!")
                browser.close()
                return True
        except Exception as e:
            print(f" [!] Errore durante il test di verifica: {e}")
            browser.close()
            return False


def login_tramite_firefox():
    """Tenta il login interattivo con Firefox (non bloccato dalle protezioni CDP di Google)."""
    print("\n -> Apertura finestra di Mozilla Firefox...")
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=False)
        context = browser.new_context(locale="it-IT")
        page = context.new_page()

        page.goto("https://www.tuttocampo.it/", timeout=45000)

        print("\n" + "-" * 65)
        print("👉 EFFETTUA ORA L'ACCESSO CON GOOGLE NELLA FINESTRA DI FIREFOX.")
        print("Quando hai completato l'accesso, torna qui sul terminale e PREMI INVIO.")
        print("-" * 65 + "\n")

        try:
            input("Premi INVIO dopo aver effettuato il login con Google...")
        except Exception:
            pass

        context.storage_state(path=COOKIES_FILE)
        browser.close()

    return True


def main():
    parser = argparse.ArgumentParser(description="Salvataggio sessione Tuttocampo")
    parser.add_argument("--firefox", action="store_true", help="Usa Firefox per il login interattivo")
    parser.add_argument("--cookie", type=str, default="", help="Incolla direttamente la stringa dei cookie")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("🔑 REFSTUDIO - SALVATAGGIO SESSIONE PREMIUM TUTTOCAMPO")
    print("=" * 65 + "\n")

    # 1. Se passato da argomento riga di comando
    if args.cookie:
        storage = parse_cookie_input(args.cookie)
        with open(COOKIES_FILE, "w", encoding="utf-8") as f:
            json.dump(storage, f, indent=2)
        print(f"[✓] File '{COOKIES_FILE}' creato con {len(storage['cookies'])} cookie.")
        verifica_sessione(COOKIES_FILE)
        return

    # 2. Se è presente il file cookie_input.txt nella cartella
    if os.path.exists(COOKIE_INPUT_FILE):
        print(f" -> Trovato file '{COOKIE_INPUT_FILE}'. Caricamento in corso...")
        with open(COOKIE_INPUT_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if content:
            storage = parse_cookie_input(content)
            with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                json.dump(storage, f, indent=2)
            print(f"[✓] File '{COOKIES_FILE}' salvato con successo!")
            verifica_sessione(COOKIES_FILE)
            return

    # 3. Se specificato flag --firefox
    if args.firefox:
        login_tramite_firefox()
        verifica_sessione(COOKIES_FILE)
        return

    # 4. Menu interattivo
    print("Google blocca i browser Chromium controllati via script per sicurezza.")
    print("Scegli la modalità preferita per importare la sessione:\n")
    print(" [1] (CONSIGLIATO - 100% Funzionante) Incolla i cookie dal tuo Chrome normale")
    print("     (dove hai già il profilo Premium aperto senza alcun blocco)")
    print(" [2] Apri Mozilla Firefox per effettuare l'accesso con Google")
    print()

    try:
        scelta = input("Digita 1 o 2 e premi Invio [default 1]: ").strip()
    except Exception:
        scelta = "1"

    if scelta == "2":
        login_tramite_firefox()
        verifica_sessione(COOKIES_FILE)
    else:
        print("\n" + "-" * 65)
        print("📋 GUIDA RAPIDA PER COPIARE IL COOKIE DA CHROME (10 secondi):")
        print(" 1. Apri Google Chrome normale dove sei loggato con Tuttocampo Premium.")
        print(" 2. Vai su https://www.tuttocampo.it")
        print(" 3. Premi il tasto F12 sulla tastiera (o tasto destro -> Ispeziona).")
        print(" 4. Clicca sulla scheda 'Rete' (o 'Network') in alto.")
        print(" 5. Ricarica la pagina (premi F5).")
        print(" 6. Clicca sulla prima riga in alto ('www.tuttocampo.it' o 'GironeA').")
        print(" 7. A destra, sotto 'Headers' -> 'Request Headers', trova la riga 'Cookie:'.")
        print(" 8. Fai tasto destro su 'Cookie:' -> 'Copia valore' (Copy value).")
        print("-" * 65)
        print("\n(In alternativa puoi incollare il testo nel file 'cookie_input.txt' nella cartella del progetto).\n")

        try:
            cookie_str = input("👉 Incolla qui il valore del Cookie e premi INVIO: ").strip()
        except Exception:
            cookie_str = ""

        if not cookie_str:
            # Controlla se l'utente ha salvato nel frattempo cookie_input.txt
            if os.path.exists(COOKIE_INPUT_FILE):
                with open(COOKIE_INPUT_FILE, "r", encoding="utf-8") as f:
                    cookie_str = f.read().strip()

        if not cookie_str:
            print(" [!] Nessun cookie inserito. Operazione annullata.")
            return

        storage = parse_cookie_input(cookie_str)
        with open(COOKIES_FILE, "w", encoding="utf-8") as f:
            json.dump(storage, f, indent=2)

        print(f"\n[✓] Sessione salvata con successo in '{COOKIES_FILE}' ({len(storage['cookies'])} cookie importati)!")
        verifica_sessione(COOKIES_FILE)

    print("\n" + "=" * 65)
    print("✅ FILE PRONTO!")
    print(f"Ora puoi eseguire: npm run scrape:sync")
    print("Lo scraper utilizzerà il tuo profilo Premium automaticamente.")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
