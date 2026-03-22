import { getSalesHistory, generateAIPrediction } from '../app/actions/inventory-ai';

async function test() {
    const material = '699149C101';
    console.log(`--- Testing getSalesHistory for ${material} ---`);
    const history = await getSalesHistory(material);
    console.log('Success:', history.success);
    if (history.success && history.data) {
        console.log('Data count:', history.data.length);
    }

    console.log(`\n--- Testing generateAIPrediction (REPLENISHMENT) for ${material} ---`);
    const repl = await generateAIPrediction(material, 'REPLENISHMENT');
    if (repl.success) {
        console.log('Recommended Stock:', repl.data.recommendedStock);
        console.log('Rationale Length:', repl.data.rationale.length);
        console.log('Rationale Preview:\n', repl.data.rationale.slice(0, 500), '...');
    } else {
        console.error('Error:', repl.error);
    }

    console.log(`\n--- Testing generateAIPrediction (SAFETY_STOCK) for ${material} ---`);
    const safety = await generateAIPrediction(material, 'SAFETY_STOCK');
    if (safety.success) {
        console.log('Recommended Stock:', safety.data.recommendedStock);
        console.log('Rationale Preview:\n', safety.data.rationale.slice(0, 500), '...');
    } else {
        console.error('Error:', safety.error);
    }
}

test();
