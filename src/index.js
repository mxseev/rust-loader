import child_process from "child_process"
import os from "os"
import fs from "fs"
import path from "path"


// rustc wrapper
const rustc = (input, output) => new Promise((resolve, reject) => {
  const process = child_process.spawn("rustc", [
    "+nightly",
    "--target=wasm32-unknown-unknown",
    "--crate-type=cdylib",
    "-O",
    input,
    "-o",
    output
  ])

  process.on("close", code => {
    if (code !== 0) {
      reject(new Error(`rustc ended with non-zero code: ${code}`))
    } else {
      resolve()
    }
  })
})

// cargo wrapper
const cargo = (input, output) => new Promise((resolve, reject) => {
  const process = child_process.spawn("cargo", [
    "+nightly",
    "build",
    "--target=wasm32-unknown-unknown",
    "--release",
    `--manifest-path=${input}`
  ])

  process.on("close", code => {
    if (code !== 0) {
      reject(new Error(`cargo ended with non-zero code: ${code}`))
    } else {
      const buildPath = path.join(path.dirname(input), "target/wasm32-unknown-unknown/release/")
      const buildFiles = fs.readdirSync(buildPath)
      const wasmFiles = buildFiles.filter(filename => path.extname(filename) === ".wasm")
      if (wasmFiles.length === 0) {
        reject(new Error(`no one wasm file in cargo build dir: ${buildPath}`))
      } else {
        const wasmFile = path.join(buildPath, wasmFiles[0])
        fs.createReadStream(wasmFile).pipe(fs.createWriteStream(output)).on("finish", resolve)
      }
    }
  })
})

// wasm-gc wrapper
const wasmGc = filename => new Promise((resolve, reject) => {
  const process = child_process.spawn("wasm-gc", [filename, filename])

  process.on("close", code => {
    if (code !== 0) {
      reject(new Error(`wasm-gc ended with non-zero code: ${code}`))
    } else {
      resolve()
    }
  })
})

const glue = file => (`
  module.exports = (() => {
    const wasm = require("${file}")
    return fetch(wasm)
      .then(r => r.arrayBuffer())
      .then(bytes => WebAssembly.instantiate(bytes))
  })()
`)

const rustLoader = async function(content) {
  const webpackCb = this.async()
  const input = this.resourcePath
  let {name, ext} = path.parse(input)

  let output
  if (ext === ".rs") {
    output = path.join(os.tmpdir(), name)
  } else {
    output = path.join(os.tmpdir(), path.basename(path.dirname(input)))
  }
  output = `${output}.wasm`

  try {
    if (ext === ".rs") {
      await rustc(input, output)
    } else if (ext === ".toml") {
      await cargo(input, output)
      this.addContextDependency(path.join(input, "../src"))
    } else {
      throw new Error(`File type "${ext}" not supported`)
    }
    await wasmGc(output)
    webpackCb(null, glue(output))
  } catch (e) {
    webpackCb(e)
  }
}

export default rustLoader
