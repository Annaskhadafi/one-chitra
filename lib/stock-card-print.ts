export type StockCardPrintLayout = "a4-landscape-2" | "a4-portrait-5"

type StockCardPrintLayoutConfig = {
    value: StockCardPrintLayout
    label: string
    description: string
    pageSize: "A4 landscape" | "A4 portrait"
    itemsPerPage: number
}

export const DEFAULT_STOCK_CARD_PRINT_LAYOUT: StockCardPrintLayout = "a4-landscape-2"

const STOCK_CARD_PRINT_LAYOUT_MAP: Record<StockCardPrintLayout, StockCardPrintLayoutConfig> = {
    "a4-landscape-2": {
        value: "a4-landscape-2",
        label: "A4 Landscape / 2 Card",
        description: "A4 landscape dibagi 2 stock card per halaman.",
        pageSize: "A4 landscape",
        itemsPerPage: 2,
    },
    "a4-portrait-5": {
        value: "a4-portrait-5",
        label: "A4 Portrait / 5 Card",
        description: "A4 portrait dibagi 5 stock card per halaman.",
        pageSize: "A4 portrait",
        itemsPerPage: 5,
    },
}

export const STOCK_CARD_PRINT_LAYOUTS = Object.values(STOCK_CARD_PRINT_LAYOUT_MAP)

export function isStockCardPrintLayout(value: string | null | undefined): value is StockCardPrintLayout {
    if (!value) return false

    return value in STOCK_CARD_PRINT_LAYOUT_MAP
}

export function parseStockCardPrintLayout(
    value: string | string[] | undefined,
): StockCardPrintLayout {
    const normalized = Array.isArray(value) ? value[0] : value

    return isStockCardPrintLayout(normalized)
        ? normalized
        : DEFAULT_STOCK_CARD_PRINT_LAYOUT
}

export function getStockCardPrintLayoutConfig(layout: StockCardPrintLayout) {
    return STOCK_CARD_PRINT_LAYOUT_MAP[layout]
}
