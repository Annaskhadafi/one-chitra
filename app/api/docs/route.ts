const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>One Chitra API Docs - Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f8fafc; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      .topbar { display: none; }
      .api-key-panel {
        padding: 12px 24px;
        background: #0f172a;
        color: #f8fafc;
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 1000;
      }
      .brand-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-title {
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.01em;
      }
      .badge-swagger {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 9999px;
        background: #49cc90;
        color: #0f172a;
        text-transform: uppercase;
      }
      .form-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .form-group input {
        min-width: 280px;
        padding: 7px 12px;
        border-radius: 6px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #f8fafc;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }
      .form-group input:focus {
        border-color: #38bdf8;
      }
      .btn {
        padding: 7px 14px;
        border: 0;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-primary {
        background: #38bdf8;
        color: #082f49;
      }
      .btn-primary:hover {
        background: #7dd3fc;
      }
      .btn-secondary {
        background: #334155;
        color: #f8fafc;
      }
      .btn-secondary:hover {
        background: #475569;
      }
      .swagger-ui .info {
        margin: 24px 0;
      }
      .swagger-ui .scheme-container {
        background: #f1f5f9;
        box-shadow: none;
        padding: 16px 0;
      }
      .status-panel {
        padding: 40px 24px;
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      }
    </style>
  </head>
  <body>
    <header class="api-key-panel">
      <div class="brand-group">
        <span class="brand-title">One Chitra API</span>
        <span class="badge-swagger">Swagger UI</span>
      </div>
      <form class="form-group" id="api-key-form">
        <input id="api-key-input" type="password" autocomplete="off" placeholder="Masukkan x-api-key" />
        <button type="submit" class="btn btn-primary">Load Swagger</button>
        <a href="/api/redoc" class="btn btn-secondary">📖 Switch to Redoc</a>
      </form>
    </header>

    <div id="swagger-ui">
      <div class="status-panel">
        <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:20px;">Memuat Swagger UI...</h2>
        <p style="margin:0;color:#64748b;font-size:14px;">Silakan masukkan <code>x-api-key</code> pada input di atas jika halaman belum memuat otomatis.</p>
      </div>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      const input = document.getElementById("api-key-input");
      const form = document.getElementById("api-key-form");

      const urlParams = new URLSearchParams(window.location.search);
      const queryKey = urlParams.get("api_key") || urlParams.get("apiKey");
      if (queryKey) {
        localStorage.setItem("one-chitra-api-key", queryKey);
      }

      const savedKey = localStorage.getItem("one-chitra-api-key") || "";
      if (savedKey) {
        input.value = savedKey;
      }

      async function loadSwagger(apiKey) {
        const headers = apiKey ? { "x-api-key": apiKey } : {};
        const response = await fetch("/api/openapi", { headers });
        if (!response.ok) {
          document.getElementById("swagger-ui").innerHTML = 
            '<div class="status-panel">' +
              '<h2 style="color:#e11d48;margin:0 0 12px 0;font-size:20px;">Autentikasi Diperlukan</h2>' +
              '<p style="color:#64748b;font-size:14px;margin:0 0 16px 0;">API key salah atau belum dikonfigurasi. Masukkan <code>x-api-key</code> yang valid di form atas.</p>' +
              '<p style="font-size:12px;color:#94a3b8;margin:0;">API Key dapat ditemukan di environment server (<code>WIP_REPAIR_API_KEY</code> / <code>STOCKS_API_KEY</code> / <code>SALES_REVENUE_API_KEY</code>).</p>' +
            '</div>';
          return;
        }

        const spec = await response.json();
        window.ui = SwaggerUIBundle({
          spec: spec,
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          requestInterceptor: function(request) {
            if (apiKey) {
              request.headers["x-api-key"] = apiKey;
            }
            return request;
          },
        });
      }

      form.addEventListener("submit", function(event) {
        event.preventDefault();
        const key = input.value.trim();
        if (key) {
          localStorage.setItem("one-chitra-api-key", key);
        }
        loadSwagger(key);
      });

      if (input.value.trim()) {
        loadSwagger(input.value.trim());
      }
    </script>
  </body>
</html>`;

export async function GET() {
  return new Response(swaggerHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}