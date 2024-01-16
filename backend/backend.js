const b4a = require('b4a')
const assert = require('assert')
const EventEmitter = require('events')

const DHTServer = require('./servers/dhtServer.js')
const NostrClient = require('./nostrClient.js')
const Session = require('./session.js')
const helpers = require('../utils/helpers.js')

class Backend extends EventEmitter {
  constructor(options) {
    super()
    this.loggers = options.loggers
    this.nostrClient = null
    this.dhtServer = null
    this.session = null
  }

  getSecret() {
    return this.nostrClient.secret
  }

  getNwc() {
    return this.nostrClient.nwc
  }

  getMetadata() {
    return this.nostrClient.metadata
  }

  getRelayList() {
    return this.nostrClient.relayList
  }

  getMuteList() {
    return this.nostrClient.muteList.list
  }

  getFollowList() {
    return Array.from(this.nostrClient.followList.map.keys())
  }

  async addRelay(r) {
    return await this.nostrClient.addRelay(r)
  }

  async removeRelay(r) {
    return await this.nostrClient.removeRelay(r)
  }

  setNwc(nwc) {
    if (this.nostrClient) {
      this.nostrClient.nwc = nwc
    }
  }

  getOwnUser() {
    return this.nostrClient.getOwnUser()
  }

  async init(secret, nwc, metadata, relayList) {
    return new Promise(async function(resolve, reject) {
      try {

        if (this.nostrClient) { this.nostrClient.close() }
        this.nostrClient = new NostrClient(
          secret,
          nwc,
          metadata,
          relayList,
          { logger: this.loggers.nostrClientLogger }
        )
        await this.nostrClient.init()
        this.subscribeToNostrClientEvents()

        if (this.dhtServer) { this.dhtServer.close() }
        this.dhtServer = new DHTServer(
          this.getSecret(),
          { logger: this.loggers.dhtLogger}
        )
        await this.dhtServer.init()
        this.subscribeToDhtServerEvents()

        resolve()
      }
      catch(err) {
        this.loggers.backendLogger.error(err.message)
        reject(err)
      }
    }.bind(this))
  }

  async close() {
    if (this.session) { this.session.close() }
    if (this.dhtServer) { await this.dhtServer.close() }
    if (this.nostrClient) { this.nostrClient.close() }
    this.removeAllListeners()
  }

  subscribeToDhtServerEvents() {
    this.dhtServer.on('secretSocket', function(secretSocket) {
      this.loggers.dhtLogger.info(
        `incoming connection from ${b4a.toString(secretSocket.remotePublicKey, 'hex')}`
      )
      if (this.session) {
        this.loggers.dhtLogger.warn(
          `session id: ${this.session.id} already exists`
        )
        this.loggers.dhtLogger.info(
          `closing connection from ${b4a.toString(secretSocket.remotePublicKey, 'hex')}`
        )
        secretSocket.destroy()
      }
      else {
        secretSocket.user = this.nostrClient.getOwnUser()
        secretSocket.verify = this.nostrClient.verify
        secretSocket.remote = {
          nostrRTCPub: b4a.toString(secretSocket.remotePublicKey, 'hex')
        }
        this.session = new Session(
          secretSocket,
          {
            loggers: {
              sessionLogger: this.loggers.sessionLogger,
              udpLogger: this.loggers.udpLogger
            }
          }
        )
        this.subscribeToSessionEvents()
        this.session.init()
      }
    }.bind(this))
  }

  subscribeToSessionEvents() {
    this.session.on('close', function() {
      this.session = null
    }.bind(this))

    this.session.on('reject', function(params) {
      this.emit('handleSessionForbidden', params)
    }.bind(this))

    this.session.on('handleSessionNotify', function(params) {
      this.emit('handleSessionNotify', params)
    }.bind(this))

    this.session.on('handleSessionCreate', function(params) {
      this.emit('handleSessionCreate', params)
    }.bind(this))

    this.session.on('handleSessionAccept', function(params) {
      this.emit('handleSessionAccept', params)
    }.bind(this))

    this.session.on('handleSessionDisconnect', function(params) {
      this.emit('handleSessionDisconnect', params)
    }.bind(this))
  }

  subscribeToNostrClientEvents() {
    this.nostrClient.on('handleNostrClientRelayListUpdate', function(params) {
      this.emit('handleNostrClientRelayListUpdate', params)
    }.bind(this))

    this.nostrClient.on('handleNostrClientMuteListUpdate', function(params) {
      this.emit('handleNostrClientMuteListUpdate', params)
    }.bind(this))

    this.nostrClient.on('handleNostrClientFollowListUpdate', function(params) {
      this.emit('handleNostrClientFollowListUpdate', params)
    }.bind(this))
  }

  async sessionNotify(params) {
    try {
      const { source, destination } = params
      const secretSocket = await this.dhtServer.connect(
        destination.nostrRTCPub
      )
      secretSocket.user = this.nostrClient.getOwnUser()
      secretSocket.verify = this.nostrClient.verify
      secretSocket.remote = destination
      this.session = new Session(
        secretSocket,
        {
          loggers: {
            sessionLogger: this.loggers.sessionLogger,
            udpLogger: this.loggers.udpLogger
          }
        }
      )
      this.subscribeToSessionEvents()
      this.session.init()
      this.emit('handleSessionCreate')
      this.session.sessionNotify(params)
    }
    catch(err) {
      if (this.session) {
        this.session.close()
      }
      throw err
    }
  }

  async sessionAccept(params) {
    try {
      if (this.session) {
        await this.session.sessionAccept(params)
      }
    }
    catch(err) {
      if (this.session) {
        this.session.close()
      }
      throw err
    }
  }

  sessionDisconnect(params) {
    try {
      if (this.session) {
        this.session.sessionDisconnect(params)
        this.session.close()
      }
    }
    catch(err) {
      if (this.session) {
        this.session.close()
      }
      throw err
    }

  }

  async getFileHash(filePath) {
    return helpers.getFileHashAsync(filePath)
  }

  isFile(filePath) {
    return helpers.isFile(filePath)
  }

  isWssUrl(params) {
    return this.nostrClient.isWssUrl(params)
  }

  isNsec(params) {
    return this.nostrClient.isNsec(params)
  }

  isNwc(params) {
    return this.nostrClient.isNwc(params)
  }

  getNpubFromNsec(params) {
    return this.nostrClient.getNpubFromNsec(params)
  }

  getNpubFromPub(params) {
    return this.nostrClient.getNpubFromPub(params)
  }

  getSignature(params) {
    return this.nostrClient.sign(
      helpers.getObjectHash(params)
    )
  }

  async getRemoteUser(params) {
    return await this.nostrClient.getUser(params)
  }

  async mutePub(params) {
    return await this.nostrClient.mutePub(params)
  }

  async unmutePub(params) {
    return await this.nostrClient.unmutePub(params)
  }

  async followPub(params) {
    return await this.nostrClient.followPub(params)
  }

  async unfollowPub(params) {
    return await this.nostrClient.unfollowPub(params)
  }

  async getZapParams(params) {
    return await this.nostrClient.getZapParams(params)
  }

  async getZapInvoice(params) {
    return await this.nostrClient.getZapInvoice(params)
  }

  async zap(params) {
    return await this.nostrClient.zap(params)
  }
}

module.exports = Backend
