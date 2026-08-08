// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockVND
 * @dev ERC-20 stablecoin giả lập VNĐ cho POC.
 *      1 vVND = 1 VNĐ (decimals = 0).
 *      Chỉ owner (admin/công ty) có quyền mint.
 */
contract MockVND is ERC20, Ownable {
    constructor() ERC20("Mock Vietnamese Dong", "vVND") Ownable(msg.sender) {}

    /**
     * @dev Decimals = 0 → 1 token = 1 VNĐ, đơn giản cho demo.
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /**
     * @dev Mint vVND mới. Chỉ owner (admin) gọi được.
     * @param to Địa chỉ nhận
     * @param amount Số lượng vVND
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
