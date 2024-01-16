const EventEmitter = require('events')
const { Readable } = require('stream')
const sdpTransform = require('sdp-transform')
const b4a = require('b4a')
const assert = require('assert')
const uuid = require('uuid')
const { isJSON } = require('validator')

const UDPServer = require('./servers/udpServer.js')
const helpers = require('../utils/helpers.js')

const handlers = {
  handleRequest: async function(request) {
    const { data, method, path, requestId } = request
    switch(method) {
      case 'GET':
        switch(path) {
          default:
            this.send(helpers.generateResponse(requestId, 400))
        }
        break
      case 'POST':
        switch(path) {
          case '/api/session/notify':
            await this.handleSessionNotify(requestId, data)
            break
          case '/api/session/accept':
            this.handleSessionAccept(requestId, data)
            break
          case '/api/session/disconnect':
            this.handleSessionDisconnect(requestId, data)
            break
          default:
            this.send(helpers.generateResponse(requestId, 400))
        }
        break
      case 'PUT':
        switch(path) {
          default:
            this.send(helpers.generateResponse(requestId, 400))
        }
        break
      case 'DELETE':
        switch(path) {
          default:
            this.send(helpers.generateResponse(requestId, 400))
        }
        break
      default:
        this.send(helpers.generateResponse(requestId, 400))
    }
  },
  handleResponse: function(secretSocket, response) {
    this.emit('handleResponse', response)
  }
}

const readableListeners = {
  onError: function(err, type) {
    this.loggers.sessionLogger.error(
      `Session id: ${this.id} | ` +
      `error ${type}Readable | ` +
      `${err}`
    )
  }
}

const secretSocketListeners = {
  onData: async function(incomingData) {
    const dataJson = incomingData.toString()

    try {
      assert(isJSON(dataJson))
    }
    catch(err) {
      if (this.webrtcReadable.readable) {
        this.webrtcReadable.push(incomingData)
        return
      }
      this.loggers.sessionLogger.error(
        `Session id: ${this.id} | ` +
        `incomingData | ` +
        `invalid`
      )
      this.close()
      return
    }

    const dataObject = JSON.parse(dataJson)

    if (helpers.isRequest(dataObject)) {
      const { method, path, requestId, data } = dataObject
      this.loggers.sessionLogger.info(
        `Session id: ${this.id} | ` +
        `incomingData | ` +
        `requestId: ${requestId} ` +
        `method: ${method} ` +
        `path: ${path}`
      )
      await handlers.handleRequest.call(this, dataObject)
    }
    else if (helpers.isResponse(dataObject)) {
      const { status, requestId} = dataObject
      this.loggers.sessionLogger.info(
        `Session id: ${this.id} | ` +
        `incomingData | ` +
        `requestId: ${requestId} ` +
        `status: ${status}`
      )
      handlers.handleResponse.call(this, dataObject)
    }
    else {
      this.loggers.sessionLogger.error(
        `Session id: ${this.id} | ` +
        `incomingData | ` +
        `invalid`
      )
      this.close()
    }
  },
  onError: function(err) {
    this.loggers.sessionLogger.error(
      `Session id: ${this.id} | ` +
      `error secretSocket ${b4a.toString(
        this.secretSocket.remotePublicKey, 'hex'
      )} | ` +
      `${err}`
    )
  },
  onEnd: function() {
    this.loggers.sessionLogger.info(
      `Session id: ${this.id} | ` +
      `ended (all data read/ consumed) secretSocket ${b4a.toString(
        this.secretSocket.remotePublicKey, 'hex'
      )}`
    )
    this.secretSocket.end()
  },
  onFinish: function() {
    this.loggers.sessionLogger.info(
      `Session id: ${this.id} | ` +
      `finished (all data written/ flushed out) secretSocket ${b4a.toString(
        this.secretSocket.remotePublicKey, 'hex'
      )}`
    )
  },
  onClose: function() {
    this.loggers.sessionLogger.info(
      `Session id: ${this.id} | ` +
      `closed secretSocket ${b4a.toString(
        this.secretSocket.remotePublicKey, 'hex'
      )}`
    )
    this.secretSocket.removeAllListeners()
    this.close()
  }
}

class Session extends EventEmitter {
  constructor(secretSocket, options) {
    super()
    this.loggers = options.loggers
    this.id = uuid.v4()
    this.secretSocket = secretSocket
    this.webrtcReadable = new Readable({
      read: function() {}
    })
    this.loopbackServer = null
    this._closed = false
  }

  addReadableListeners() {
    this.webrtcReadable.on('error', function(err) {
      readableListeners.onError.call(this, err, 'webrtc')
    }.bind(this))
  }

  addSecretSocketListeners() {
    this.secretSocket.setMaxListeners(20)

    this.secretSocket.on('error', function(err) {
      secretSocketListeners.onError.call(this, err)
    }.bind(this))

    this.secretSocket.once('close', function() {
      secretSocketListeners.onClose.call(this)
    }.bind(this))

    this.secretSocket.once('end', function() {
      secretSocketListeners.onEnd.call(this)
    }.bind(this))

    this.secretSocket.once('finish', function() {
      secretSocketListeners.onFinish.call(this)
    }.bind(this))

    this.secretSocket
      .on('data', async function(data) {
        await secretSocketListeners.onData.call(this, data)
      }.bind(this))
  }

  init() {
    this.addReadableListeners()
    this.addSecretSocketListeners()
  }

  close() {
    if (!this._closed) {

      if (this.loopbackServer) {
        this.loopbackServer.push(null)
      }

      this.secretSocket.end()
      this.secretSocket.push(null)

      this.webrtcReadable.push(null)
      if (this.loopbackServer) {
        this.loopbackServer.end()
      }

      if (this.loopbackServer) {
        this.loopbackServer.close()
      }
      this.webrtcReadable.removeAllListeners()
      this.emit('close')
      this.removeAllListeners()
      this._closed = true
      this.loggers.sessionLogger.info(
        `Session id: ${this.id} | ` +
        `closed session`
      )
    }
  }

  verifyMessage(msg, nostrRTCPub, nostrPub) {
    if (nostrRTCPub !== b4a.toString(this.secretSocket.remotePublicKey, 'hex')) {
      return false
    }
    const sig = msg.sig
    const data = Object.assign(msg, {})
    delete data.sig
    return this.secretSocket.verify(
      sig,
      helpers.getObjectHash(data),
      nostrPub
    )
  }

  send(requestData) {
    const requestDataObj = JSON.parse(requestData)
    const { requestId, method='', path='', status='' } = requestDataObj
    this.secretSocket.write(requestData)
    let output =
      `Session id: ${this.id} | ` +
      `outgoingData | ` +
      `requestId: ${requestId} `

    if (helpers.isRequest(requestDataObj)) {
      output += `method: ${method} ` +
        `path: ${path}`
    }
    if (helpers.isResponse(requestDataObj)) {
      output += `status: ${status}`
    }
    this.loggers.sessionLogger.info(output)
    return requestId
  }

  startMediaPipelines() {
    this.webrtcReadable.pipe(this.loopbackServer)
    this.loopbackServer
      .pipe(this.secretSocket, { end: false })
    this.loggers.sessionLogger.info(
      `Session id: ${this.id} | ` +
      `mediaPipelines started`
    )
  }

  closeMediaPipelines() {
    this.webrtcReadable.push(null)
    if (this.loopbackServer) {
      this.loopbackServer.push(null)
    }
    this.loggers.sessionLogger.info(
      `Session id: ${this.id} | ` +
      `mediaPipelines closed`
    )
  }

  sessionNotify(params) {
    const reqJson = helpers.generateRequest(
      'POST',
      '/api/session/notify',
      params
    )
    return this.send(reqJson)
  }

  async sessionAccept(params) {
    const sdp = params.params.offer
    const candidates = this.getIceCandidates(sdp)
    this.loggers.sessionLogger.info(
      `remoteIceCandidates: ${JSON.stringify(candidates)}`
    )
    await this.createUdpServer(candidates[0].port)
    const reqJson = helpers.generateRequest(
      'POST',
      '/api/session/accept',
      params
    )
    return this.send(reqJson)
  }

  sessionDisconnect(params) {
    const reqJson = helpers.generateRequest(
      'POST',
      '/api/session/disconnect',
      params
    )
    return this.send(reqJson)
  }

  handleSessionNotify(requestId, msg) {
    const { source, destination } = msg
    if (source && destination) {
      const canHandle = (
        source.nostrRTCPub &&
        this.secretSocket.remote.nostrRTCPub === source.nostrRTCPub &&
        source.pub &&
        source.npub &&
        this.verifyMessage(msg, source.nostrRTCPub, source.pub) &&
        destination.nostrRTCPub &&
        destination.nostrRTCPub === this.secretSocket.user.nostrRTCPub &&
        destination.pub &&
        destination.pub === this.secretSocket.user.pub &&
        destination.npub &&
        destination.npub === this.secretSocket.user.npub
      )
      if (canHandle) {
        if (this.secretSocket.user.muteList.includes(source.pub)) {
          this.emit('reject', source.npub)
          this.send(helpers.generateResponse(requestId, 403))
          this.close()
          return
        }
        this.secretSocket.remote.pub = source.pub
        this.secretSocket.remote.npub = source.npub
        this.loggers.sessionLogger.info(
          `Session id: ${this.id} | ` +
          `handleSessionNotify | ` +
          `from nostrPubkey ${source.npub}`
        )
        this.emit('handleSessionNotify', msg)
        this.send(helpers.generateResponse(requestId, 200))
        return
      }
      this.send(helpers.generateResponse(requestId, 400))
      this.close()
    }
  }

  async handleSessionAccept(requestId, msg) {
    const { nostrRTCPub, pub, npub } = this.secretSocket.remote
    if (this.verifyMessage(msg, nostrRTCPub, pub)) {
      this.loggers.sessionLogger.info(
        `Session id: ${this.id} | ` +
        `handleSessionAccept | ` +
        `from nostrPubkey ${npub}`
      )
      const sdp = msg.params.answer
      const candidates = this.getIceCandidates(sdp)
      this.loggers.sessionLogger.info(`remoteIceCandidates: ${JSON.stringify(candidates)}`)
      await this.createUdpServer(candidates[0].port)
      this.emit('handleSessionAccept', msg)
      this.send(helpers.generateResponse(requestId, 200))
      return
    }
    this.send(helpers.generateResponse(requestId, 400))
    this.close()
  }

  handleSessionDisconnect(requestId, msg) {
    const { nostrRTCPub, pub, npub } = this.secretSocket.remote
    if (this.verifyMessage(msg, nostrRTCPub, pub)) {
      this.loggers.sessionLogger.info(
        `Session id: ${this.id} | ` +
        `handleSessionDisconnect | ` +
        `from nostrPubkey ${npub}`
      )
      this.emit('handleSessionDisconnect', msg)
      this.send(helpers.generateResponse(requestId, 200))
      this.close()
      return
    }
    this.send(helpers.generateResponse(requestId, 400))
    this.close()
  }

  async createUdpServer(listenPort) {
    this.loopbackServer = new UDPServer(
      listenPort,
      { logger: this.loggers.udpLogger }
    )
    await this.loopbackServer.init()
    this.startMediaPipelines()
  }

  getIceCandidates(sdp) {
    const candidates = []
    const sdpParsed = sdpTransform.parse(sdp)
    sdpParsed.media.forEach(function(m) {
      if (m.candidates) {
        m.candidates.forEach(function(c) {
          candidates.push(c)
        })
      }
    })
    return candidates
  }
}

module.exports = Session
