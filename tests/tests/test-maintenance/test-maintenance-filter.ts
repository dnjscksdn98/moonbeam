import "@moonbeam-network/api-augment";
import { expect } from "chai";
import { BN, hexToU8a } from "@polkadot/util";
import { u128 } from "@polkadot/types";
import { GLMR } from "../../util/constants";
import { execFromAllMembersOfTechCommittee } from "../../util/governance";

import { describeDevMoonbeam } from "../../util/setup-dev-tests";
import { createBlockWithExtrinsic } from "../../util/substrate-rpc";
import { createTransfer } from "../../util/transactions";
import { customWeb3Request } from "../../util/providers";
import { alith, baltathar, charleth, generateKeyingPair } from "../../util/accounts";
import { mockAssetBalance, RELAY_SOURCE_LOCATION } from "../../util/assets";

const ARBITRARY_ASSET_ID = 42259045809535163221576417993425387648n;
const RELAYCHAIN_ARBITRARY_ADDRESS_1: string =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const ARBITRARY_VESTING_PERIOD = 201600n;

describeDevMoonbeam("Maintenance Mode - Filter", (context) => {
  before("entering maintenant mode", async () => {
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
  });

  it("should forbid transferring tokens", async function () {
    await context.createBlock({
      transactions: [await createTransfer(context, charleth.address, 512)],
    });
    expect(
      await createBlockWithExtrinsic(
        context,
        alith,
        context.polkadotApi.tx.balances.transfer(baltathar.address, 1n * GLMR)
      ).catch((e) => e.toString())
    ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");
  });

  it("should allow EVM extrinsic from sudo", async function () {
    const randomAccount = generateKeyingPair();
    const { successful } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.evm.call(
          alith.address,
          randomAccount.address,
          "0x0",
          100n * GLMR,
          12_000_000n,
          1_000_000_000n,
          "0",
          undefined,
          []
        )
      )
    );
    expect(successful).to.be.true;
    expect(await context.web3.eth.getBalance(randomAccount.address)).to.equal(
      (100n * GLMR).toString()
    );
  });

  it("should forbid crowdloan rewards claim", async () => {
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.crowdloanRewards.initializeRewardVec([
          [RELAYCHAIN_ARBITRARY_ADDRESS_1, charleth.address, 3_000_000n * GLMR],
        ])
      )
    );
    const initBlock = await context.polkadotApi.query.crowdloanRewards.initRelayBlock();
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.crowdloanRewards.completeInitialization(
          initBlock.toBigInt() + ARBITRARY_VESTING_PERIOD
        )
      )
    );

    expect(
      await createBlockWithExtrinsic(
        context,
        alith,
        context.polkadotApi.tx.crowdloanRewards.claim()
      ).catch((e) => e.toString())
    ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");
  });

  it("should forbid assets transfer", async () => {
    const balance = context.polkadotApi.createType("Balance", 100000000000000);
    const assetBalance = context.polkadotApi.createType("PalletAssetsAssetAccount", {
      balance: balance,
    });

    const assetId = context.polkadotApi.createType("u128", ARBITRARY_ASSET_ID);
    const assetDetails = context.polkadotApi.createType("PalletAssetsAssetDetails", {
      supply: balance,
    });

    await mockAssetBalance(context, assetBalance, assetDetails, alith, assetId, alith.address);

    expect(
      await createBlockWithExtrinsic(
        context,
        alith,
        context.polkadotApi.tx.assets.transfer(assetId, baltathar.address, 1000)
      ).catch((e) => e.toString())
    ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");
  });

  it("should forbid xtokens transfer", async () => {
    expect(
      await createBlockWithExtrinsic(
        context,
        baltathar,
        context.polkadotApi.tx.xTokens.transfer(
          "SelfReserve", //enum
          100n * GLMR,
          {
            V1: {
              parents: 1n,
              interior: {
                X2: [
                  { Parachain: 2000n },
                  { AccountKey20: { network: "Any", key: hexToU8a(baltathar.address) } },
                ],
              },
            },
          },
          4000000000n
        )
      ).catch((e) => e.toString())
    ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");
  });

  it("should forbid xcmTransactor to", async () => {
    expect(
      await createBlockWithExtrinsic(
        context,
        baltathar,
        context.polkadotApi.tx.xcmTransactor.transactThroughDerivative(
          "Relay",
          0,
          "SelfReserve",
          4000000000n,
          ""
        )
      ).catch((e) => e.toString())
    ).to.equal("RpcError: 1010: Invalid Transaction: Transaction call is not expected");
  });
});

describeDevMoonbeam("Maintenance Mode - Filter", (context) => {
  let assetId: u128;
  before("registering asset", async function () {
    const balance = context.polkadotApi.createType("Balance", 100000000000000);
    const assetBalance = context.polkadotApi.createType("PalletAssetsAssetAccount", {
      balance: balance,
    });

    assetId = context.polkadotApi.createType("u128", ARBITRARY_ASSET_ID);
    const assetDetails = context.polkadotApi.createType("PalletAssetsAssetDetails", {
      supply: balance,
    });

    await mockAssetBalance(context, assetBalance, assetDetails, alith, assetId, baltathar.address);

    // setAssetUnitsPerSecond
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.assetManager.setAssetUnitsPerSecond(RELAY_SOURCE_LOCATION, 0, 0)
      )
    );
  });

  before("entering maintenant mode", async () => {
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
  });

  it("should queue DMP until resuming operations", async function () {
    // Send RPC call to inject DMP message
    // You can provide a message, but if you don't a downward transfer is the default
    await customWeb3Request(context.web3, "xcm_injectDownwardMessage", [[]]);

    // Create a block in which the XCM should be executed
    await context.createBlock();

    // Make sure the state does not have ALITH's DOT tokens
    let alithBalance = await context.polkadotApi.query.assets.account(
      assetId.toU8a(),
      alith.address
    );

    // Alith balance is 0
    expect(alithBalance.isNone).to.eq(true);

    // turn maintenance off
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.resumeNormalOperation()
    );

    // Create a block in which the XCM will be executed
    await context.createBlock();

    // Make sure the state has ALITH's to DOT tokens
    const newAlithBalance = (
      await context.polkadotApi.query.assets.account(assetId.toU8a(), alith.address)
    ).unwrap();

    // Alith balance is 10 DOT
    expect(newAlithBalance.balance.toBigInt()).to.eq(10000000000000n);
  });
});

describeDevMoonbeam("Maintenance Mode - Filter", (context) => {
  let assetId: string;
  const foreignParaId = 2000;

  before("registering asset", async function () {
    const assetMetadata = {
      name: "FOREIGN",
      symbol: "FOREIGN",
      decimals: new BN(12),
      isFrozen: false,
    };

    const sourceLocation = {
      Xcm: { parents: 1, interior: { X1: { Parachain: foreignParaId } } },
    };

    // registerForeignAsset
    const { events: eventsRegister } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.assetManager.registerForeignAsset(
          sourceLocation,
          assetMetadata,
          new BN(1),
          true
        )
      )
    );

    assetId = eventsRegister
      .find(({ event: { section } }) => section.toString() === "assetManager")
      .event.data[0].toHex()
      .replace(/,/g, "");

    // setAssetUnitsPerSecond
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.assetManager.setAssetUnitsPerSecond(sourceLocation, 0, 0)
      )
    );
  });

  before("entering maintenant mode", async () => {
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
  });

  it("should queue XCM messages until resuming operations", async function () {
    // Send RPC call to inject XCMP message
    // You can provide a message, but if you don't a downward transfer is the default
    await customWeb3Request(context.web3, "xcm_injectHrmpMessage", [foreignParaId, []]);

    // Create a block in which the XCM should be executed
    await context.createBlock();

    // Make sure the state does not have ALITH's foreign asset tokens
    let alithBalance = (await context.polkadotApi.query.assets.account(
      assetId,
      alith.address
    )) as any;
    // Alith balance is 0
    expect(alithBalance.isNone).to.eq(true);

    // turn maintenance off
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.resumeNormalOperation()
    );

    // Create a block in which the XCM will be executed
    await context.createBlock();

    // Make sure the state has ALITH's to foreign assets tokens
    alithBalance = (
      await context.polkadotApi.query.assets.account(assetId, alith.address)
    ).unwrap();

    expect(alithBalance.balance.toBigInt()).to.eq(10000000000000n);
  });
});
