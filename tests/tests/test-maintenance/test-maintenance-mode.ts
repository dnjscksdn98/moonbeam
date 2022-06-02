import "@moonbeam-network/api-augment";
import { expect } from "chai";
import { execFromAllMembersOfTechCommittee } from "../../util/governance";
import { Result } from "@polkadot/types";
import { SpRuntimeDispatchError } from "@polkadot/types/lookup";

import { describeDevMoonbeam } from "../../util/setup-dev-tests";
import { createBlockWithExtrinsic } from "../../util/substrate-rpc";
import { alith } from "../../util/accounts";

describeDevMoonbeam("Maintenance Mode - Entering Maintenance Mode", (context) => {
  it("should succeed with Technical Committee", async function () {
    const { events, successful } = await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
    expect(successful).to.be.true;
    expect(events[3].event.method).to.eq("EnteredMaintenanceMode");
    expect((await context.polkadotApi.query.maintenanceMode.maintenanceMode()).toHuman()).to.equal(
      true
    );
  });
});

describeDevMoonbeam("Maintenance Mode - Entering Maintenance Mode", (context) => {
  it("should fail with sudo", async function () {
    const { events } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
      )
    );
    expect((events[1].event.data[0] as Result<any, SpRuntimeDispatchError>).asErr.isBadOrigin).to.be
      .true;
  });
});

describeDevMoonbeam("Maintenance Mode - Entering Maintenance Mode", (context) => {
  it("should fail without sudo", async function () {
    const { error } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
    expect(error.name).to.eq("BadOrigin");
  });
});

describeDevMoonbeam("Maintenance Mode - Resuming normal operation", (context) => {
  before("entering maintenance mode", async function () {
    await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
      )
    );
  });

  it("should fail with sudo", async function () {
    const { events } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.sudo.sudo(
        context.polkadotApi.tx.maintenanceMode.resumeNormalOperation()
      )
    );
    expect((events[1].event.data[0] as Result<any, SpRuntimeDispatchError>).asErr.isBadOrigin).to.be
      .true;
  });
});

describeDevMoonbeam("Maintenance Mode - Resuming normal operation", (context) => {
  before("entering maintenance mode", async () => {
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
  });

  it("should fail without sudo", async function () {
    // and try to turn it off
    const { error } = await createBlockWithExtrinsic(
      context,
      alith,
      context.polkadotApi.tx.maintenanceMode.resumeNormalOperation()
    );
    expect(error.name).to.eq("BadOrigin");
    expect((await context.polkadotApi.query.maintenanceMode.maintenanceMode()).isTrue).to.be.true;
  });
});

describeDevMoonbeam("Maintenance Mode - Resuming normal operation", (context) => {
  before("entering maintenance mode", async () => {
    await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.enterMaintenanceMode()
    );
  });

  it("should succeed with council", async function () {
    const { events, successful } = await execFromAllMembersOfTechCommittee(
      context,
      context.polkadotApi.tx.maintenanceMode.resumeNormalOperation()
    );
    expect(successful).to.be.true;
    expect(events[3].event.method).to.eq("NormalOperationResumed");
    expect((await context.polkadotApi.query.maintenanceMode.maintenanceMode()).toHuman()).to.equal(
      false
    );
  });
});
