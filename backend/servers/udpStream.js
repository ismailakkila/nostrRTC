const dgram = require('dgram')
const { Duplex } = require('stream')

class StreamUDP extends Duplex {
  constructor() {
    super()
    this.socket = dgram.createSocket({ type: 'udp4' })
    this.should_read = true
    this.remote = null
    this.registerListeners()
  }

  bind(address, port, callback) {
    this.socket.bind(port, address, callback)
  }

  connect(address, port, callback) {
    this.socket.connect(port, address, callback)
  }

  registerListeners() {

    this.socket.on('message', function(data, rinfo) {
      if (this.should_read) {
        if (!this.remote) {
          const { address, port } = rinfo
          if (address === '127.0.0.1') {
            this.remote = { address, port }
            this.socket.connect(port, address)
          }
        }
        this.should_read = this.push(data)
      }
    }.bind(this))
  }

  _read() { this.should_read = true }

  _write(chunk, _encoding, callback) {
    try {
      this.socket.remoteAddress()
      this.socket.send(
        chunk,
        function(err, _bytes) {
          callback(null)
        }
      )
    }
    catch(err) {
      callback(null)
    }
  }
}

module.exports = StreamUDP
