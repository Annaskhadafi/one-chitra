import os

path = r"D:/[01] PROJECT/one-chitra/app/dashboard/evhs/_components/evhs-receipt-table.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''const createFallbackCustomer = (): Customer => ({
    id: 0,
    customerCode: "-",
    name: "-",
    contactName: null,
    email: null,
    birthday: null,
    address1: null,
    address2: null,
    address3: null,
    address4: null,
    address5: null,
    createdAt: new Date(),
    updatedAt: new Date(),
})'''

new = '''const createFallbackCustomer = (): Customer => ({
    id: 0,
    customerCode: "-",
    name: "-",
    contactName: null,
    email: null,
    birthday: null,
    address1: null,
    address2: null,
    address3: null,
    address4: null,
    address5: null,
    businessCategory: null,
    businessCategorySource: null,
    businessCategoryEnrichedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
})'''

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("patched evhs-receipt-table.tsx")
else:
    print("pattern not found - checking content around line 116")
    lines = content.split("\n")
    for i, l in enumerate(lines[113:135], start=114):
        print(i, repr(l))
