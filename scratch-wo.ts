import { getWipRepairData } from "./app/actions/wip-repair";

async function run() {
  const data = await getWipRepairData();
  console.log("WOs:", data.slice(0, 10).map(d => d.wo));
  process.exit(0);
}

run();
