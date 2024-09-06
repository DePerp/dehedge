import { mapBinanceMarkets } from "./marketsEnum.js";

export const convertMarketToBinanceMarket = (market) => {
    if (mapBinanceMarkets[market]) {
        return mapBinanceMarkets[market];
    }

    return null;
}

export const getBinanceSide = (isLong, isClosed) => {
    if (isClosed) {
        return isLong ? 'SELL' : 'BUY';
    }
    return isLong ? 'BUY' : 'SELL';
}

// Works only with stablecoins assets
export const calculateSizeInMarketToken =  (collateral, price, precision) => {
    const value = collateral / price;
    return floorPrecised(value, precision)
}

const floorPrecised = (number, precision) => {
    return number.toFixed(precision);
}