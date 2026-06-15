import 'dotenv/config';

async function main() {
    try {
        const materialRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_material_price");
        const materialJson = await materialRes.json();
        
        const freightRes = await fetch("https://ics.chitraparatama.com/product/api/apiconnect.php?function=get_freight_price");
        const freightJson = await freightRes.json();

        const allMaterials = materialJson.result;
        const allFreights = freightJson.result;

        const startStr = "2026-06-01";
        const endStr = "2026-06-31";

        const filterByMonth = (list: any[], dateField: string = "price_date") => {
            return list.filter(item => {
                const date = item[dateField];
                return date && date >= startStr && date <= endStr;
            });
        };

        const mMaterials = filterByMonth(allMaterials);
        const mFreights = filterByMonth(allFreights);

        const getAvg = (list: any[], name: string) => {
            const filtered = list.filter(item => item.material_name === name);
            console.log(`Raw data for ${name} in Jun 2026:`, filtered);
            if (filtered.length === 0) return 0;
            const sum = filtered.reduce((acc, curr) => acc + parseFloat(curr.material_price || 0), 0);
            return sum / filtered.length;
        };

        const rawRubber = getAvg(mMaterials, "Rubber");
        const nr = rawRubber > 0 ? rawRubber / 100 : 0;
        
        const sr = getAvg(mMaterials, "Synthetic Rubber");
        const cb = getAvg(mMaterials, "Carbon Black (Europe)");
        
        const rawSteel = getAvg(mMaterials, "HRC Steel");
        const sc = rawSteel > 0 ? rawSteel / 1000 : 0;
        
        const fr = getAvg(mFreights, "Drewry World Container Index");

        console.log({
            naturalRubber: nr,
            syntheticRubber: sr,
            carbonBlack: cb,
            steelCord: sc,
            freight: fr
        });
    } catch (e: any) {
        console.error("Error:", e);
    }
    process.exit(0);
}
main();
