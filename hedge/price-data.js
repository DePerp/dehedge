import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js'

import { PYTH_PRICE_SERVICE } from '../lib/config.js'
import { setPrice } from '../stores/prices.js'
import { getMarketInfos } from '../stores/markets.js'
import { notifyError } from '../lib/helpers.js'

let t;
let symbols = {}; // source => [symbols]
let markets = {}; // source => [markets] // !! ordered same as symbols
let connection;

export default async function priceData() {

	clearTimeout(t);

	if (connection) {
		connection.closeWebSocket();
	}

	const marketInfos = getMarketInfos();

	if (!marketInfos || !marketInfos['BTC-USD']) {
		t = setTimeout(priceData, 2 * 1000);
		return;
	}

	connection = new EvmPriceServiceConnection(PYTH_PRICE_SERVICE);

	let priceIds = [];
	let pythFeedToMarket = {};
	for (const market in marketInfos) {
		const marketInfo = marketInfos[market];
		priceIds.push(marketInfo.pythFeed);
		pythFeedToMarket[marketInfo.pythFeed] = market;
	}

	connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
		const feedId = `0x${priceFeed.id}`;
		const market = pythFeedToMarket[feedId];
	//	console.log(`Price updated for ${feedId} (${market})`);
		const maxAge = marketInfos[market]?.feedMaxAge;
		const priceObj = priceFeed.getPriceNoOlderThan(maxAge || 10);
		if (priceObj) {

			// convert price to decimal without exponent and extra 0s
			const price = priceObj.price / 10**(-1 * priceObj.expo);

			setPrice({
				market, 
				price, 
				timestamp: parseInt(priceObj.publishTime * 1000)
			});

		} // else price is stale
	})

	t = setTimeout(priceData, 15 * 60 * 1000);

}