import {readdirSync, createReadStream, createWriteStream} from "fs"
import {dirname, basename, extname, join, parse} from "path"
import {spawn} from "child_process"
import {tmpdir} from "os"

// rustc wrapper
const rustc = (input, output) => new Promise((resolve, reject) => {
  const child = spawn("rustc", [
    "+nightly",
    "--target=wasm32-unknown-unknown",
    "--crate-type=cdylib",
    "-O",
    input,
    "-o",
    output
  ])

  child.on("close", code => {
    if (code !== 0) {
      reject(new Error(`rustc ended with non-zero code: ${code}`))
    } else {
      resolve()
    }
  })
})

// cargo wrapper
const cargo = (input, output) => new Promise((resolve, reject) => {
  const child = spawn("cargo", [
    "+nightly",
    "build",
    "--target=wasm32-unknown-unknown",
    "--release",
    `--manifest-path=${input}`
  ])

  child.on("close", code => {
    if (code !== 0) {
      reject(new Error(`Cargo ended with non-zero code: ${code}`))
    } else {
      const buildPath = join(
        dirname(input), "target/wasm32-unknown-unknown/release/"
      )

      // TODO: Replace this method with async version
      const buildFiles = readdirSync(buildPath)

      const wasmFiles = buildFiles
        .filter(filename => extname(filename) === ".wasm")

      if (wasmFiles.length === 0) {
        reject(new Error(`no one wasm file in cargo build dir: ${buildPath}`))
      } else {
        const wasmFile = join(buildPath, wasmFiles[0])
        createReadStream(wasmFile)
          .pipe(createWriteStream(output))
          .on("finish", resolve)
      }
    }
  })
})

// wasm-gc wrapper
const wasmGc = filename => new Promise((resolve, reject) => {
  const child = spawn("wasm-gc", [filename, filename])

  child.on("close", code => {
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

const rustLoader = async function() {
  const cb = this.async()

  const input = this.resourcePath
  const {name, ext} = parse(input)

  let output
  if (ext === ".rs") {
    output = join(tmpdir(), name)
  } else {
    output = join(tmpdir(), basename(dirname(input)))
  }

  output = `${output}.wasm`

  try {
    if (ext === ".rs") {
      await rustc(input, output)
    } else if (ext === ".toml") {
      await cargo(input, output)
      this.addContextDependency(join(input, "../src"))
    } else {
      throw new Error(`File type "${ext}" not supported`)
    }

    await wasmGc(output)

    cb(null, glue(output))
  } catch (err) {
    cb(err)
  }
}

export default rustLoader
