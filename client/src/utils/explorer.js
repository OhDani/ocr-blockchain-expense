/**
 * explorer.js
 * Cấu hình trình khám phá khối (Block Explorer).
 * Mặc định: Linea Sepolia (Layer 2 zkEVM của ConsenSys).
 * Có thể linh hoạt ghi đè qua biến môi trường VITE_EXPLORER_URL.
 */

export const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || 'https://sepolia.lineascan.build';
export const VVND_TOKEN_ADDRESS = '0x057aeaeaD4a28A14576456E1C5CeC7fc1907739b';

export function getTxUrl(txHash) {
    if (!txHash) return '#';
    return `${EXPLORER_BASE.replace(/\/$/, '')}/tx/${txHash}`;
}

export function getAddressUrl(address) {
    if (!address) return '#';
    return `${EXPLORER_BASE.replace(/\/$/, '')}/address/${address}`;
}
