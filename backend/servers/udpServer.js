const StreamUDP = require('./udpStream.js')

class UDPServer extends StreamUDP {
  constructor(listenPort, options) {
    super()
    this.logger = options.logger
    this.listenPort = listenPort
  }

  async init() {
    return new Promise(function(resolve, reject) {
      try {
        this.socket.on('error', function(err) {
          this.logger.error(err.message)
        }.bind(this))

        this.socket.on('close', function() {
          this.logger.info(`stopped listening on 127.0.0.1:${this.listenPort}`)
          this.socket.removeAllListeners()
        }.bind(this))

        this.bind('127.0.0.1', this.listenPort, function() {
          this.listenPort = this.socket.address().port
          this.logger.info(
            `started listening on 127.0.0.1:${this.listenPort}`
          )
          resolve()
        }.bind(this))

      }
      catch(err) {
        this.logger.error(err.message)
        reject(err)
      }
    }.bind(this))
  }

  close() {
    this.socket.close()
    this.destroy()
  }
}

module.exports = UDPServer
