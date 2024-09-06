import { USDMClient } from "binance";
import { calculateSizeInMarketToken, convertMarketToBinanceMarket, getBinanceSide } from "./helpers.js";
import { defaultLeverages } from "../../lib/config.js";

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const defaultLeverage = defaultLeverages.binance;


const usdmClient = new USDMClient({
    api_key: API_KEY,
    api_secret: API_SECRET,
    recvWindow: 20000
}, undefined, true);

// [key: symbol]: { marginType: boolean; leverage: boolean };
const savedConfigSymbols = new Map();

const saveConfig = (symbol, objValue) => {
    if (savedConfigSymbols.has(symbol)) {
        const value = savedConfigSymbols.get(symbol);
        savedConfigSymbols.set(symbol, {...value, ...objValue});
        return;
    }

    savedConfigSymbols.set(symbol, objValue);
}

async function getPrecision(symbol) {
    try {
        const info = await usdmClient.getExchangeInfo();
        const symbols = info.symbols;
        for(let i = 0; i < symbols.length; i++) {
            if(symbols[i].symbol == symbol) {
             return symbols[i].quantityPrecision;
            }
        }
    } catch(e) {
        console.log(e);
    }
    return -1;
}

export const getBinancePositions = async (market) => {
    return await usdmClient.getPositionsV3(market);
}

export const prepareDataToPlace = async ({
   isLong,
   market,
   size,
   isClosed = false
}) => {
    const symbol = convertMarketToBinanceMarket(market);
    if (!symbol) {
        console.error(`Market '${market}' isn't supported for Binance. Attempted size: ${size}`);
        return null;
    }
    const precision =  await getPrecision(symbol);
    const binancePrice = (await usdmClient.getMarkPrice({
        isIsolated: "TRUE",
        symbol: symbol
    })).markPrice;
    const collateral = size / defaultLeverage;

    const symbolConfig = await usdmClient.getFuturesSymbolConfig({
        symbol
    });
    const { leverage, marginType } = symbolConfig[0];

    if (leverage !== defaultLeverage) {
        await usdmClient.setLeverage({
            symbol: symbol,
            leverage: defaultLeverage
        });
        saveConfig(symbol, { leverage: true });
    }

    if (marginType !== "ISOLATED") {
        await usdmClient.setMarginType({
            symbol: symbol,
            marginType: "ISOLATED"
        })
        saveConfig(symbol, { marginType: true });
    }

    const quantity = calculateSizeInMarketToken(collateral, binancePrice, precision);

    // Detect is long or short
    const side = getBinanceSide(isLong, isClosed);

    return {
        side,
        symbol,
        quantity
    }

}

export const placeNewOrder = async ({
    side,
    symbol,
    quantity,
}) => {
    if (!quantity) {
        console.error("Quantity isn't enough");
        return;
    }

    await usdmClient.submitNewOrder({
        side,
        symbol,
        type: 'MARKET',
        quantity,
        reduceOnly: "false",
        workingType: "MARK_PRICE"
    })
}
