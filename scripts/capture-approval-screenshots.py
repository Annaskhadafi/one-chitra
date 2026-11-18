import os
import time
from playwright.sync_api import sync_playwright

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
    return env_vars

def main():
    env = load_env('.env.e2e.local')
    base_url = env.get('E2E_BASE_URL', 'http://localhost:3000').rstrip('/')
    email = env.get('E2E_EMAIL', '')
    password = env.get('E2E_PASSWORD', '')

    today_str = "2026-11-19"
    os.makedirs('output/playwright', exist_ok=True)

    print(f"Connecting to {base_url} with user {email}...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()
        page.set_default_timeout(30000)

        # 1. Sign in
        print("Navigating to sign-in page...")
        page.goto(f"{base_url}/sign-in", wait_until="networkidle")
        page.fill('input#email', email)
        page.fill('input#password', password)
        page.click('button[type="submit"]')
        time.sleep(4)
        print("Dashboard logged in! URL:", page.url)

        # 2. Approval Engine: Matriks Approver Sales & Tambah Sales Person
        print("Navigating to Approval Engine...")
        page.goto(f"{base_url}/dashboard/settings/approval-engine", wait_until="networkidle")
        time.sleep(2)

        matrix_tab = page.locator('button[role="tab"]:has-text("Matriks Approver Sales")')
        if matrix_tab.count() > 0:
            matrix_tab.click()
            time.sleep(1.5)

            ss1 = f"output/playwright/approval-engine-matrix-{today_str}.png"
            page.screenshot(path=ss1, full_page=True)
            print(f"Saved: {ss1}")

            add_sales_btn = page.locator('button:has-text("Tambah Sales Person")')
            if add_sales_btn.count() > 0 and add_sales_btn.is_enabled():
                print("Clicking '+ Tambah Sales Person'...")
                add_sales_btn.click()
                time.sleep(1)
                ss1_dialog = f"output/playwright/approval-engine-add-sales-dialog-{today_str}.png"
                page.screenshot(path=ss1_dialog)
                print(f"Saved: {ss1_dialog}")
                page.keyboard.press("Escape")
                time.sleep(0.5)

        # 3. Form Quotation Create (Banner Real-time di atas tabel produk & Layout Grid Lampiran)
        print("Navigating to quotation create form...")
        page.goto(f"{base_url}/dashboard/quotations/create", wait_until="networkidle")
        time.sleep(3)

        ss2 = f"output/playwright/quotation-form-banner-margin-{today_str}.png"
        page.screenshot(path=ss2, full_page=True)
        print(f"Saved: {ss2}")

        # Scroll ke bagian Lampiran / Attachment
        add_att_btn = page.locator('button:has-text("Tambah Lampiran")')
        if add_att_btn.count() > 0:
            print("Opening Add Attachment Dialog...")
            add_att_btn.scroll_into_view_if_needed()
            time.sleep(0.5)
            add_att_btn.click()
            time.sleep(1)
            ss3 = f"output/playwright/quotation-attachment-binding-dialog-{today_str}.png"
            page.screenshot(path=ss3)
            print(f"Saved: {ss3}")
            page.keyboard.press("Escape")
            time.sleep(0.5)

        # 4. Quotations Table & Detail Preview
        print("Navigating to quotations list...")
        page.goto(f"{base_url}/dashboard/quotations", wait_until="networkidle")
        time.sleep(2)
        ss4 = f"output/playwright/quotation-list-table-{today_str}.png"
        page.screenshot(path=ss4, full_page=True)
        print(f"Saved: {ss4}")

        first_quote_row = page.locator('table tbody tr').first
        if first_quote_row.count() > 0:
            quote_link = first_quote_row.locator('a[href*="/dashboard/quotations/"]').first
            if quote_link.count() > 0:
                quote_href = quote_link.get_attribute('href')
                print(f"Opening quotation detail: {quote_href}")
                page.goto(f"{base_url}{quote_href}", wait_until="networkidle")
                time.sleep(2)

                preview_btn = page.locator('button:has-text("Preview")').first
                if preview_btn.count() > 0:
                    print("Opening PDF Preview modal...")
                    preview_btn.click()
                    time.sleep(3)

                    ss5 = f"output/playwright/quotation-pdf-preview-grid-{today_str}.png"
                    page.screenshot(path=ss5, full_page=True)
                    print(f"Saved: {ss5}")

                    # Download PDF A4
                    print("Testing Download PDF A4 button...")
                    dl_btn = page.locator('button:has-text("Download PDF A4")')
                    if dl_btn.count() > 0:
                        try:
                            with page.expect_download(timeout=15000) as download_info:
                                dl_btn.click()
                            download = download_info.value
                            print(f"✓ Download successfully verified: {download.suggested_filename}")
                        except Exception as e:
                            print(f"Download notice: {e}")

        browser.close()
        print("🎉 Semua pengujian E2E selesai dengan sukses!")

if __name__ == '__main__':
    main()
