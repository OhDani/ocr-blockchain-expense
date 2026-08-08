const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockVND", function () {
    let mockVND, owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        const MockVND = await ethers.getContractFactory("MockVND");
        mockVND = await MockVND.deploy();
    });

    describe("Deployment", function () {
        it("Tên token là 'Mock Vietnamese Dong', symbol là 'vVND'", async function () {
            expect(await mockVND.name()).to.equal("Mock Vietnamese Dong");
            expect(await mockVND.symbol()).to.equal("vVND");
        });

        it("Decimals = 0 (1 token = 1 VNĐ)", async function () {
            expect(await mockVND.decimals()).to.equal(0);
        });

        it("Owner là người deploy", async function () {
            expect(await mockVND.owner()).to.equal(owner.address);
        });
    });

    describe("Mint", function () {
        it("Owner mint thành công", async function () {
            await mockVND.mint(user1.address, 1_000_000);
            expect(await mockVND.balanceOf(user1.address)).to.equal(1_000_000);
        });

        it("Người khác không mint được", async function () {
            await expect(
                mockVND.connect(user1).mint(user2.address, 1_000_000)
            ).to.be.revertedWithCustomError(mockVND, "OwnableUnauthorizedAccount");
        });
    });

    describe("Transfer", function () {
        it("Transfer giữa 2 ví", async function () {
            await mockVND.mint(user1.address, 500_000);
            await mockVND.connect(user1).transfer(user2.address, 200_000);

            expect(await mockVND.balanceOf(user1.address)).to.equal(300_000);
            expect(await mockVND.balanceOf(user2.address)).to.equal(200_000);
        });

        it("Không transfer quá số dư", async function () {
            await mockVND.mint(user1.address, 100_000);
            await expect(
                mockVND.connect(user1).transfer(user2.address, 200_000)
            ).to.be.revertedWithCustomError(mockVND, "ERC20InsufficientBalance");
        });
    });
});
