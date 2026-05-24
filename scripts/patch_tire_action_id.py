import os
base = r"D:/[01] PROJECT/one-chitra"

# 1. Patch action to include customerId
action_path = os.path.join(base, "app/actions/customer-tire-history.ts")
with open(action_path, "r", encoding="utf-8") as f:
    action = f.read()

old_iface = '''export interface TireHistoryCustomer {
  customerName: string
  businessCategory: string | null
  totalRevenue: number
  totalQty: number
  lastPurchaseDate: string | null
  matGroups: Record<string, { revenue: number; qty: number; lastDate: string | null; items: TireHistoryItem[] }>
}'''

new_iface = '''export interface TireHistoryCustomer {
  customerId: number | null
  customerName: string
  businessCategory: string | null
  totalRevenue: number
  totalQty: number
  lastPurchaseDate: string | null
  matGroups: Record<string, { revenue: number; qty: number; lastDate: string | null; items: TireHistoryItem[] }>
}'''

old_custmap = '''      if (!custMap.has(name)) {
        custMap.set(name, {
          customerName: name,
          businessCategory: bizCat,
          totalRevenue: 0,
          totalQty: 0,
          lastPurchaseDate: null,
          matGroups: {},
        })
      }'''

new_custmap = '''      if (!custMap.has(name)) {
        const dbCust = customerRows.find(c => c.name.trim().toUpperCase() === name.toUpperCase() || normName(c.name) === normName(name))
        custMap.set(name, {
          customerId: dbCust?.id ?? null,
          customerName: name,
          businessCategory: bizCat,
          totalRevenue: 0,
          totalQty: 0,
          lastPurchaseDate: null,
          matGroups: {},
        })
      }'''

# Also need id in customerRows select
old_select = '''    const customerRows = await db.select({
      name: customers.name,
      businessCategory: customers.businessCategory,
    }).from(customers)'''

new_select = '''    const customerRows = await db.select({
      id: customers.id,
      name: customers.name,
      businessCategory: customers.businessCategory,
    }).from(customers)'''

ok = True
for old, new, label in [(old_iface, new_iface, "interface"), (old_custmap, new_custmap, "custmap"), (old_select, new_select, "select")]:
    if old in action:
        action = action.replace(old, new)
        print(f"patched {label}")
    else:
        print(f"ERROR: {label} pattern not found")
        ok = False

if ok:
    with open(action_path, "w", encoding="utf-8") as f:
        f.write(action)
    print("action saved")
