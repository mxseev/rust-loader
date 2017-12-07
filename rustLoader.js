const {readdir, createReadStream, createWriteStream} = require("fs")
const {basename, extname, dirname, join, parse} = require("path")
const {tmpdir} = require("os")

const promisify = require("@octetstream/promisify")

const spawn = require("./spawn")

const assign = Object.assign

const copy = (src, dest) => new Promise((resolve, reject) => {
  createReadStream(src)
    .pipe(createWriteStream(dest))
    .on("error", reject)
    .on("finish", resolve)
})

const rd = promisify(readdir)

const wasmGC = filename => spawn("wasm-gc", [filename, filename])

const wrap = filename => (`
  module.exports = (() => {
    const wasm = require("${filename}")

    return fetch(wasm).then(r => r.arrayBuffer())
  })()
`)

const rustc = ({name, filename}) => new Promise((resolve, reject) => {
  const dest = `${join(tmpdir(), name)}.wasm`

  const onFulfilled = () => resolve(dest)

  return spawn("rustc", [
    "+nightly",
    "--target=wasm32-unknown-unknown",
    "--crate-type=cdylib",
    "-O",
    filename,
    "-o",
    dest
  ]).then(onFulfilled, reject)
})

const cargo = ({filename}, ctx) => new Promise((resolve, reject) => {
  const dest = `${join(tmpdir(), basename(dirname(filename)))}.wasm`

  const buildPath = join(
    dirname(filename), "target/wasm32-unknown-unknown/release"
  )

  const onCompiled = () => rd(buildPath)

  function onDir(files) {
    files = files.filter(file => extname(file) === ".wasm")

    if (files.length === 0) {
      return Promise.reject(
        new Error(`There are no any .wasm files at build path ${buildPath}`)
      )
    }

    return Promise.all(files.map(file => copy(join(buildPath, file), dest)))
  }

  function onFulfilled() {
    ctx.addContextDependency(join(dirname(filename), "src"))

    resolve(dest)
  }

  spawn("cargo", [
    "+nightly",
    "build",
    `--manifest-path=${filename}`,
    "--target=wasm32-unknown-unknown",
    "--release"
  ])
    .then(onCompiled)
    .then(onDir)
    .then(onFulfilled)
    .catch(reject)
})

const compilers = {
  rs: rustc,
  toml: cargo
}

function rustLoader() {
  const cb = this.async()

  const filename = this.resourcePath

  const path = assign({}, parse(filename), {filename})

  const compiler = compilers[path.ext.slice(1)]

  if (typeof compiler !== "function") {
    return cb(new Error(`Unsupported file extension: ${path.ext}`))
  }

  const onFulfilled = res => cb(null, wrap(res))

  compiler(path, this).then(wasmGC).then(onFulfilled).catch(cb)
}

module.exports = rustLoader
