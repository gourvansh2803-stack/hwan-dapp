export const CONTRACT_ADDRESS = "0xDF544FF9FF3f616734Ba4d302B58EebD8f6D6057";

// 🔥 BEP-20 USDT Address (Signup fees ke liye)
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// 🔥 BEP-20 HWAN Token Address (Bot Allowance aur Transfers ke liye)
export const HWAN_ADDRESS = "0x3e79740e5dA9e04Ad623954503Ef594F9F66eFE1";

export const CORE_ABI = [
    "function register(address referral) external",
    "function setDestination(address _destination) external",
    "function getUserDashboardData(address _user) external view returns (bool isReg, address dest, uint256 totalFwd)",
    "function getUserTransferHistory(address _user) external view returns ((uint256 amount, uint256 timestamp, address destination)[])",
    "function signupFee() view returns (uint256)",
    "event FundsForwarded(address indexed user, address indexed destination, uint256 amount, uint256 timestamp)"
];

export const USDT_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];