import os
import sys
import time
from playwright.sync_api import sync_playwright

# Forza l'output console in UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

COOKIES_FILE = "tuttocampo_cookies.json"

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""

def main():
    print("\n" + "=" * 65)
    print("🔑 REFSTUDIO - SALVATAGGIO SESSIONE PREMIUM TUTTOCAMPO (GOOGLE)")
    print("=" * 65 + "\n")
    print("Questo script aprirà una finestra di Google Chrome.")
    print("Potrai cliccare su 'Accedi con Google' con il tuo account Premium.\n")
    print("Una volta completato l'accesso, la sessione verrà salvata in:")
    print(f"📁 {COOKIES_FILE}\n")

    with sync_playwright() as p:
        # Tenta di aprire Google Chrome nativo se presente (evita blocchi Google OAuth)
        try:
            browser = p.chromium.launch(
                headless=False,
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"]
            )
        except Exception:
            browser = p.chromium.launch(
                headless=False,
                args=["--disable-blink-features=AutomationControlled", "--start-maximized"]
            )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport=None,
            locale="it-IT"
        )
        context.add_init_script(STEALTH_JS)
        page = context.new_page()

        print(" -> Apertura di Tuttocampo.it...")
        page.goto("https://www.tuttocampo.it/", timeout=45000)

        # banner informativo nel browser
        try:
            page.evaluate("""() => {
                const b = document.createElement('div');
                b.style.position = 'fixed';
                b.style.top = '10px';
                b.style.left = '50%';
                b.style.transform = 'translateX(-50%)';
                b.style.zIndex = '9999999';
                b.style.background = '#CCFF00';
                b.style.color = '#000';
                b.style.padding = '12px 24px';
                b.style.borderRadius = '12px';
                b.style.fontWeight = 'bold';
                b.style.fontSize = '14px';
                b.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
                b.style.textAlign = 'center';
                b.innerText = '👉 EFFETTUA IL LOGIN CON GOOGLE. AL TERMINE TORNA SULLA CONSOLE E PREMI INVIO.';
                document.body.appendChild(b);
            }""")
        except Exception:
            pass

        print("\n" + "-" * 65)
        print("👉 EFFETTUA ORA L'ACCESSO CON GOOGLE NELLA FINESTRA DEL BROWSER.")
        print("Quando sei loggato e vedi il tuo profilo, torna qui e PREMI INVIO.")
        print("-" * 65 + "\n")

        # Attendiamo invio utente o rilevamento automatico cookie USER/UID
        try:
            input("Premi INVIO dopo aver completato l'accesso con Google...")
        except Exception:
            # Fallback se non interattivo: attende fino a 90 secondi che i cookie siano presenti
            print("In attesa che l'utente effettui il login...")
            for _ in range(90):
                cookies = context.cookies()
                if any(c['name'] in ('USER', 'UID', 'XID') for c in cookies):
                    break
                time.sleep(1)

        # Salvataggio storage_state completo (cookie + localStorage + tokens)
        context.storage_state(path=COOKIES_FILE)
        print(f"\n[✓] Sessione salvata con successo in '{COOKIES_FILE}'!")

        # Verifica di validità
        cookies = context.cookies()
        auth_cookie_names = [c['name'] for c in cookies if c['name'] in ('USER', 'UID', 'VERDATA', 'XID', 'PHPSESSID')]
        print(f"    Cookie di sessione salvati: {', '.join(auth_cookie_names)}")

        # Test rapido su una pagina squadra
        print("\n -> Test di verifica accesso su una pagina protetta...")
        page.goto("https://www.tuttocampo.it/EmiliaRomagna/Eccellenza/GironeA/Squadra/Arcetana/2720/Rosa", timeout=30000)
        time.sleep(3)

        content = page.content()
        if "visibile solo agli utenti loggati" in content.lower():
            print(" [⚠️] ATTENZIONE: La pagina mostra ancora 'visibile solo agli utenti loggati'. Assicurati che l'accesso sia andato a buon fine.")
        else:
            print(" [🎉] SUCCESSO CONFERMATO! La pagina della rosa è sbloccata e visibile!")

        browser.close()

    print("\n" + "=" * 65)
    print("✅ PROCEDURA COMPLETATA!")
    print(f"Il file '{COOKIES_FILE}' è ora pronto.")
    print("Ora 'scraper_tuttocampo.py' userà automaticamente questo file per estrarre le rose")
    print("utilizzando il tuo profilo Premium senza mai più chiedere credenziali.")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
