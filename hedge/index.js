import getPullContracts from "./pull-contracts.js";
import priceData from "./price-data.js";

export function getHedge() {
    getPullContracts();
    priceData();
}