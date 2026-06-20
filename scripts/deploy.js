const hre = require("hardhat");

async function main() {
    console.log("Deploying WorkEscrow to Arc...\n");

    const network = hre.network.name;
    console.log(`Network: ${network}`);

    // USDC addresses per network. On Arc testnet, USDC is the native gas token,
    // exposed via the canonical ERC-20 interface at the address below (6 decimals).
    const USDC_ADDRESSES = {
        arcTestnet: "0x3600000000000000000000000000000000000000",
        // Mock/local: deploy a MockERC20 first if you need ERC-20 USDC locally.
    };

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    // Native gas balance is denominated in USDC on Arc (18 decimals native).
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`Native (gas USDC) balance: ${hre.ethers.formatEther(balance)}\n`);

    // Deployment parameters
    const usdcAddress = USDC_ADDRESSES[network];
    if (!usdcAddress) {
        throw new Error(`USDC address not configured for network: ${network}`);
    }

    const protocolWallet = process.env.PROTOCOL_WALLET || deployer.address; // arbiter / fee sink
    const protocolFeeBps = Number(process.env.PROTOCOL_FEE_BPS || 250); // 2.5% fee

    console.log("Deployment Parameters:");
    console.log(`  USDC Address: ${usdcAddress}`);
    console.log(`  Protocol Wallet (arbiter): ${protocolWallet}`);
    console.log(`  Protocol Fee: ${protocolFeeBps / 100}%\n`);

    // Deploy contract
    const WorkEscrow = await hre.ethers.getContractFactory("WorkEscrow");
    const escrow = await WorkEscrow.deploy(
        usdcAddress,
        protocolWallet,
        protocolFeeBps
    );

    await escrow.waitForDeployment();

    const contractAddress = await escrow.getAddress();
    console.log("✅ WorkEscrow deployed successfully!");
    console.log(`   Contract Address: ${contractAddress}`);
    console.log(`   Explorer: https://testnet.arcscan.app/address/${contractAddress}\n`);

    // Output verification command
    console.log("To verify the contract, run:");
    console.log(`npx hardhat verify --network ${network} ${contractAddress} ${usdcAddress} ${protocolWallet} ${protocolFeeBps}\n`);

    // Save deployment info
    const deploymentInfo = {
        network,
        contractAddress,
        deployer: deployer.address,
        usdcAddress,
        protocolWallet,
        protocolFeeBps,
        timestamp: new Date().toISOString(),
    };

    console.log("Deployment Info (save this to .env as ESCROW_ADDRESS):");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return contractAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
