import { getPriceByMarket } from "./prices.js";
import { processClosedHedgePositions } from "./hedge.js";

let positions = {}; // market => key => position
let fundingTracers = {}; // key (asset||market) => ft

function positionKey(user, market, asset, size) {
	return `${user}||${market}||${asset}||${size}`;
}

export function setPositions(_positions) {
	// store by product id
	positions = {};
	for (const position of _positions) {
		if (!positions[position.market]) positions[position.market] = {};
		positions[position.market][positionKey(position.user, position.market, position.asset, position.size)] = position;
	}

	processClosedHedgePositions();
}

export function setFundingTracers(_fundingTracerValues) {
	fundingTracers = _fundingTracerValues;
}

export function getAllPositions() {
	return positions;
}
export function getPositions(market) {
	return Object.values(positions[market] || {}) || [];
}
export function hasPosition(market, asset, user, size) {
	const marketPositionsObj = positions[market];

	return !!marketPositionsObj[positionKey(user, market, asset, size)];
}
export function getFundingTracer(asset, market) {
	return fundingTracers[`${asset}||${market}`];
}