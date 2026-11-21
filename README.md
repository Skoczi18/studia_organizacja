# Studia — planer studiów

PWA do organizacji studiów: plan zajęć z USOS (iCal), przedmioty z ECTS i ocenami, obecności, zadania, sesja i notatki.
Dane trzymane w Firebase Firestore (każdy użytkownik widzi tylko swoje), logowanie przez Google.

**Aplikacja:** https://skoczi18.github.io/studia_organizacja/

## Funkcje
- **Dziś** – następne zajęcia, najbliższy zjazd, szybkie zaznaczanie obecności, zadania, odliczanie do egzaminu.
- **Kalendarz** – widok miesiąca i listy, kolory przedmiotów (lub własny kolor zajęć), notatki, „czy trzeba być”, byłem/nie byłem.
- **Przedmioty** – lata/semestry, ECTS, średnia ważona, prowadzący i sala dla każdej formy zajęć, limity nieobecności, zasady zaliczenia, składowe oceny, linki, wszystkie zajęcia (następne/ostatnie).
- **Sesja** – egzaminy z USOS + ręczne, forma, termin (I/poprawka), status, ocena, notatki.
- Synchronizacja z USOS co 3 h (lub ręcznie). Feed USOS pokazuje tylko przyszłe zajęcia — aplikacja zapisuje je w bazie, więc historia zostaje.
- Działa offline, instaluje się na telefonie (Safari → Udostępnij → „Dodaj do ekranu początkowego”).

## Rozwój
```bash
npm install
npm run dev
```
Push do `main` buduje i publikuje stronę przez GitHub Actions. Reguły Firestore: `firestore.rules`.

Link iCal z USOS wpisujesz w aplikacji (Ustawienia) — nie trzymaj go w repozytorium.
