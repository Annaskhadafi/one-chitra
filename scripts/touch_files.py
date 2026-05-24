import os

files = [
    r"D:/[01] PROJECT/one-chitra/app/actions/customer.ts",
    r"D:/[01] PROJECT/one-chitra/db/schema/customers.ts",
    r"D:/[01] PROJECT/one-chitra/db/schema/index.ts",
]
for p in files:
    with open(p, "r", encoding="utf-8") as f:
        content = f.read()
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print("touched", p)
