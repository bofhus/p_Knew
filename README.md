# Pedagogisk karta över utbildningsdesign

Det här projektet är en enkel, fristående webbapplikation (en HTML-fil) som visualiserar en pedagogisk karta över olika utbildningsmetoder och nivåer.

## Innehåll

- Interaktiv matris med pedagogiska nivåer och kategorier.
- Detaljvy i modal för varje ruta i matrisen.
- Rollväxling mellan användare och administratör.
- Administratörsläge med möjlighet att redigera innehåll och spara lokalt i webbläsaren (`localStorage`).
- Stöd för media i detaljvyn (bild, video eller YouTube-länk).

## Kom igång

Eftersom projektet består av statiska filer behövs ingen byggprocess.

1. Klona eller ladda ner projektet.
2. Öppna `index.html` i en webbläsare.

Alternativt kan du starta en enkel lokal server:

```bash
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000` i webbläsaren.

## Användning

- Klicka på en ruta i matrisen för att öppna detaljvyn.
- Klicka på **Byt till administratör** för att aktivera redigeringsläge.
- Redigera fälten i detaljvyn och klicka på **Spara ändringar**.
- Ändringar sparas i din webbläsares lokala lagring.

## Struktur

- `index.html` – hela applikationen (HTML, CSS och JavaScript).
- `README.md` – denna projektbeskrivning.

## Teknik

- HTML5
- CSS3
- JavaScript (vanilla)

## Licens

Ingen licens är angiven i nuläget.
