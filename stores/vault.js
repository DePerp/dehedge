let maxAvailableVault = 0;
let maxAvailableShield = 0;

export const setAvailableVault = (value) => {
    maxAvailableVault = value;
}

export const getAvailableVault = () => {
    return maxAvailableVault;
}

export const setAvailableShield = (value) => {
    maxAvailableShield = value;
}

export const getAvailableShield = () => {
    return maxAvailableShield;
}