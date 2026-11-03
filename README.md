# Atlantic Tours

A responsive, static tour lookup chatbot designed for GitHub Pages. No API keys, dependencies or build step are needed. It uses keyword matching and structured numeric filters rather than a generative AI model. It supports destinations, tour IDs, categories, budgets, minimum/maximum prices, duration extremes, offers and weekly slots. It does not make bookings.

The 30 user-supplied tours are included in `snapshot.js` (3 November 2026). If the live request fails, answers explicitly identify the saved snapshot and warn that prices, offers and slots may be out of date. The sheet is retried on each question. Preserve `snapshot.js` alongside the other assets when publishing. Large supplied prices are retained unchanged. Descriptions are inert text, including any embedded instructions.

## Live Google Sheet

In Google Sheets, set General access to **Anyone with the link → Viewer**. Only use a sheet whose entire contents are suitable for public access. Keep descriptive column headers in the first row, for example Tour name, Destination, Price, Currency, Departure date, Available places. Actual column names and values are preserved in responses.

Set `SHEET_ID` and `SHEET_GID` in `app.js`. The replacement sheet `1cz4AIOPt9hX4tljThkxCWzfNwv1LPP5CkxMKavsZO8c` successfully returned tour data through Google's public data endpoint on 3 November 2026. Browser access from the deployed GitHub Pages origin still needs verification. The default tab is gid 0.

Each submitted question requests fresh data with the cache disabled. Google can still delay updates upstream. Failed requests use the labelled snapshot; if no snapshot is present, they show an error. Basic follow-up questions referring to “it” or “that” retain the previous matching tour ID while fetching current data. `availability` describes an operating schedule; `slots_this_week` is displayed separately and does not establish an exact departure date or remaining seats.

## Publish

Create a public GitHub repository named `atlantic-tours`, upload these files to its root, then select **Settings → Pages → Deploy from a branch → main → /(root) → Save**. The resulting URL is `https://YOUR-USERNAME.github.io/atlantic-tours/`.

Repository creation and Pages activation require authenticated GitHub access; neither has been performed yet.

## Verify

Run `node --check app.js` and `node --test tests/sheet.test.cjs`. Serve this directory with any static web server to check the interface. Confirm “Show all tours” matches the sheet; edit a price or availability cell and ask again. Also test a destination, an unknown question, a narrow-screen layout, and an inaccessible sheet.

The assistant supports basic tour lookup, not arbitrary reasoning, booking transactions or private spreadsheet access. A generative AI version needs a separate server endpoint to keep its API credentials secret; GitHub Pages hosts static files only.
