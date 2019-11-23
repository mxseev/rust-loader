import {join} from "path"
import {tmpdir} from "os"
import test from "ava"
import build from "./_build.js"


const outDir = join(tmpdir(), "rust-loader-test")
const globalConfig = {
  output: {path: outDir},
  module: {
    rules: [
      {
        test: /(\.rs$|Cargo.toml)/,
        loader: join(__dirname, "../loader.js")
      },
      {
        test: /\.wasm$/,
        loader: "file-loader",
        options: {name: "[name].[ext]"},
        type: "javascript/auto"
      }
    ]
  }
}

test("load .rs file", async t => {
  const wasmFile = join(outDir, "add.wasm")
  const config = {
    ...globalConfig,
    entry: "./test/rust/add.rs"
  }

  const wasm = await build(config, wasmFile)
  const add = wasm.instance.exports.add
  t.is(add(40, 2), 42)
})

test("load Cargo.toml file", async t => {
  const wasmFile = join(outDir, "add_crate.wasm")
  const config = {
    ...globalConfig,
    entry: "./test/rust/add_crate/Cargo.toml"
  }

  const wasm = await build(config, wasmFile)
  const add = wasm.instance.exports.add
  t.is(add(40, 2), 42)
})

test("export fn", async t => {
  const wasmFile = join(outDir, "export.wasm")
  const config = {
    ...globalConfig,
    entry: "./test/rust/export.rs"
  }
  const imports = {
    env: {
      make_42: () => 42
    }
  }

  const wasm = await build(config, wasmFile, imports)
  const addTo42 = wasm.instance.exports.add_to_42
  t.is(addTo42(378), 420)
})
