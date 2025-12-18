# github-webhook-bot

Instrukcja konfiguracji (Krok po kroku)
Etap I: Konfiguracja Discorda (Odbiorca)
1. Wybierz kanał tekstowy, na który mają trafiać powiadomienia.
2. Kliknij ikonę zębatki obok nazwy kanału („Edytuj kanał”) → Integracje → Webhooks.
3. Kliknij Nowy webhook.
4. Nadaj mu nazwę (np. "GitBot") i skopiuj przyciskiem URL webhooka.
5. Zapisz ten link – będzie potrzebny w Etapie II.
Etap II: Konfiguracja AWS Lambda (Logika)
To serce naszego bota.
1. Tworzenie Funkcji:
* Zaloguj się do konsoli AWS i wyszukaj usługę Lambda.
* Kliknij Create function → Author from scratch.
* Nazwa: GitHub-Discord-Bot.
* Runtime: Node.js 24.x.
* Zatwierdź przyciskiem Create function.
2. Wgrywanie Kodu:
* W sekcji "Code source" znajdź plik index.mjs
* Wklej kod źródłowy i kliknij Deploy
3. Konfiguracja Zmiennych (Environment variables): W zakładce Configuration → Environment variables dodaj:
* DISCORD_WEBHOOK_URL: (Link z Etapu I).
* GITHUB_SECRET: Wymyśl silne hasło. Zapamiętaj je.
4. Wystawienie API:
* W zakładce Function overview kliknij Add trigger → API Gateway.
* Wybierz HTTP API i Security: Open (Bezpieczeństwo zapewnia weryfikacja podpisu w kodzie).
* Po utworzeniu skopiuj API Endpoint (np. https://xyz...lambda-url...aws/).
Etap III: Konfiguracja GitHub (Nadawca)
1. W repozytorium wejdź w Settings → Webhooks → Add webhook.
2. Payload URL: Wklej link API Endpoint z AWS.
3. Content type: Wybierz application/json.
4. Secret: Wpisz to samo hasło, co w zmiennej GITHUB_SECRET w AWS.
5. Which events?: Wybierz "Let me select individual events" i zaznacz to co potrzebujesz np:
    * Issues
    * Pull requests
    * Issue comments
6. Kliknij Add webhook.

5. Weryfikacja działania
Aby potwierdzić poprawne wdrożenie, wykonaj testowy Pull Request:
1. W repozytorium stwórz nową gałąź (branch).
2. Dokonaj drobnej zmiany w dowolnym pliku (np. README).
3. Utwórz Pull Request.
Oczekiwany rezultat: Na wskazanym kanale Discord w ciągu 1-2 sekund pojawi się kafelek (Embed) z informacją o nowym PR.
