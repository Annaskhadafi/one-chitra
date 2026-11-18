import { db } from "../db"
import { user } from "../db/schema/auth"
import { quotationSalesApproverMatrix } from "../db/schema/approval-quotation-engine"
import { ilike, or } from "drizzle-orm"

async function seedSalesMatrix() {
    console.log("Seeding sales approver matrix...")

    const allUsers = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role }).from(user)

    const findUser = (query: string) => {
        const q = query.toLowerCase()
        return allUsers.find(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))?.id || null
    }

    const yeanId = findUser("yean")
    const personId = findUser("person")
    const febrianId = findUser("febrian")
    const romyId = findUser("romy.hidayat") || findUser("hidayat")
    const ockyId = findUser("ocky")
    const zulfikarId = findUser("zulfikar")
    const ketutId = findUser("ketut")
    const rikiId = findUser("riki")
    const gregoriusId = findUser("gregorius")
    const michaelId = findUser("michael.adrian") || findUser("adrian")
    const agungId = findUser("agung")
    const furqanId = findUser("furqan")
    const harrizId = findUser("harriz")
    const luthfiId = findUser("luthfi")
    const unggulId = findUser("unggul")
    const buriId = findUser("buri")
    const riyandiId = findUser("riyandi")

    const matrixConfigs = [
        {
            salesUserId: zulfikarId,
            spvUserId: zulfikarId,
            majorAccountUserId: ockyId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: ketutId,
            spvUserId: yeanId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: gregoriusId,
            spvUserId: ketutId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: rikiId,
            spvUserId: ketutId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: michaelId,
            spvUserId: yeanId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: buriId,
            spvUserId: yeanId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: harrizId,
            spvUserId: buriId,
            majorAccountUserId: buriId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: furqanId,
            spvUserId: yeanId,
            majorAccountUserId: yeanId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: ockyId,
            spvUserId: ockyId,
            majorAccountUserId: ockyId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: agungId,
            spvUserId: agungId,
            majorAccountUserId: agungId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: luthfiId,
            spvUserId: ockyId,
            majorAccountUserId: ockyId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
        {
            salesUserId: unggulId,
            spvUserId: luthfiId,
            majorAccountUserId: ockyId,
            salesManagerUserId: yeanId,
            generalManagerUserId: personId,
            financeManagerUserId: febrianId,
            directorUserId: romyId,
        },
    ]

    for (const row of matrixConfigs) {
        if (!row.salesUserId) continue

        await db.insert(quotationSalesApproverMatrix)
            .values({
                salesUserId: row.salesUserId,
                spvUserId: row.spvUserId,
                majorAccountUserId: row.majorAccountUserId,
                salesManagerUserId: row.salesManagerUserId,
                generalManagerUserId: row.generalManagerUserId,
                financeManagerUserId: row.financeManagerUserId,
                directorUserId: row.directorUserId,
                isActive: true,
            })
            .onConflictDoUpdate({
                target: [quotationSalesApproverMatrix.salesUserId],
                set: {
                    spvUserId: row.spvUserId,
                    majorAccountUserId: row.majorAccountUserId,
                    salesManagerUserId: row.salesManagerUserId,
                    generalManagerUserId: row.generalManagerUserId,
                    financeManagerUserId: row.financeManagerUserId,
                    directorUserId: row.directorUserId,
                    updatedAt: new Date(),
                },
            })
    }

    console.log("Successfully seeded sales approver matrix!")
    process.exit(0)
}

seedSalesMatrix().catch((err) => {
    console.error("Error seeding sales matrix:", err)
    process.exit(1)
})
