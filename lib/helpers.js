import { ethers } from 'ethers'
import { ABIS, NETWORKS, DATAREGISTRY, USDC } from './config.js'
import { getNetworkId, incrementNetworkId } from '../stores/network.js'

function waitFor(millSeconds) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, millSeconds);
	});
}

export async function withNetworkRetries(promise, nthTry, delayTime) {

	try {
		return await promise;
	} catch (e) {
		if (nthTry == 1) {
			notifyError(`Max retries with error ${e}`);
			// return Promise.reject(e);
			return;
		}
		incrementNetworkId();
		notifyError(`Retrying on next network with error ${e} (nthTry: ${nthTry})`);
		await waitFor(delayTime);
		return withNetworkRetries(promise, nthTry - 1, delayTime);
	}

}

export function formatOrderOrPosition(item) {

	let _item = {
		user: item.user,
		asset: item.asset,
		market: item.market,
		isLong: item.isLong,
		size: formatUnitsForAsset(item.size || item.positionSize, item.asset),
		collateral: formatUnitsForAsset(item.collateral || item.positionCollateral, item.asset),
		price: 1 * formatUnits(item.price),
		timestamp: 1 * item.timestamp
	};
	if (item.orderId) {
		_item.orderId = 1 * item.orderId
		_item.orderSort = item.orderSort
	}
	if (item.fundingTracer || item.fundingRate) {
		_item.fundingTracer = item.fundingTracer || item.fundingRate
	}
	return _item;
}

export function formatUnitsForAsset(amount, asset) {
	let units = asset.toLowerCase() == USDC.toLowerCase() ? 6 : 18;
	return ethers.utils.formatUnits(amount || 0, units);
}

let addresses = {}; // cache

export async function getAddress(name) {
	return await getContract(name, true);
}

export function getProvider() {
	let networkId = getNetworkId();
	const network = NETWORKS[networkId];
	if (!network) return false;
	return (new ethers.providers.JsonRpcProvider(network));
}

export async function getContract(name, addressOnly) {

	if (addressOnly && addresses[name]) return addresses[name];

	let provider = getProvider();

	const pkey = process.env.KEY;

	let address = addresses[name];

	if (!address) {
		// get address from data store
		let dataRegistry = new ethers.Contract(DATAREGISTRY, ABIS['DataRegistry'], new ethers.Wallet(pkey, provider));
		address = await dataRegistry.getAddress(name);
	}

	if (!address) return false;

	addresses[name] = address;

	if (addressOnly) return address;

	let contract = new ethers.Contract(address, ABIS[name], new ethers.Wallet(pkey, provider));

	return contract;
}

export function notifyError(message) {
	console.error(message);
}

export function formatUnits(amount, decimals) {
	return ethers.utils.formatUnits(amount || 0, decimals || 18);
}

export function parseUnits(amount, decimals) {
	if (!amount || isNaN(amount)) amount = '0';
	if (typeof(amount) == 'number') amount = "" + amount;
	return ethers.utils.parseUnits(amount, decimals || 18);
}