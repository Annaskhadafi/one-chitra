const swaggerHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>One Chitra API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f8fafc; }
      .topbar { display: none; }
      .api-key-panel { padding: 16px 24px; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .api-key-panel input { min-width: 320px; padding: 8px 10px; border-radius: 8px; border: 1px solid #334155; }
      .api-key-panel button { padding: 8px 12px; border: 0; border-radius: 8px; background: #38bdf8; color: #082f49; font-weight: 700; cursor: pointer; }
      .api-key-panel small { color: #cbd5e1; }
    </style>
  </head>
  <body>
    <form class="api-key-panel" id="api-key-form">
      <strong>One Chitra API Docs</strong>
      <input id="api-key-input" type="password" autocomplete="off" placeholder="Masukkan x-api-key" />
      <button type="submit">Load Swagger</button>
      <small>Key disimpan hanya di browser localStorage.</small>
    </form>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      const input = document.getElementById("api-key-input")
      const form = document.getElementById("api-key-form")
      input.value = localStorage.getItem("one-chitra-api-key") || ""

      async function loadSwagger(apiKey) {
        const response = await fetch("/api/openapi", { headers: { "x-api-key": apiKey } })
        if (!response.ok) {
          document.getElementById("swagger-ui").innerHTML = "<div style='padding:24px;font-family:system-ui'>API key salah atau belum dikonfigurasi.</div>"
          return
        }

        const spec = await response.json()
        window.ui = SwaggerUIBundle({
          spec,
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          requestInterceptor: (request) => {
            request.headers["x-api-key"] = apiKey
            return request
          },
        })
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault()
        localStorage.setItem("one-chitra-api-key", input.value)
        loadSwagger(input.value)
      })

      if (input.value) {
        loadSwagger(input.value)
      }
    </script>
  </body>
</html>`

export async function GET() {
  return new Response(swaggerHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}