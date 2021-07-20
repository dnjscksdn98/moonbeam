// Copyright 2019-2021 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! # Parachain Staking Migrations
use crate::{
	Config,
	pallet::*,
};
use sp_runtime::{Perbill, traits::Zero};
use frame_support::weights::Weight;
use sp_std::prelude::*;
use frame_support::pallet;

mod deprecated {
	use crate::{
		pallet::*,
		set::OrderedSet,
	};
	use parity_scale_codec::{Decode, Encode};
	use sp_runtime::{traits::Zero};

	#[derive(Encode, Decode)]
	/// DEPRECATED nominator state
	pub struct OldNominator<AccountId, Balance> {
		pub nominations: OrderedSet<Bond<AccountId, Balance>>,
		pub total: Balance,
	}

	impl<AccountId: Ord, Balance: Zero> From<OldNominator<AccountId, Balance>>
		for Nominator<AccountId, Balance>
	{
		fn from(other: OldNominator<AccountId, Balance>) -> Nominator<AccountId, Balance> {
			Nominator {
				nominations: other.nominations,
				revocations: OrderedSet::new(),
				total: other.total,
				scheduled_revocations_count: 0u32,
				scheduled_revocations_total: Zero::zero(),
				status: NominatorStatus::Active,
			}
		}
	}
}

/// Storage migration for delaying nomination exits and revocations
pub fn delay_nominator_exits_migration<T: Config>() -> (Perbill, Weight) {
	use frame_support::migration::{StorageIterator, put_storage_value};

	// Migrate from old Nominator struct to our new one, which adds a few fields.

	let pallet_name = b"ParachainStaking";
	let storage_name = b"NominatorState";

	for (key, old_nominator) in StorageIterator::<deprecated::OldNominator<T::AccountId, BalanceOf<T>>>::new(pallet_name, storage_name).drain()
	{
		let new_nominator: Nominator<T::AccountId, BalanceOf<T>> = old_nominator.into();
		put_storage_value(pallet_name, storage_name, &key, &new_nominator);
	}

	// TODO: weight
	(Perbill::one(), 0u64.into())
}