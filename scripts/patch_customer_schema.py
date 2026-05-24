import os
base = r"D:/[01] PROJECT/one-chitra"

# 1. Update customerSchema in lib/schemas.ts
schemas_path = os.path.join(base, "lib/schemas.ts")
with open(schemas_path, "r", encoding="utf-8") as f:
    schemas = f.read()

old_schema = '''export const customerSchema = z.object({
    customerCode: z.string().min(1, "Customer Code is required"),
    name: z.string().min(1, "Customer Name is required"),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    address1: z.string().optional(),
    address2: z.string().optional(),
    address3: z.string().optional(),
    address4: z.string().optional(),
    address5: z.string().optional(),
})'''

new_schema = '''export const customerSchema = z.object({
    customerCode: z.string().min(1, "Customer Code is required"),
    name: z.string().min(1, "Customer Name is required"),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    address1: z.string().optional(),
    address2: z.string().optional(),
    address3: z.string().optional(),
    address4: z.string().optional(),
    address5: z.string().optional(),
    businessCategory: z.string().optional().nullable(),
})'''

if old_schema in schemas:
    schemas = schemas.replace(old_schema, new_schema)
    with open(schemas_path, "w", encoding="utf-8") as f:
        f.write(schemas)
    print("patched lib/schemas.ts")
else:
    print("ERROR: customerSchema pattern not found in schemas.ts")

# 2. Update upsertCustomer in app/actions/customer.ts
customer_action_path = os.path.join(base, "app/actions/customer.ts")
with open(customer_action_path, "r", encoding="utf-8") as f:
    action = f.read()

old_upsert_update = '''            await db.update(customers)
                .set({
                    ...data,
                    updatedAt: new Date()
                })
                .where(eq(customers.id, id))'''

new_upsert_update = '''            await db.update(customers)
                .set({
                    ...data,
                    businessCategory: data.businessCategory ?? null,
                    updatedAt: new Date()
                })
                .where(eq(customers.id, id))'''

old_upsert_insert = '''            await db.insert(customers).values(data)'''
new_upsert_insert = '''            await db.insert(customers).values({
                    ...data,
                    businessCategory: data.businessCategory ?? null,
                })'''

if old_upsert_update in action:
    action = action.replace(old_upsert_update, new_upsert_update)
    print("patched upsertCustomer update")
else:
    print("ERROR: upsert update pattern not found")

if old_upsert_insert in action:
    action = action.replace(old_upsert_insert, new_upsert_insert)
    print("patched upsertCustomer insert")
else:
    print("ERROR: upsert insert pattern not found")

with open(customer_action_path, "w", encoding="utf-8") as f:
    f.write(action)

print("done")
