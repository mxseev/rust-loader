import {readFile} from "fs"
import webpack from "webpack"
import promisify from "@octetstream/promisify"

const webpackPromise = promisify(webpack)
const readFilePromise = promisify(readFile)


const build = async (config, out, imports = {}) => {
  const stats = await webpackPromise(config)
  if (stats.hasErrors()) {
    const errors = stats.toJson().errors
    throw new Error(errors)
  }

  const buffer = await readFilePromise(out)
  const wasm = await WebAssembly.instantiate(buffer, imports)

  return wasm
}

export default build
