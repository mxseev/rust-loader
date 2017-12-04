import {readdir, createReadStream, createWriteStream} from "fs"
import {dirname, basename, extname, join, parse} from "path"
import {spawn} from "child_process"
import {tmpdir} from "os"

const spawnWrapper = (name, args) => new Promise((resolve, reject) => {
  const child = spawn(name, args)

  child.on("error", error => {
    reject(new Error(`${name} process error: ${error}`))
  })

  let stderr = ""
  child.stderr.on("data", data => {
    if (data) stderr += data
  })

  child.on("close", code => {
    if (code !== 0) {
      reject(new Error(`${name} ended with non-zero code: ${code}\n${stderr}`))
    } else {
      resolve()
    }
  })
})

const copy = (from, to) => new Promise((resolve, reject) => {
  createReadStream(from)
    .pipe(createWriteStream(to))
    .on("error", reject)
    .on("finish", resolve)
})

const readdirPromise = path => new Promise((resolve, reject) => {
  readdir(path, {}, (err, files) => {
    if (err) {
      reject(err)
    } else {
      resolve(files)
    }
  })
})

const rustc = (input, output) => spawnWrapper("rustc", [
  "+nightly",
  "--target=wasm32-unknown-unknown",
  "--crate-type=cdylib",
  "-O",
  input,
  "-o",
  output
])

const cargo = async (input, output) => {
  await spawnWrapper("cargo", [
    "+nightly",
    "build",
    `--manifest-path=${input}`,
    "--target=wasm32-unknown-unknown",
    "--release"
  ])

  const buildPath = join(
    dirname(input), "target/wasm32-unknown-unknown/release"
  )
  const buildFiles = await readdirPromise(buildPath)
  const wasmFiles = buildFiles.filter(file => extname(file) === ".wasm")
  if (wasmFiles.length === 0) {
    throw new Error(`no one wasm file in cargo build dir: ${buildPath}`)
  }

  const wasmFile = join(buildPath, wasmFiles[0])
  await copy(wasmFile, output)
}

const wasmGc = filename => spawnWrapper("wasm-gc", [filename, filename])

const glue = file => (`
  module.exports = (() => {
    const wasm = require("${file}")
    return fetch(wasm).then(r => r.arrayBuffer())
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
