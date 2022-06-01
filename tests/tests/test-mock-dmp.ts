import Keyring from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { expect } from "chai";
import { BN, u8aToHex } from "@polkadot/util";

import { ALITH_PRIV_KEY } from "../util/constants";
import { describeDevMoonbeam } from "../util/setup-dev-tests";
import { createBlockWithExtrinsic } from "../util/substrate-rpc";
import { customWeb3Request } from "../util/providers";
import type { XcmVersionedXcm } from "@polkadot/types/lookup";

// Twelve decimal places in the moonbase relay chain's token
const RELAY_TOKEN = 1_000_000_000_000n;

const palletId = "0x6D6f646c617373746d6E67720000000000000000";

const assetMetadata = {
  name: "DOT",
  symbol: "DOT",
  decimals: new BN(12),
  isFrozen: false,
};

const sourceLocation = { XCM: { parents: 1, interior: "Here" } };

describeDevMoonbeam("Mock XCM - receive downward transfer", (context) => {
  let assetId: string;
  let alith: KeyringPair;

  before("Should Register an asset and set unit per sec", async function () {
    const keyringEth = new Keyring({ type: "ethereum" });
    alith = keyringEth.addFromUri(ALITH_PRIV_KEY, null, "ethereum");

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
    // Look for assetId in events
    eventsRegister.forEach((e) => {
      if (e.section.toString() === "assetManager") {
        assetId = e.data[0].toHex();
      }
    });
    assetId = assetId.replace(/,/g, "");

    // setAssetUnitsPerSecond
    const { events } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.assetManager.setAssetUnitsPerSecond(sourceLocation, 0, 0)
      )
    );
    expect(events[1].method.toString()).to.eq("UnitsPerSecondChanged");
    expect(events[4].method.toString()).to.eq("ExtrinsicSuccess");

    // check asset in storage
    const registeredAsset = (
      (await context.polkadotApi.query.assets.asset(assetId)) as any
    ).unwrap();
    expect(registeredAsset.owner.toHex()).to.eq(palletId.toLowerCase());
  });

  it("Should receive a downward transfer of 10 DOTs to Alith", async function () {
    // Send RPC call to inject XCM message
    // You can provide a message, but if you don't a downward transfer is the default
    await customWeb3Request(context.web3, "xcm_injectDownwardMessage", [[]]);

    // Create a block in which the XCM will be executed
    await context.createBlock();

    // Make sure the state has ALITH's to DOT tokens
    let alith_dot_balance = (
      (await context.polkadotApi.query.assets.account(assetId, alith.address)) as any
    )
      .unwrap()
      ["balance"].toBigInt();

    expect(alith_dot_balance).to.eq(10n * RELAY_TOKEN);
  });
});

describeDevMoonbeam("Mock XCMP - test XCMP execution", (context) => {
  it("Should test DMP on_initialization and on_idle", async function () {
    const keyringEth = new Keyring({ type: "ethereum" });
    const alith = keyringEth.addFromUri(ALITH_PRIV_KEY, null, "ethereum");
    const metadata = await context.polkadotApi.rpc.state.getMetadata();
    const balancesPalletIndex = (metadata.asLatest.toHuman().pallets as Array<any>).find(
      (pallet) => {
        return pallet.name === "Balances";
      }
    ).index;
    let ownParaId = (await context.polkadotApi.query.parachainInfo.parachainId()) as any;

    let numMsgs = 50;
    // let's target half of then being executed

    // xcmp reserved is BLOCK/4
    let totalDmpWeight =
      context.polkadotApi.consts.system.blockWeights.maxBlock.toBigInt() / BigInt(4);

    // we want half of numParaMsgs to be executed. That should give us how much each message should wait
    let weightPerMessage = (totalDmpWeight * BigInt(2)) / BigInt(numMsgs);

    let weightPerXcmInst = 100_000_000n;
    // Now we need to construct the message. This needs to:
    // - pass barrier (withdraw + clearOrigin*n buyExecution)
    // - fail in buyExecution, so that the previous instruction weights are counted
    // we know at least 2 instructions are needed per message (withdrawAsset + buyExecution)
    // how many clearOrigins do we need to append?

    // we will bias this number. The reason is we want to test the decay, and therefore we need
    // an unbalanced number of messages executed. We specifically need that at some point
    // we get out of the loop of the execution (we reach the threshold limit), to then
    // go on idle

    // for that reason, we multiply times 2
    let clearOriginsPerMessage = (weightPerMessage - weightPerXcmInst * 2n) / weightPerXcmInst;

    let instructions = [];
    instructions.push({
      WithdrawAsset: [
        {
          id: {
            Concrete: {
              parents: 0,
              interior: {
                X1: { PalletInstance: balancesPalletIndex },
              },
            },
          },
          fun: { Fungible: 1 },
        },
      ],
    });

    // we push clear origins
    for (let i = 0; i < clearOriginsPerMessage; i++) {
      instructions.push({
        ClearOrigin: null,
      });
    }

    // we push the last buyExecution, that will fail
    instructions.push({
      BuyExecution: {
        fees: {
          id: {
            Concrete: {
              parents: 1,
              interior: {
                X2: [{ Parachain: ownParaId }, { PalletInstance: balancesPalletIndex }],
              },
            },
          },
          fun: { Fungible: 1 },
        },
        weightLimit: { Limited: new BN(20000000000) },
      },
    });

    let xcmMessage = {
      V2: instructions,
    };

    const receivedMessage: XcmVersionedXcm = context.polkadotApi.createType(
      "XcmVersionedXcm",
      xcmMessage
    ) as any;

    const totalMessage = [...receivedMessage.toU8a()];

    // We want these isntructions to fail in BuyExecution. That means
    // WithdrawAsset needs to work. The only way for this to work
    // is to fund each sovereign account
    const sovereignAddress = u8aToHex(
      new Uint8Array([...new TextEncoder().encode("Parent")])
    ).padEnd(42, "0");

    // We first fund the parent sovereign account with 1000
    // we will only withdraw 1, so no problem on this
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.balances.transfer(sovereignAddress, 1000n)
    );

    // now we start injecting messages
    // several
    for (let i = 0; i < numMsgs; i++) {
      await customWeb3Request(context.web3, "xcm_injectDownwardMessage", [totalMessage]);
    }

    await context.createBlock();

    const signedBlock = await context.polkadotApi.rpc.chain.getBlock();
    const apiAt = await context.polkadotApi.at(signedBlock.block.header.hash);
    const allRecords = await apiAt.query.system.events();
    let events = allRecords.map(({ event }) => `${event.section}.${event.method}.${event.data}`);

    console.log(events);
    // lets grab at which point the dmp queue was exhausted
    let index = events.findIndex((event) => {
      if (event.includes("dmpQueue.WeightExhausted.")) {
        return true;
      } else {
        return false;
      }
    });
    const eventsExecutedOnInitialization = events.slice(0, index + 1);
    const eventsExecutedOnIdle = events.slice(index + 1, events.length);

    // lets count
    let executedOnIdle = 0;
    let executedOnInitialization = 0;

    // OnInitialization
    eventsExecutedOnInitialization.forEach((e) => {
      if (e.toString().includes("notHoldingFees")) {
        executedOnInitialization += 1;
      }
    });

    // OnIdle
    eventsExecutedOnIdle.forEach((e) => {
      if (e.toString().includes("notHoldingFees")) {
        executedOnIdle += 1;
      }
    });

    // the test was designed to go half and half
    expect(executedOnInitialization).to.be.eq(25);
    expect(executedOnIdle).to.be.eq(25);
    let pageIndex = (await apiAt.query.dmpQueue.pageIndex()) as any;
    expect(pageIndex.beginUsed.toBigInt()).to.eq(0n);
    expect(pageIndex.endUsed.toBigInt()).to.eq(0n);
  });
});
