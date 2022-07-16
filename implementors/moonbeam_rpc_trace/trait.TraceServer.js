(function() {var implementors = {};
implementors["moonbeam_rpc_trace"] = [{"text":"impl&lt;B, C&gt; <a class=\"trait\" href=\"moonbeam_rpc_trace/trait.TraceServer.html\" title=\"trait moonbeam_rpc_trace::TraceServer\">TraceServer</a> for <a class=\"struct\" href=\"moonbeam_rpc_trace/struct.Trace.html\" title=\"struct moonbeam_rpc_trace::Trace\">Trace</a>&lt;B, C&gt; <span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;B: BlockT&lt;Hash = H256&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/nightly/core/marker/trait.Send.html\" title=\"trait core::marker::Send\">Send</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/nightly/core/marker/trait.Sync.html\" title=\"trait core::marker::Sync\">Sync</a> + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;B::Header: HeaderT&lt;Number = <a class=\"primitive\" href=\"https://doc.rust-lang.org/nightly/std/primitive.u32.html\">u32</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;C: HeaderMetadata&lt;B, Error = BlockChainError&gt; + HeaderBackend&lt;B&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;C: <a class=\"trait\" href=\"https://doc.rust-lang.org/nightly/core/marker/trait.Send.html\" title=\"trait core::marker::Send\">Send</a> + <a class=\"trait\" href=\"https://doc.rust-lang.org/nightly/core/marker/trait.Sync.html\" title=\"trait core::marker::Sync\">Sync</a> + 'static,&nbsp;</span>","synthetic":false,"types":["moonbeam_rpc_trace::Trace"]}];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()