// ============================================================
// BLIMBURN TECHNICAL KNOWLEDGE BASE (KB)
// Extracted from Jorge Cervantes: Marijuana Horticulture
// ============================================================

const CULTIVATION_KB = {
    lighting: {
        seedling: '16-18 hours light',
        vegetative: '16-24 hours light (High Intensity)',
        flowering: '12/12 photoperiod (STRICT: 12h light / 12h total darkness)',
        spectrum: 'Proper spectrum mimicking natural conditions'
    },
    environment: {
        temp_day: '20°C - 25°C (68°F - 77°F) optimal; Max 29°C (85°F)',
        temp_night: 'Drop of 8°C - 11°C (15°F - 20°F) below daytime temperature',
        humidity_veg: '60% - 70% RH',
        humidity_flowering: '40% - 50% RH (Arid to prevent bud rot/botrytis)',
        co2: 'Essential for photosynthesis (Arid, CO2-rich air is best)'
    },
    nutrition: {
        ph_soil: '6.5 (Optimal for nutrient uptake)',
        ph_hydro: '5.5 - 6.5 (Typical range)',
        veg_phase: 'High Nitrogen (N)',
        flower_phase: 'Low Nitrogen, High Phosphorus (P) and Potassium (K) - "Super-bloom"'
    },
    biology: {
        transpiration: 'Stomata release H2O and O2; they breathe CO2',
        respiration: 'Occurs both day and night',
        gender: 'Dioecious (Separate male and female plants); Sinsemilla (unpollinated) is goal',
        metabolism: 'CO2 + H2O + Light = Carbohydrates + O2'
    }
};

// Export if used in Node, but for the browser app we'll just embed it or use a global
if (typeof module !== 'undefined') {
    module.exports = CULTIVATION_KB;
} else {
    window.CULTIVATION_KB = CULTIVATION_KB;
}
