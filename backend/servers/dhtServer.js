const DHT = require('hyperdht')
const b4a = require('b4a')
const assert = require('assert')
const EventEmitter = require('events')
const { isHexadecimal } = require('validator')
const { sha256 } = require('@noble/hashes/sha256')

class DHTServer extends EventEmitter {
  constructor(secret, options) {
    super()
    assert(isHexadecimal(secret))
    this.logger = options.logger
    this.keyPair = DHT.keyPair(Buffer.from(this.generateSeed(secret), 'hex'))
    const dht = new DHT({ keyPair: this.keyPair })
    this.dht = dht
  }

  generateSeed(secret) {
    const seed = new TextEncoder().encode(
      Buffer.concat([
        Buffer.from('nostrRTC:'),
        Buffer.from(secret, 'hex')
      ])
    )
    return b4a.toString(sha256(seed), 'hex')
  }

  async init() {
    this.server = this.dht.createServer(function(secretSocket) {
      this.emit('secretSocket', secretSocket)
    }.bind(this))
    await this.server.listen()
    const nostrRTCSecret = b4a.toString(this.keyPair.secretKey, 'hex')
    const nostrRTCPub = b4a.toString(this.keyPair.publicKey, 'hex')
    this.logger.info(`nostrRTC private key : ${nostrRTCSecret}`)
    this.logger.info(`nostrRTC public key : ${nostrRTCPub}`)
    this.logger.info(`started listening on ${nostrRTCPub}`)
  }

  async close() {
    if (this.server) {
      await this.server.close()
      const nostrRTCPub = b4a.toString(this.keyPair.publicKey, 'hex')
      this.logger.info(`stopped listening on ${nostrRTCPub}`)
    }
    this.removeAllListeners()
  }

  connect(publicKey, timeoutValue=10) {
    assert(this.server)
    return new Promise(async function(resolve, reject) {

      const timeout = setTimeout(function() {
        secretSocket.destroy()
        reject(new Error('dht connect timeout!'))
      }, timeoutValue * 1000)

      const secretSocket = this.dht.connect(b4a.from(publicKey, 'hex'))

      secretSocket.on('error', function(err) {
        secretSocket.destroy()
        reject(err)
      })

      secretSocket.on('open', function() {
        clearTimeout(timeout)
        console.log(
          `DHT server | ` +
          `connected to ${b4a.toString(secretSocket.remotePublicKey, 'hex')}`
        )
        resolve(secretSocket)
      }.bind(this))
    }.bind(this))
  }
}

module.exports = DHTServer
