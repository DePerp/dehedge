// get contract data
import { MAX_ITEMS_PER_FETCH, USDC } from '../lib/config.js'
import {
	getContract,
	notifyError,
	formatOrderOrPosition,
	withNetworkRetries,
	formatUnitsForAsset
} from '../lib/helpers.js'
import { setMarketInfo } from '../stores/markets.js'
import {
	setPositions,
	getAllPositions,
	setFundingTracers,
} from '../stores/positions.js'
import { setAvailableShield, setAvailableVault } from "../stores/vault.js";

function cleanItems(items) {
	items = items.filter((item) => !item.size.isZero());
	items = items.map((item) => formatOrderOrPosition(item));
	return items;
}

async function getPositions() {
	let positions = [];
	const contract = await getContract('Positions');

	async function getPositionsPaginated(length, offset) {
		positions = positions.concat(await contract.getPositions(length, offset));
	}

	const length = await contract.getPositionCount();

	if (length > MAX_ITEMS_PER_FETCH) {
		// paginate
		const pages = Math.ceil(length / MAX_ITEMS_PER_FETCH);
		for (let i = 0; i < pages; i++) {
			await getPositionsPaginated(MAX_ITEMS_PER_FETCH, i * (MAX_ITEMS_PER_FETCH + 1));
		}
	} else {
		positions = await contract.getPositions(length + 10, 0);
	}

	positions = cleanItems(positions);
	setPositions(positions);
	return true;

}

async function getMarkets() {
	const contract = await getContract('TradingMarket');
	const marketList = await contract.getMarketList();
	const _markets = await contract.getMultipleMarkets(marketList);
	let markets = {};
	let i=0;
	for (const product in _markets) {
		markets[marketList[i]] = _markets[product];
		i++;
	}
	setMarketInfo(markets);
	return true;
}

async function getFundingTracers() {

	const contract = await getContract('FundingRate');

	const positions = getAllPositions();

	let ftData = {};
	for (const market in positions) {
		if (!positions[market]) continue;
		for (const key in positions[market]) {
			const pos = positions[market][key];
			ftData[`${pos.asset}||${market}`] = [pos.asset, market];
		}
		
	}

	let assets = [];
	let markets = [];

	for (const key in ftData) {
		const item = ftData[key];
		assets.push(item[0]);
		markets.push(item[1]);
	}

	if (!assets.length || !markets.length) return true;

	// get fundingTracers for active positions
	const fundingTracers = await contract.getFundingTracers(assets, markets);

	let ftReturnData = {};
	let i = 0;
	for (const ft of fundingTracers) {
		ftReturnData[`${assets[i]}||${markets[i]}`] = ft;
		i++;
	}
	setFundingTracers(ftReturnData);
	return true;
}

async function getVaultAvailable() {
	const vaultUtilsContract = await getContract('VaultUtils');
	const vaultContract = await getContract('Vault');

	const vaultAvailable = await vaultUtilsContract.getVaultAvailable(USDC);
	const shieldAvailable = await vaultContract.getShieldBalance(USDC);

	const formattedVaultAvailable = formatUnitsForAsset(vaultAvailable, USDC) * 1;
	const formattedShieldAvailable = formatUnitsForAsset(shieldAvailable, USDC) * 1;

	setAvailableVault(formattedVaultAvailable);
	setAvailableShield(formattedShieldAvailable);
}

async function promiseWithInterval(promise, interval) {
	try {
		const r = await promise();
	} catch(e) {
		notifyError('PROMISE ERROR ' + e);
	}
	setTimeout(() => {
		promiseWithInterval(promise, interval);
	}, interval);
}

export default async function() {

	try {

		let promises = [
			getPositions(),
			getMarkets(),
			getFundingTracers(),
			getVaultAvailable()
		];

		const results = await withNetworkRetries(Promise.all(promises), 10, 2000);

		// query fetch marketorders every 3 seconds, positions every 10 seconds, trigger orders every 30 seconds - and populate stores. settimeout after they return results. if they get out of hand with storage, maybe increase those intervals.

		promiseWithInterval(getPositions, 10 * 1000);
		promiseWithInterval(getMarkets, 60 * 1000);
		promiseWithInterval(getFundingTracers, 2 * 60 * 1000);
		promiseWithInterval(getVaultAvailable, 2 * 60 * 1000);

	} catch(e) {
		notifyError('Pull contracts ' + e);
	}

}