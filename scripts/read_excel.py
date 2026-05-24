import subprocess, sys
result = subprocess.run(
    ["python", "-c", """
import sys
sys.path.insert(0, r'C:/Users/Anas/AppData/Local/Programs/Python/Python312/Lib/site-packages')
try:
    import openpyxl
    wb = openpyxl.load_workbook(r'C:/Users/Anas/OneDrive - PT Mitra Solusi Telematika/Downloads/Customer-Category-Usaha-Edited.xlsx')
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    print('Total rows:', len(rows))
    print('Headers:', rows[0])
    for r in rows[1:6]:
        print(r)
except Exception as e:
    print('openpyxl error:', e)
    try:
        import xlrd
        wb = xlrd.open_workbook(r'C:/Users/Anas/OneDrive - PT Mitra Solusi Telematika/Downloads/Customer-Category-Usaha-Edited.xlsx')
        ws = wb.sheet_by_index(0)
        print('xlrd rows:', ws.nrows)
        print('Headers:', ws.row_values(0))
        for i in range(1, min(6, ws.nrows)):
            print(ws.row_values(i))
    except Exception as e2:
        print('xlrd error:', e2)
"""],
    capture_output=True, text=True
)
print(result.stdout)
print(result.stderr[:300] if result.stderr else "")
