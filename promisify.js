const promisify = target => (...args) => new Promise((resolve, reject) => {
  const fulfill = (err, res) => err ? reject(err) : resolve(res)

  target(...args, fulfill)
})

module.exports = require("util").promisify || promisify
