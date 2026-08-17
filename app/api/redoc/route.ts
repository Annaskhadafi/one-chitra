const redocHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>One Chitra API Docs - Redoc</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #ffffff; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 1000;
        padding: 12px 24px;
        background: #0f172a;
        color: #f8fafc;
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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
      .badge-redoc {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 9999px;
        background: #e11d48;
        color: #ffffff;
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
        background: #e11d48;
        color: #ffffff;
      }
      .btn-primary:hover {
        background: #be123c;
      }
      .btn-secondary {
        background: #334155;
        color: #f8fafc;
      }
      .btn-secondary:hover {
        background: #475569;
      }
      .status-panel {
        padding: 40px 24px;
        max-width: 600px;
        margin: 40px auto;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      }
      .status-panel h2 {
        margin: 0 0 12px 0;
        color: #0f172a;
        font-size: 20px;
      }
      .status-panel p {
        margin: 0 0 20px 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.5;
      }
      .status-panel code {
        background: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="brand-group">
        <span class="brand-title">One Chitra API</span>
        <span class="badge-redoc">Redoc</span>
      </div>
      <form class="form-group" id="api-key-form">
        <input id="api-key-input" type="password" autocomplete="off" placeholder="Masukkan x-api-key" />
        <button type="submit" class="btn btn-primary">Load Redoc</button>
        <a href="/api/docs" class="btn btn-secondary">⚡ Switch to Swagger UI</a>
      </form>
    </header>

    <div id="redoc-container">
      <div class="status-panel">
        <h2>Memuat Dokumentasi Redoc...</h2>
        <p>Silakan masukkan <code>x-api-key</code> pada input di atas jika halaman belum memuat otomatis.</p>
      </div>
    </div>

    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      const input = document.getElementById("api-key-input");
      const form = document.getElementById("api-key-form");
      const container = document.getElementById("redoc-container");

      const urlParams = new URLSearchParams(window.location.search);
      const queryKey = urlParams.get("api_key") || urlParams.get("apiKey");
      if (queryKey) {
        localStorage.setItem("one-chitra-api-key", queryKey);
      }

      const savedKey = localStorage.getItem("one-chitra-api-key") || "";
      if (savedKey) {
        input.value = savedKey;
      }

      async function loadRedoc(apiKey) {
        container.innerHTML = '<div class="status-panel"><h2>Mengambil Spesifikasi OpenAPI...</h2><p>Mohon tunggu sebentar...</p></div>';

        try {
          const response = await fetch("/api/openapi", {
            headers: apiKey ? { "x-api-key": apiKey } : {},
          });

          if (!response.ok) {
            container.innerHTML = 
              '<div class="status-panel">' +
                '<h2 style="color:#e11d48;">Autentikasi Diperlukan</h2>' +
                '<p>API key salah atau belum dimasukkan. Masukkan <code>x-api-key</code> yang valid di form atas.</p>' +
                '<p style="font-size:12px;color:#94a3b8;">API Key dapat ditemukan di konfigurasi environment server (<code>WIP_REPAIR_API_KEY</code> / <code>STOCKS_API_KEY</code> / <code>SALES_REVENUE_API_KEY</code>).</p>' +
              '</div>';
            return;
          }

          const spec = await response.json();
          container.innerHTML = "";

          Redoc.init(
            spec,
            {
              theme: {
                colors: {
                  primary: {
                    main: "#0284c7",
                  },
                },
                typography: {
                  fontFamily: "'Inter', system-ui, sans-serif",
                  headings: {
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: "700",
                  },
                  code: {
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                },
                sidebar: {
                  backgroundColor: "#0f172a",
                  textColor: "#f8fafc",
                  activeTextColor: "#38bdf8",
                },
                rightPanel: {
                  backgroundColor: "#1e293b",
                },
              },
              scrollYOffset: 60,
              hideDownloadButton: false,
              expandResponses: "200,201",
              pathInMiddlePanel: true,
              requiredPropsFirst: true,
            },
            container
          );
        } catch (err) {
          container.innerHTML = 
            '<div class="status-panel">' +
              '<h2 style="color:#e11d48;">Gagal Memuat Redoc</h2>' +
              '<p>' + (err && err.message ? err.message : "Terjadi kesalahan saat memproses skema OpenAPI.") + '</p>' +
            '</div>';
        }
      }

      form.addEventListener("submit", function(event) {
        event.preventDefault();
        const key = input.value.trim();
        if (key) {
          localStorage.setItem("one-chitra-api-key", key);
        }
        loadRedoc(key);
      });

      if (input.value.trim()) {
        loadRedoc(input.value.trim());
      }
    </script>
  </body>
</html>`;

export async function GET() {
  return new Response(redocHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
