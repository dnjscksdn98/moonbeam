import "@moonbeam-network/api-augment";
import { expect } from "chai";
import { blake2AsU8a, xxhashAsU8a } from "@polkadot/util-crypto";
import { BN, hexToU8a, u8aToHex } from "@polkadot/util";
import { u128 } from "@polkadot/types";
import type { PalletAssetsAssetAccount, PalletAssetsAssetDetails } from "@polkadot/types/lookup";
import type { AccountId20 } from "@polkadot/types/interfaces/runtime";
import { DevTestContext } from "./setup-dev-tests";
import type { KeyringPair } from "@substrate/txwrapper-core";
import { createBlockWithExtrinsic } from "./substrate-rpc";

export const RELAY_ASSET_SOURCE_LOCATION = { Xcm: { parents: 1, interior: "Here" } };
export const PARA_1000_SOURCE_LOCATION = {
  Xcm: { parents: 1, interior: { X1: { Parachain: 1000 } } },
};

interface AssetMetadata {
  name: string;
  symbol: string;
  decimals: BN;
  isFrozen: boolean;
}

const relayAssetMetadata: AssetMetadata = {
  name: "DOT",
  symbol: "DOT",
  decimals: new BN(12),
  isFrozen: false,
};

export async function mockAssetBalance(
  context: DevTestContext,
  assetBalance: PalletAssetsAssetAccount,
  assetDetails: PalletAssetsAssetDetails,
  sudoAccount: KeyringPair,
  assetId: u128,
  account: string | AccountId20,
  is_sufficient = false
) {
  // Register the asset
  await context.polkadotApi.tx.sudo
    .sudo(
      context.polkadotApi.tx.assetManager.registerForeignAsset(
        RELAY_ASSET_SOURCE_LOCATION,
        relayAssetMetadata,
        new BN(1),
        is_sufficient
      )
    )
    .signAndSend(sudoAccount);
  await context.createBlock();

  let assets = (await context.polkadotApi.query.assetManager.assetIdType(assetId)).toJSON();
  // make sure we created it
  expect(assets["xcm"]["parents"]).to.equal(1);

  // Get keys to modify balance
  let module = xxhashAsU8a(new TextEncoder().encode("Assets"), 128);
  let account_key = xxhashAsU8a(new TextEncoder().encode("Account"), 128);
  let blake2concatAssetId = new Uint8Array([
    ...blake2AsU8a(assetId.toU8a(), 128),
    ...assetId.toU8a(),
  ]);

  let blake2concatAccount = new Uint8Array([
    ...blake2AsU8a(hexToU8a(account.toString()), 128),
    ...hexToU8a(account.toString()),
  ]);
  let overallAccountKey = new Uint8Array([
    ...module,
    ...account_key,
    ...blake2concatAssetId,
    ...blake2concatAccount,
  ]);

  // Get keys to modify total supply
  let assetKey = xxhashAsU8a(new TextEncoder().encode("Asset"), 128);
  let overallAssetKey = new Uint8Array([...module, ...assetKey, ...blake2concatAssetId]);
  await context.polkadotApi.tx.sudo
    .sudo(
      context.polkadotApi.tx.system.setStorage([
        [u8aToHex(overallAccountKey), u8aToHex(assetBalance.toU8a())],
        [u8aToHex(overallAssetKey), u8aToHex(assetDetails.toU8a())],
      ])
    )
    .signAndSend(sudoAccount);
  await context.createBlock();
  return;
}

export interface RegisterLocalAssetOptions {
  name?: string;
  symbol?: string;
  decimals?: number;
  registrerAccount: KeyringPair;
  mints?: { account: KeyringPair | string; amount: bigint }[];
}

export async function registerLocalAssetWithMeta(
  context: DevTestContext,
  sudoAccount: KeyringPair,
  {
    name = "Local",
    symbol = "Local",
    decimals = 12,
    registrerAccount,
    mints = [],
  }: RegisterLocalAssetOptions
): Promise<{ assetId: string; assetAddress: string }> {
  const { events: eventsRegister } = await createBlockWithExtrinsic(
    context,
    sudoAccount,
    context.polkadotApi.tx.sudo.sudo(
      context.polkadotApi.tx.assetManager.registerLocalAsset(
        registrerAccount.address,
        registrerAccount.address,
        true,
        new BN(1)
      )
    )
  );

  // Look for assetId in events
  const assetId = eventsRegister
    .find(({ event: { section } }) => section.toString() === "assetManager")
    .event.data[0].toHex()
    .replace(/,/g, "");
  const assetAddress = u8aToHex(new Uint8Array([...hexToU8a("0xFFFFFFFE"), ...hexToU8a(assetId)]));

  // Set metadata
  await createBlockWithExtrinsic(
    context,
    registrerAccount,
    context.polkadotApi.tx.localAssets.setMetadata(assetId, name, symbol, new BN(decimals))
  );

  // mint accounts
  for (const { account, amount } of mints) {
    await createBlockWithExtrinsic(
      context,
      registrerAccount,
      context.polkadotApi.tx.localAssets.mint(
        assetId,
        typeof account == "string" ? account : account.address,
        amount
      )
    );
  }

  return {
    assetId,
    assetAddress,
  };
}
