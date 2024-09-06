import { getAllHedgedPosition, processHedgePosition } from "../stores/hedge.js";
import { getBinancePositions, placeNewOrder, prepareDataToPlace } from "../connectors/binance/binance.js";
import { convertMarketToBinanceMarket } from "../connectors/binance/helpers.js";
jest.useFakeTimers();

const testMarket = "BTC-USD";
describe('hedging', () => {
    it('should all hedge positions is empty', () => {
        const positions = getAllHedgedPosition();
        expect(JSON.stringify(positions)).toBe('{}');
    });


    it('should add position to hedging', async () => {
        const positionToPlace ={
            market: testMarket,
            isLong: true,
            asset: process.env.USDC,
            user: '0x',
            size: 1200,
            isShieldPNLRisk: true,
        };
        let initialSize = 0;
        const initPosition = await getBinancePositions(convertMarketToBinanceMarket(testMarket));
        if (initPosition[0]) {
            initialSize = parseFloat(initPosition[0].positionAmt);
        }

        const data = await prepareDataToPlace({
            isLong: positionToPlace.isLong,
            market: positionToPlace.market,
            size: +positionToPlace.size,
            isClosed: !positionToPlace.isShieldPNLRisk
        })

        const offsetQuantity = positionToPlace.isShieldPNLRisk ? parseFloat(data.quantity) : -parseFloat(data.quantity);

        const finalSize = initialSize + offsetQuantity;
        await placeNewOrder(data);
        const positions = await getBinancePositions(convertMarketToBinanceMarket(testMarket));

        expect(finalSize).toBe(parseFloat(positions[0].positionAmt));
    })

    const positionsWithRisks = [
        {
            market: testMarket,
            isLong: true,
            asset: process.env.USDC,
            user: '0x',
            size: 1200,
            isShieldPNLRisk: true,
        },
        {
            market: testMarket,
            isLong: true,
            asset: process.env.USDC,
            user: '0x',
            size: 1200,
            isShieldPNLRisk: false,
        },
    ];

    it('should dynamic open and close hedge positions', async () => {
        let initialSize = 0;
        const initPosition = await getBinancePositions(convertMarketToBinanceMarket(testMarket));
        if (initPosition[0]) {
            initialSize = parseFloat(initPosition[0].positionAmt);
        }
        let finalSize = initialSize;

        for (const pos of positionsWithRisks) {
            const data = await prepareDataToPlace({
                isLong: pos.isLong,
                market: pos.market,
                size: +pos.size,
                isClosed: !pos.isShieldPNLRisk
            })

            const offsetQuantity = pos.isShieldPNLRisk ? parseFloat(data.quantity) : -parseFloat(data.quantity);
            finalSize += offsetQuantity;
            await placeNewOrder(data);
        }

        const positions = await getBinancePositions(convertMarketToBinanceMarket(testMarket));
        expect(finalSize).toBe(parseFloat(positions[0]?.positionAmt ?? 0));
    }, 10000);
})