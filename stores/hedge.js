import { placeNewOrder, prepareDataToPlace } from "../connectors/binance/binance.js";
import { hasPosition } from "./positions.js";

let hedgedPositions = {}; // market => key: user|market|asset|size => position

function positionKey(user, market, asset, size) {
    return `${user}||${market}||${asset}||${size}`;
}

export async function processHedgePosition(position) {
    const { isHedge, isVaultDrawdown, isShieldPNLRisk, isLong, size, market } = position;

    // if any risks
    if (isHedge || isVaultDrawdown || isShieldPNLRisk) {
        try {
            // place position on cex
            if (!hasHedgedPosition(position)) {
                const data = await prepareDataToPlace({
                    isLong,
                    market,
                    size: +size,
                })

                if (!data) {
                    return;
                }

                if (!parseFloat(data.quantity)) {
                    console.log("Size of asset isn't enough to place");
                    return null;
                }

                await placeNewOrder(data);
                return setHedgedPosition({...position, quantity: data.quantity, placedTime: Date.now()});
            } else {
                // or update expired time
                const hedgePosition = getHedgedPosition(position);
                setHedgedPosition({...hedgePosition, placedTime: Date.now()})
            }
        } catch (err) {
            console.error(err);
        }

        return;
    }

    if (!hasHedgedPosition(position)) return;

    const positionToClose = getHedgedPosition(position);

    if (!checkIfHedgePositionIsExpired(positionToClose)) return;
    // Remove position from cex

    const copiedPositionToClose = { ...positionToClose };
    removeHedgedPosition(position.market, positionKey(position.user, position.market, position.asset, position.size));

    console.log(copiedPositionToClose);
    const data = await prepareDataToPlace({
        isLong,
        market,
        size: +copiedPositionToClose.size,
        isClosed: true
    });

    if (!data) {
        return;
    }

    await placeNewOrder({
        side: data.side,
        symbol: data.symbol,
        quantity: copiedPositionToClose.quantity,
    })

}

// If a position is completely closed
export async function processClosedHedgePositions() {
    const hedgedPositions = getAllHedgedPosition();
    for (const market in hedgedPositions) {
        for (const posLabel in hedgedPositions[market]) {
            const pos = hedgedPositions[market][posLabel];
            if (!hasPosition(pos.market, pos.asset, pos.user, pos.size)) {
                const data = await prepareDataToPlace({
                    isLong: pos.isLong,
                    market: pos.market,
                    size: 0,
                    isClosed: true
                });

                if (!data) {
                    return;
                }

                await placeNewOrder({
                    side: data.side,
                    symbol: data.symbol,
                    quantity: pos?.quantity,
                })
            }
        }
    }
}

export function setHedgedPosition(position) {
    if (!hedgedPositions[position.market]) hedgedPositions[position.market] = {};

    hedgedPositions[position.market][positionKey(position.user, position.market, position.asset, position.size)] = position;
}

function checkIfHedgePositionIsExpired(position) {
    const dateTime = position.placedTime;
    if (!dateTime) return false;

    return Date.now() - position.placedTime > 60_000;
}

function removeHedgedPosition(asset, key) {
    delete hedgedPositions[asset][key];
}

function hasHedgedPosition(position) {
    if (!hedgedPositions[position.market]) return false;

    return !!hedgedPositions[position.market][positionKey(position.user, position.market, position.asset, position.size)];
}

function getHedgedPosition(position) {
    if (!hedgedPositions[position.market]) return null;
    return hedgedPositions[position.market][positionKey(position.user, position.market, position.asset, position.size)];
}

export function getAllHedgedPosition() {
    return hedgedPositions;
}