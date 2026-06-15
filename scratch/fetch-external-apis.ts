async function run() {
  try {
    const resMaterial = await fetch('https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_material_price');
    const materialData = await resMaterial.json();
    
    if (materialData.status === "OK" && Array.isArray(materialData.result)) {
      console.log("=== UNIQUE MATERIALS ===");
      const materials = {};
      materialData.result.forEach(item => {
        if (!materials[item.material_name]) {
          materials[item.material_name] = [];
        }
        materials[item.material_name].push(item);
      });
      
      for (const name of Object.keys(materials)) {
        console.log(`- ${name} (Unit: ${materials[name][0].material_unit}, Currency: ${materials[name][0].material_currency}, Count: ${materials[name].length})`);
        // Tampilkan 3 data teratas (biasanya terurut berdasarkan tanggal terbaru)
        console.log("  Sample:", materials[name].slice(0, 3).map(x => `${x.price_date}: ${x.material_price}`));
      }
    }

    const resFreight = await fetch('https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_freight_price');
    const freightData = await resFreight.json();
    if (freightData.status === "OK" && Array.isArray(freightData.result)) {
      console.log("\n=== UNIQUE FREIGHTS ===");
      const freights = {};
      freightData.result.forEach(item => {
        if (!freights[item.material_name]) {
          freights[item.material_name] = [];
        }
        freights[item.material_name].push(item);
      });
      
      for (const name of Object.keys(freights)) {
        console.log(`- ${name} (Unit: ${freights[name][0].material_unit}, Currency: ${freights[name][0].material_currency}, Count: ${freights[name].length})`);
        console.log("  Sample:", freights[name].slice(0, 3).map(x => `${x.price_date}: ${x.material_price}`));
      }
    }
  } catch (error) {
    console.error("Error fetching APIs:", error);
  }
}

run();
