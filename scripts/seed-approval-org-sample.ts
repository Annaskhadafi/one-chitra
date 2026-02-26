import "dotenv/config"
import { getApprovalOrgStructures, seedApprovalOrgSampleData } from "../app/actions/approval"

async function main() {
  const seeded = await seedApprovalOrgSampleData()
  console.log("seed:", seeded)

  const structures = await getApprovalOrgStructures()
  console.log(
    "structures:",
    structures.map((structure) => ({
      name: structure.name,
      type: structure.type,
      nodes: structure.nodes.length,
      valid: structure.validation?.isValid,
      issues: structure.validation?.issues?.length ?? 0,
    }))
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed approval org sample:", error)
    process.exit(1)
  })
