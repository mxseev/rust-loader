# The project is in low maintance now
Use [WasmPack](https://rustwasm.github.io/docs/wasm-pack/tutorials/hybrid-applications-with-webpack/index.html) instead

# Webpack Rust loader
Webpack loader for Rust

## Example
#### add.rs
```rust
#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```
#### huge_crate/Cargo.toml
```toml
[lib]
crate-type = ["cdylib"] # important
```
#### huge_crate/src/lib.rs
```rust
fn its_magic_number(x: i32) -> bool {
    x == 42
}
#[no_mangle]
pub fn plus_one(x: i32) -> i32 {
    if its_magic_number(x) { 420 } else { x + 1 }
}
```
#### main.js
```js
import add from "./add.rs"
import hugeCrate from "./huge_crate/Cargo.toml"

(async () => {
  const add = await add.then(buf => WebAssembly.instantiate(buf))
  const hugeCrate = await hugeCrate.then(buf => WebAssembly.instantiate(buf))

  console.log(add.instance.exports.add(1, 2)) // 3
  console.log(hugeCrate.instance.exports.plus_one(6)) // 7
  console.log(hugeCrate.instance.exports.plus_one(42)) // 420
})()
```

## Features
* Dont injects WASM to JS bundle, dynamic http fetching `.wasm` files via `file-loader`
* Hot module replacement

## Usage
1. Prepare system
    1. Install nightly Rust: `rustup update nightly`
    2. Install rustc wasm target: `rustup target add wasm32-unknown-unknown --toolchain nightly`
    3. Install [wasm-gc](https://github.com/alexcrichton/wasm-gc): `cargo install --git https://github.com/alexcrichton/wasm-gc --force`
2. Configure Webpack
    1. Install `rust-loader` and `file-loader`: `yarn add rust-loader file-loader --dev`
    2. Use it in Webpack config:
    ```js
    rules: [
      {
        test: /(\.rs$|Cargo.toml)/,
        loader: "rust-loader"
      },
      {
        test: /\.wasm$/,
        loader: "file-loader",
        type: "javascript/auto"
      }
    ]
    ```
