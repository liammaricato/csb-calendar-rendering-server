# csb-render

Service that takes the monthly calendar data of Clube Santista de Badminton as JSON and returns the art as a PNG (1080 px wide). It is meant to be called by n8n inside the VPS's Docker network.

Internally, `server.js` validates the JSON (`validate.js`), injects the data into `template.html` and screenshots the page with Chromium (Puppeteer).

## Installation

Docker is the only requirement. The first build installs Chromium and takes a few minutes.

### Local (for testing)

Publishes the port only on `127.0.0.1:3000` and does not depend on n8n:

```powershell
docker compose -f docker-compose.local.yml up -d --build
curl.exe http://localhost:3000/health
curl.exe -X POST http://localhost:3000/render -H "content-type: application/json" --data-binary "@example.json" -o arte.png
docker compose -f docker-compose.local.yml down      # when you are done
```

Edit `example.json` to try other data. After changing the code or `template.html`, run `up -d --build` again. In PowerShell use `curl.exe` (with `.exe`), because plain `curl` is an alias for a different command.

### VPS (with n8n)

The container publishes no port: it joins the `n8n-shared` Docker network and only containers on that network can call it, at `http://csb-render:3000`.

Copy the project folder to the VPS and, inside it:

```bash
# first time only: create the network and connect n8n to it (does not restart n8n)
docker network create n8n-shared
docker network connect n8n-shared N8N_CONTAINER_NAME

docker compose up -d --build
docker exec N8N_CONTAINER_NAME wget -qO- http://csb-render:3000/health    # should print: ok
```

If n8n already uses another network, replace `n8n-shared` in `docker-compose.yml` with its name instead of creating a new one.

### Token (optional)

Copy `.env.example` to `.env` and fill in `RENDER_TOKEN`. From then on, every call to `/render` needs the `x-api-key` header with that value. This applies to both environments.

## API

| Route | Response |
|---|---|
| `GET /health` | `ok` |
| `POST /render` | `200` PNG · `400` malformed JSON · `401` wrong token · `422` invalid data |

On error, the body looks like this:

```json
{ "error": "invalid data", "details": ["items[0].date: 31/11/2026 is not a valid date"] }
```

### `POST /render` body

```json
{
  "month": "NOVEMBRO",
  "items": [
    { "date": "06/11/2026", "title": "TREINO", "description": "", "icon": "shuttlecock", "status": "done" },
    { "date": "13/11/2026", "title": "TREINO", "description": "Foco em saque curto", "icon": "shuttlecock", "status": "highlight" },
    { "date": "20/11/2026", "title": "TREINO", "description": "Feriado — sem quadra", "icon": "shuttlecock", "status": "cancelled" },
    { "date": "28/11/2026", "title": "TORNEIO INTERNO", "icon": "trophy" }
  ]
}
```

| Field | Rule |
|---|---|
| `month` | required, up to 16 characters; converted to UPPERCASE |
| `items` | required, 1 to 8. They are sorted by date and the image height grows with the count |
| `items[].date` | required, `DD/MM/YYYY` and must be a real date (2020–2100). The art shows only `DD/MM` and the weekday is computed automatically |
| `items[].title` | required, up to 28 characters; converted to UPPERCASE |
| `items[].description` | optional, up to 70 characters |
| `items[].icon` | `shuttlecock` (default), `coffee`, `trophy` |
| `items[].status` | `normal` (default), `highlight` (date in bright blue), `done` (gray + ✓), `cancelled` (gray + ✕) |

The header (`CALENDÁRIO DO CSB`), the subtitle (`TREINOS • EVENTOS • TORNEIOS`) and the footer with the courts rule are fixed and are not part of the JSON.

### In n8n

**HTTP Request** node: method POST, URL `http://csb-render:3000/render`, JSON body and *Response Format* = **File**. The PNG comes out in the configured binary field, ready for Telegram's *Send Photo*.

To see a 422's message inside the workflow, turn on *Never Error* under *Options* and check the response status.

## Maintenance

- **Changing the look or the fixed texts:** edit `template.html` (colors are in the `:root` block). It is a static page with a sample month, so opening the file in a browser is enough to check it. Then run `up -d --build` again.
- **Logs:** `docker logs csb-render --tail 50`
- **Memory:** the container is limited to 768 MB, adjustable in `docker-compose.yml`. Chromium only runs during each render (about 1.5 s) and closes right after.

| Problem | Likely cause |
|---|---|
| `network n8n-shared ... not found` on `docker compose up` | the network does not exist on the VPS (create it with `docker network create n8n-shared`) |
| `/health` does not answer from n8n | n8n is not on the `n8n-shared` network (check with `docker inspect N8N_CONTAINER_NAME`) |
| `422` | `details` says which field is wrong |
