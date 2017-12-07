const {spawn} = require("child_process")

const spawnPromise = (name, ...args) => new Promise((resolve, reject) => {
  const child = spawn(name, ...args)

  let stderr = ""

  function onStdErr() {
    const line = child.stderr.read()

    if (line != null) {
      stderr += line
    }
  }

  function onClose(code) {
    if (code === 0) {
      return resolve()
    }

    reject(new Error(`Process ${name} ended with non-zero code:\n${stderr}`))
  }

  child.stderr.on("readable", onStdErr)

  child
    .on("error", reject)
    .on("close", onClose)
})

module.exports = spawnPromise
