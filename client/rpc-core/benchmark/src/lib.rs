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
use ethereum_types::U256;
use jsonrpc_core::Result as RpcResult;
use jsonrpc_derive::rpc;
use serde::Serialize;
use fc_rpc_core::types::{Bytes, CallRequest};

pub use rpc_impl_Benchmark::gen_server::Benchmark as BenchmarkServer;

#[derive(Default, Clone, PartialEq, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkResults {
	pub gas_used: U256,
	pub evm_execution_time_us: u64,
	pub evm_gas_per_sec: f64,
	pub evm_mil_gas_per_sec: f64,
	pub request_execution_time_us: u64,
	pub result: Option<Bytes>,
	pub error: Option<String>,
}

#[rpc(server)]
pub trait Benchmark {
	#[rpc(name = "benchmark_sendRawTransaction")]
	fn benchmark_raw_transaction(&self, _: Bytes) -> RpcResult<BenchmarkResults>;

	#[rpc(name = "benchmark_call")]
	fn benchmark_call(&self, request: CallRequest) -> RpcResult<BenchmarkResults>;
}