const Main = require('./main.js')

const start = async function() {
  const main = new Main()
  await main.init()
}

start()
