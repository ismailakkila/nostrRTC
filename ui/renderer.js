const uuid = require('uuid')
const EventEmitter = require('events')
const sdpTransform = require('sdp-transform')
const b4a = require('b4a')
const crypto = require('crypto')
const { mainApi, navigator } = window
const { WebRTCStats } = require('@peermetrics/webrtc-stats')

const fileWorker = new Worker('./fileWorker.js')

const SESSION_TIMEOUT = 30

const getUserMedia = (function () {
  if (navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  }
  if (navigator.getUserMedia) {
    return navigator.getUserMedia.bind(navigator)
  }
})()

const enumerateDevices = (function () {
  if (navigator.mediaDevices.enumerateDevices) {
    return navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
  }
  if (navigator.enumerateDevices) {
    return navigator.enumerateDevices.bind(navigator)
  }
})()

class Renderer extends EventEmitter {
  constructor(user=null) {
    super()
    this.logger = mainApi.rendererLogger
    this.id = uuid.v4()
    this.user = null
    this.pc = null
    this.availableDevices = {
      audio: new Map(),
      video: new Map()
    }
    this.selectedDevices = {
      audio: null,
      video: null
    }
    this.localStream = null
  }

  async setNsec(nsec) {
    const secret = await this.isNsec(nsec)
    if (secret) {
      this.logger({
        level: 'info',
        log: `setSecret change required: ${secret}/ ${nsec}`
      })
      mainApi.setSecret(secret)
      return true
    }
    return false
  }

  async setNwc(nwc) {
    const nwcSecret = await this.isNwc(nwc)
    if (nwcSecret) {
      this.logger({
        level: 'info',
        log: `setNwc change required: ${nwc}`
      })
      mainApi.setNwc(nwc)
      return true
    }
    return false
  }

  deleteNwc() {
    this.logger({
      level: 'info',
      log: `deleteNwc change required`
    })
    mainApi.deleteNwc()
  }

  async init() {
    await this.getDevices()
    let devices = {}
    if (this.availableDevices.audio.size > 0) {
      devices.audio = Array.from(this.availableDevices.audio.values())[0]
    }
    if (this.availableDevices.video.size > 0) {
      devices.video = Array.from(this.availableDevices.video.values())[0]
    }
    await this.selectDevices(devices)
    await this.getUserMedia()

    this.logger({
      level: 'info',
      log: `availableDevices: ${JSON.stringify({
        audio: Array.from(this.availableDevices.audio.values()),
        video: Array.from(this.availableDevices.video.values())
      })}`
    })

    this.logger({
      level: 'info',
      log: `selectedDevices: ${JSON.stringify(this.selectedDevices)}`
    })

    this.addRendererListeners()
    mainApi.rendererReady()

    this.logger({
      level: 'info',
      log: 'rendererReady'
    })

    this.once('handleSetUser', function() {
      this.emit('sessionReady', this)

      this.logger({
        level: 'info',
        log: 'sessionReady eventListener: event received'
      })
    }.bind(this))
  }

  addRendererListeners() {

    navigator.mediaDevices.ondevicechange = async function(e) {
      this.logger({
        level: 'info',
        log: 'mediaDevices eventListener: device change'
      })
      await this.getDevices()
      let devices = {}
      if (this.availableDevices.audio.size > 0) {
        devices.audio = Array.from(this.availableDevices.audio.values())[0]
      }
      if (this.availableDevices.video.size > 0) {
        devices.video = Array.from(this.availableDevices.video.values())[0]
      }

      await this.selectDevices(devices)
      await this.getUserMedia()
      this.emit('handleSelectDevices', this)
    }.bind(this)

    fileWorker.addEventListener('message', function(e) {
      this.logger({
        level: 'info',
        log: `fileWorker eventListener: ${JSON.stringify(e.data)}`
      })
      const { action, uid, url } = e.data
      switch(action) {
        case 'url':
          if (this.pc) {
            const channel = this.pc.dataChannels.get(uid)
            if (channel) {
              channel.file.url = url
              this.logger({
                level: 'info',
                log: `webrtc data channel fileTransfer url: ${channel.label} - ${channel.file.url}`
              })
              this.emit('incomingFileStatus', channel.file)
            }
          }
          break
      }
    }.bind(this))

    mainApi.handleRendererClose(function(e) {
      this.logger({
        level: 'info',
        log: 'handleRendererClose eventListener: event received'
      })
      this.close()
      mainApi.rendererClosed()
    }.bind(this))

    mainApi.handleSessionError(function(e, message) {
      this.logger({
        level: 'error',
        log: `handleSessionError eventListener: ${message}`
      })
      this.emit('handleSessionError', message)
    }.bind(this))

    mainApi.handleSessionInfo(function(e, message) {
      this.logger({
        level: 'info',
        log: `handleSessionInfo eventListener: ${message}`
      })
      this.emit('handleSessionInfo', message)
    }.bind(this))

    mainApi.handleSetUser(function(e, user) {
      this.logger({
        level: 'info',
        log: `handleSetUser eventListener: event received`
      })
      this.logger({
        level: 'debug',
        log: `handleSetUser eventListener: ${JSON.stringify(user)}}`
      })
      this.user = user
      this.emit('handleSetUser', this)
    }.bind(this))

    mainApi.handleSelectDevices(async function(e, devices) {
      this.logger({
        level: 'info',
        log: `handleSelectDevices eventListener: ${JSON.stringify(devices)}`
      })
      await this.getDevices()
      await this.selectDevices(devices)
      await this.getUserMedia()
      this.emit('handleSelectDevices', this)
    }.bind(this))

    mainApi.handleRefreshDevices(async function(e) {
      this.logger({
        level: 'info',
        log: `handleRefreshDevices eventListener: event received`
      })
      await this.getDevices()
      this.emit('handleRefreshDevices', this)
    }.bind(this))

    mainApi.handleSessionNotify(function(e, params) {
      this.logger({
        level: 'info',
        log: `handleSessionNotify eventListener: ${JSON.stringify({
          source: params.source,
          destination: params.destination,
          options: params.options
        })}`
      })
      this.logger({
        level: 'debug',
        log: `handleSessionNotify eventListener: ${JSON.stringify(params)}`
      })
      const canHandleSession = (
        this.pc === null
      )
      if (canHandleSession) {
        this._handleSessionNotify = params
        this.emit('handleSessionNotify', this)
      }
    }.bind(this))

    mainApi.handleSessionCreate(function(e, params) {
      this.logger({
        level: 'info',
        log: 'handleSessionCreate eventListener: event received'
      })
      this.emit('handleSessionCreate', this)
    }.bind(this))

    mainApi.handleSessionAccept(async function(e, params) {
      this.logger({
        level: 'info',
        log: `handleSessionAccept eventListener: ${JSON.stringify({
          source: params.source,
          destination: params.destination,
          options: params.params.options
        })}`
      })
      this.logger({
        level: 'debug',
        log: `handleSessionAccept eventListener: ${JSON.stringify(params)}`
      })
      const canHandleSession = (
        this.pc &&
        this.pc.signalingState === 'have-local-offer' &&
        ['new', 'connecting'].includes(this.pc.connectionState)
      )
      if (canHandleSession) {
        await this.pc.setRemoteDescription({
          type: 'answer',
          sdp: params.params.answer
        })
        this.emit('handleSessionAccept', this)
        this.emit('handleSessionInfo', 'Accepted')
        clearTimeout(this._sessionTimeout)
      }
    }.bind(this))

    mainApi.handleSessionDisconnect(async function(e, params) {
      this.logger({
        level: 'info',
        log: 'handleSessionDisconnect eventListener: event received'
      })
      if (this.pc) {
        this.destroyPeer()
      }
      this.emit('handleSessionDisconnect', this)
      this.emit('handleSessionInfo', 'Disconnected')
    }.bind(this))

    mainApi.handleSessionForbidden(async function(e, params) {
      this.logger({
        level: 'info',
        log: 'handleSessionForbidden eventListener: event received'
      })
      this.emit(
        'handleSessionError',
        `Rejected muted user ${params}`
      )
    }.bind(this))
  }

  async refreshPeer(type, options, offer=null) {
    this.destroyPeer()
    await this.createPeer(type, options, offer)
  }

  close() {
    this.destroyPeer()

    if (this.localStream) {
      this.localStream.getTracks().forEach(function(t) {
        t.stop()
        this.localStream.removeTrack(t)
      }.bind(this))
    }
    this.localStream = null
    this.availableDevices = {
      audio: new Map(),
      video: new Map()
    }
    this.selectedDevices = {
      audio: null,
      video: null
    }
    this.emit('close', this)
    this.removeAllListeners()
  }

  async getDevices() {
    let foundAudio = false
    let foundVideo = false
    try {
      await getUserMedia({
        audio: true,
      })
      foundAudio = true
    }
    catch(err) {
      this.logger({
        level: 'error',
        log: err.message
      })
      this.availableDevices['audio'].clear()
    }
    try {
      await getUserMedia({
        video: true
      })
      foundVideo = true
    }
    catch(err) {
      this.logger({
        level: 'error',
        log: err.message
      })
      this.availableDevices['video'].clear()
    }
    if (foundAudio || foundVideo) {
      const devices = await enumerateDevices()
      devices.forEach(function(d) {
        if (d.kind === 'audioinput' || d.kind === 'videoinput') {
          const type = d.kind.split('input')[0]
          this.availableDevices[type].set(d.deviceId, d.toJSON())
        }
      }.bind(this))
    }
    mainApi.setAvailableDevices(this.availableDevices)
  }

  async selectDevices(devices) {
    const { audio, video } = devices

    if (audio) {
      if (
        this.availableDevices.audio &&
        this.availableDevices.audio.has(audio.deviceId)
      ) {
        this.selectedDevices.audio = audio
      }
    }
    else {
      if (audio === null) {
        this.selectedDevices.audio = null
      }
    }

    if (video) {
      if (
        this.availableDevices.video &&
        this.availableDevices.video.has(video.deviceId)
      ) {
        this.selectedDevices.video = video
      }
    }
    else {
      if (video === null) {
        this.selectedDevices.video = null
      }
    }

    if (this.selectedDevices.audio) {
      const isCurrentSelectedAudioValid = this.availableDevices.audio.has(
        this.selectedDevices.audio.deviceId
      )
      if (!isCurrentSelectedAudioValid) {
        this.selectedDevices.audio = null
      }
    }

    if (this.selectedDevices.video) {
      const isCurrentSelectedVideoValid = this.availableDevices.video.has(
        this.selectedDevices.video.deviceId
      )
      if (!isCurrentSelectedVideoValid) {
        this.selectedDevices.video = null
      }
    }

    mainApi.setSelectedDevices(this.selectedDevices)
  }

  async getUserMedia() {
    const constraints = {}
    if (this.selectedDevices.audio) {
      Object.assign(constraints, {
        audio: {
          deviceId: this.selectedDevices.audio.deviceId
        }
      })
    }
    if (this.selectedDevices.video) {
      Object.assign(constraints, {
        video: {
          deviceId: this.selectedDevices.video.deviceId,
          width: {ideal: 1920},
          height: {ideal: 1080},
          aspectRatio: {ideal: 16/9}
        }
      })
    }
    if (Object.keys(constraints).length > 0) {
      this.localStream = await getUserMedia(constraints)
    }
    else {
      this.localStream = null
    }
  }

  async createPeer(type, options, offer=null) {
    const canCreatePeer = (
      this.pc === null
    )

    if (canCreatePeer) {
      this.pc = new RTCPeerConnection({
        bundlePolicy: 'max-bundle'
      })

      const { npub, pub, nostrRTCPub, profile } = this.user
      this.pc.user = {
        npub,
        pub,
        nostrRTCPub,
        profile
      }
      this.pc.options = options
      this.pc.dataChannels = new Map()
      this.addPeerListeners()

      if (type === 'offer') {

        const audioTransceiver = this.pc.addTransceiver(
          'audio', { direction: 'sendrecv' }
        )
        audioTransceiver.sender.replaceTrack(null)
        const videoTransceiver = this.pc.addTransceiver(
          'video', { direction: 'sendrecv' }
        )
        videoTransceiver.sender.replaceTrack(null)

        const mainDataChannel = this.pc.createDataChannel("main", {})
        this.pc.dataChannels.set('main', mainDataChannel)
        this.addDataChannelListenersMain()

        if (this.localStream) {
          this.localStream.getTracks().forEach(function(t) {
            if (t.kind === 'audio') {
              if (this.pc.options.audio) {
                t.enabled = true
                audioTransceiver.sender.replaceTrack(t)
              }
            }
            if (t.kind === 'video') {
              if (this.pc.options.video) {
                t.enabled = true
                videoTransceiver.sender.replaceTrack(t)
              }
            }
          }.bind(this))
        }

        await this.pc.setLocalDescription(await this.pc.createOffer())
        await this.iceGatheringStateComplete(5)
        this.logger({
          level: 'info',
          log: `webrtc localIceCandidates: ` +
            `${JSON.stringify(this.getIceCandidates('local'))}`
        })
      }

      if (type === 'answer') {
        const canHandle = (
          this.pc &&
          this.pc.signalingState === 'stable' &&
          this.pc.connectionState === 'new'
        )
        if (canHandle) {
          await this.pc.setRemoteDescription({type: 'offer', sdp: offer})

          let audioTracks = []
          let videoTracks = []
          if (this.localStream) {
            audioTracks = this.localStream.getAudioTracks()
            videoTracks = this.localStream.getVideoTracks()
          }

          this.pc.getTransceivers().forEach(function(tr) {
            tr.direction = 'sendrecv'
            tr.sender.replaceTrack(null)
            if (tr.mid === '0') {
              if (audioTracks.length > 0) {
                const audioTrack = audioTracks[0]
                if (this.pc.options.audio) {
                  tr.sender.replaceTrack(audioTrack)
                }

              }
            }
            if (tr.mid === '1') {
              if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0]
                if (this.pc.options.video) {
                  tr.sender.replaceTrack(videoTrack)
                }
              }
            }
          }.bind(this))
          await this.pc.setLocalDescription(await this.pc.createAnswer())
          await this.iceGatheringStateComplete(5)
          this.logger({
            level: 'info',
            log: `webrtc localIceCandidates: ` +
              `${JSON.stringify(this.getIceCandidates('local'))}`
          })
        }
      }
    }
  }

  destroyPeer() {
    this._sessionNotify = null
    this._handleSessionNotify = null
    if (this._sessionTimeout) {
      clearTimeout(this._sessionTimeout)
    }
    if (this.pc) {
      this.removeDataChannelListeners()
      this.closeDataChannels()
      this.removePeerListeners()
      this.pc.close()
      this.pc = null
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(function(t) {
        t.enabled = true
      })
    }
  }

  addPeerListeners() {

    this.pc.onicegatheringstatechange = function(e) {
      const { iceGatheringState } = e.target
      if (iceGatheringState === 'complete') {
        this.emit('iceGatheringStateComplete', this)
      }
    }.bind(this)

    this.pc.onconnectionstatechange = async function(e) {
      const { connectionState } = e.target
      this.logger({
        level: 'info',
        log: `webrtc connectionState: ${connectionState}`
      })
      if (connectionState === 'connected') {
        const tracks = this.pc.getReceivers().map(function(recv) {
          const { id, kind, enabled, labal, muted } = recv.track
          this.logger({
            level: 'info',
            log: `webrtc mediaTrack: ${JSON.stringify({
              id, kind, enabled, labal, muted
            })}`
          })
          return recv.track
        }.bind(this))

        let remoteStream = new MediaStream()
        tracks.forEach(function(t) {
          remoteStream.addTrack(t)
        }.bind(this))
        this.getStats()
        this.emit('sessionConnect', this)
        return
      }

      if (
        connectionState === 'closed' ||
        connectionState === 'disconnected' ||
        connectionState === 'failed'
      ) {
        await this.sessionDisconnect()
      }
    }.bind(this)

    this.pc.ondatachannel = function(e) {
      const { channel } = e
      this.pc.dataChannels.set(channel.label, channel)
      if (channel.label === 'main') {
        this.addDataChannelListenersMain()
      }
      else {
        this.pc.dataChannels.set(channel.label, channel)
        this.addDataChannelListenersIncoming(channel)
      }
    }.bind(this)

    this.pc.onsignalingstatechange = function(e) {
      const { signalingState } = e.target
      this.logger({
        level: 'info',
        log: `webrtc signalingState: ${this.pc.signalingState}`
      })
    }.bind(this)

    this.pc.onnegotiationneeded = function(e) {
      const { signalingState } = e.target
      this.logger({
        level: 'info',
        log: `webrtc onnegotiationneeded: signalingState - ${signalingState}`
      })
    }.bind(this)
  }

  removePeerListeners() {

    this.pc.removeEventListener(
      'icegatheringstatechange',
      this.pc.onicegatheringstatechange
    )

    this.pc.removeEventListener(
      'connectionstatechange',
      this.pc.onconnectionstatechange
    )

    this.pc.removeEventListener(
      'datachannel',
      this.pc.ondatachannel
    )

    this.pc.removeEventListener(
      'signalingstatechange',
      this.pc.onsignalingstatechange
    )

    this.pc.removeEventListener(
      'negotiationneeded',
      this.pc.onnegotiationneeded
    )

    this.stopStats()
  }

  addDataChannelListenersMain() {
    const channel = this.pc.dataChannels.get('main')
    channel.onopen = function(e) {
      this.logger({
        level: 'info',
        log: `webrtc data channel opened: ${channel.label}`
      })
    }.bind(this)

    channel.onclose = function(e) {
      this.logger({
        level: 'info',
        log: `webrtc data channel closed: ${channel.label}`
      })
    }.bind(this)

    channel.onerror = function(e) {
      this.logger({
        level: 'error',
        log: `webrtc data channel error: ${channel.label} - ${ e.error.message}`
      })
      channel.close()
    }.bind(this)
  }

  addDataChannelListenersOutgoing(channel, onChunk, onDone, onError) {

    const onChannelOpen = async function(e) {
      const channel = e.target
      const maxMessageSize = 64 * 1024
      this.logger({
        level: 'info',
        log: `webrtc data channel opened: ${channel.label}`
      })
      const { file } = channel
      file.hash = await this.getFileHash(file.path)
      this.logger({
        level: 'info',
        log: `webrtc data channel fileTransfer fileHash: ${channel.label} - ${file.hash}`
      })

      const { uid, name, hash, size } = file

      try {
        await channel.sendData(JSON.stringify({
          uid,
          name,
          hash,
          size
        }))
      }
      catch(err) {
        this.logger({
          level: 'error',
          log: `webrtc data channel fileTransfer error: ${channel.label} - ${err.message}`
        })
        onError(err)
        channel.close()
        return
      }

      file.sent = 0
      file.percent = 0
      const stream = file.stream()
      const reader = stream.getReader()
      let readObj = await reader.read()
      while (!readObj.done && readObj.value) {
        let offsetChunk = 0
        while (offsetChunk < readObj.value.byteLength) {
          const chunk = readObj.value.slice(
            offsetChunk,
            offsetChunk + maxMessageSize
          )
          try {
            await channel.sendData(chunk)
            offsetChunk += chunk.byteLength
          }
          catch(err) {
            this.logger({
              level: 'error',
              log: `webrtc data channel fileTransfer error: ${channel.label} - ${err.message}`
            })
            onError(err)
            channel.close()
            return
          }
        }
        const prevProgress = file.sent % (file.size / 100)
        file.sent += readObj.value.byteLength
        const currentProgress = file.sent % (file.size / 100)
        if (currentProgress < prevProgress) {
          file.percent = Number(((file.sent / file.size) * 100).toFixed(0))
          this.logger({
            level: 'info',
            log: `webrtc data channel fileTransfer progress: ${channel.label} - ${file.percent}%`
          })
          onChunk()
        }
        readObj = await reader.read()
      }
      if (file.sent === file.size) {
        await channel.bufferClear()
        this.logger({
          level: 'info',
          log: `webrtc data channel fileTransfer done: ${channel.label}`
        })
        onDone()
      }
      else {
        this.logger({
          level: 'error',
          log: `webrtc data channel fileTransfer error: ${channel.label} - file send bytes mismatch!`
        })
        onError(new Error('file send bytes mismatch!'))
        channel.close()
      }
    }.bind(this)


    const onChannelClose = function(e) {
      const channel = e.target
      this.logger({
        level: 'info',
        log: `webrtc data channel closed: ${channel.label}`
      })
    }.bind(this)

    const onChannelError = function(e) {
      const channel = e.target
      const error = e.error
      this.logger({
        level: 'error',
        log: `webrtc data channel error: ${channel.label} - ${ error.message}`
      })
      onError(error)
      channel.close()
    }.bind(this)

    const sendData = function(data) {
      return new Promise(function(resolve, reject) {
        if (this.bufferedAmount > this.bufferedAmountLowThreshold) {
          this.onbufferedamountlow = function() {
            this.onbufferedamountlow = null
            try {
              this.send(data)
              resolve(data.byteLength)
            }
            catch(err) {
              reject(err)
            }
          }.bind(this)
        }
        else {
          try {
            this.send(data)
            resolve(data.byteLength)
          }
          catch(err) {
            reject(err)
          }
        }
      }.bind(this))
    }.bind(channel)

    const bufferClear = function() {
      return new Promise(function(resolve, reject) {
        if (this.bufferedAmount > this.bufferedAmountLowThreshold) {
          this.onbufferedamountlow = function() {
            this.onbufferedamountlow = null
            resolve()
          }.bind(this)
        }
        else {
          resolve()
        }
      }.bind(this))
    }.bind(channel)

    channel.onopen = onChannelOpen
    channel.onclose = onChannelClose
    channel.onerror = onChannelError
    channel.sendData = sendData
    channel.bufferClear = bufferClear
  }

  addDataChannelListenersIncoming(channel) {

    const onChannelMessage = function(e) {
      if (e.data instanceof ArrayBuffer) {
        let chunk = e.data
        channel.file.calculatedHash = channel.file.calculatedHash.update(Buffer.from(chunk))
        const prevProgress = channel.file.recv % (channel.file.size / 100)
        channel.file.recv += chunk.byteLength
        const currentProgress = channel.file.recv % (channel.file.size / 100)
        if (currentProgress < prevProgress) {
          channel.file.percent = Number(
            ((channel.file.recv / channel.file.size) * 100).toFixed(0)
          )
          this.logger({
            level: 'info',
            log: `webrtc data channel fileTransfer progress: ${channel.label} - ${channel.file.percent}%`
          })
          this.emit('incomingFileProgress', channel.file)
        }
        fileWorker.postMessage({
          type: 'chunk',
          uid: channel.file.uid,
          chunk: chunk
        })
        if (channel.file.recv === channel.file.size) {
          if (channel.file.hash === channel.file.calculatedHash.digest('hex')) {
            channel.file.status = 'done'
            this.logger({
              level: 'info',
              log: `webrtc data channel fileTransfer done: ${channel.label}`
            })
            fileWorker.postMessage({
              type: 'done',
              uid: channel.file.uid
            })
          }
          else {
            channel.file.status = 'error'
            channel.file.error = 'transfer error'
            channel.file.response = 'transfer error'
            this.logger({
              level: 'error',
              log: `webrtc data channel fileTransfer error: ${channel.label} - fileHash mismatch!`
            })
          }
          this.emit('incomingFileStatus', channel.file)
          channel.close()
        }
        return
      }
      const fileMetadata = JSON.parse(e.data)
      channel.file = fileMetadata
      channel.file.recv = 0
      channel.file.percent = 0
      channel.file.status = 'uploading'
      channel.file.error = null
      channel.file.url = ''
      channel.file.calculatedHash = crypto.createHash('sha256')
      this.logger({
        level: 'info',
        log: `webrtc data channel fileTransfer fileMetadata: ${channel.label} - ${JSON.stringify({
          uid: channel.file.uid,
          name: channel.file.name,
          size: channel.file.size
        })}`
      })
      this.emit('incomingFileStatus', channel.file)
      fileWorker.postMessage({
        type: 'new',
        uid: channel.file.uid
      })
    }.bind(this)

    const onChannelClose = function(e) {
      const channel = e.target
      this.logger({
        level: 'info',
        log: `webrtc data channel closed: ${channel.label}`
      })
      if (channel.file.status === 'uploading') {
        channel.file.status = 'error'
        channel.file.error = 'transfer error'
        channel.file.response = 'transfer error'
        this.emit('incomingFileStatus', channel.file)
      }
    }.bind(this)

    const onChannelError = function(e) {
      const channel = e.target
      const error = e.error
      channel.file.status = 'error'
      channel.file.error = error.message
      channel.file.response = error.message
      this.logger({
        level: 'error',
        log: `webrtc data channel fileTransfer error: ${channel.label} - ${error.message}`
      })
      this.emit('incomingFileStatus', channel.file)
      channel.close()
    }.bind(this)

    channel.onmessage = onChannelMessage
    channel.onclose = onChannelClose
    channel.onerror = onChannelError
  }

  removeDataChannelListeners() {
    this.pc.dataChannels.forEach(function(channel) {
      this.pc.removeEventListener(
        'open',
        channel.onopen
      )
      this.pc.removeEventListener(
        'close',
        channel.onclose
      )
      this.pc.removeEventListener(
        'error',
        channel.onerror
      )
      this.pc.removeEventListener(
        'message',
        channel.onmessage
      )
    }.bind(this))
  }

  closeDataChannels() {
    this.pc.dataChannels.forEach(function(channel) {
      channel.close()
    })
  }

  getIceCandidates(type) {
    const candidates = []
    let sdp
    if (type === 'local') {
      sdp = this.pc.localDescription.sdp
    }
    if (type === 'remote') {
      sdp = this.pc.remoteDescription.sdp
    }
    if (sdp) {
      const sdpParsed = sdpTransform.parse(sdp)
      sdpParsed.media.forEach(function(m) {
        if (m.candidates) {
          m.candidates.forEach(function(c) {
            candidates.push(c)
          })
        }
      })
    }
    return candidates
  }

  getIceCandidatesFromSdp(sdp) {
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

  transformSdp() {
    const { type, sdp } = this.pc.localDescription
    const sdpParsed = sdpTransform.parse(sdp)
    sdpParsed.media.forEach(function(m) {
      if (m.candidates) {
        const filteredCandidates = m.candidates.filter(function(c) {
          return (
            c.transport.toLowerCase() === 'udp' &&
            c.type.toLowerCase() === 'host' &&
            c.ip === '127.0.0.1'
          )
        })
        m.candidates = filteredCandidates
      }
    })
    return sdpTransform.write(sdpParsed)
  }

  getStats(interval=1000) {
    if (this.pc && !this.stats) {
      this.stats = new WebRTCStats({
        getStatsInterval: interval
      })
      this.stats.addConnection({
        pc: this.pc,
        peerId: this.id
      })
      this.stats.on('stats', function(e) {
        this.emit('sessionStats', e)
      }.bind(this))
    }
  }

  stopStats() {
    if (this.stats) {
      this.stats.destroy()
      this.stats = null
    }
  }

  async iceGatheringStateComplete(t) {
    return new Promise(async function(resolve, reject) {

      const timeout = setTimeout(async function() {
        reject(new Error('ice gathering timeout!'))
      }.bind(this), t * 1000)

      this.once('iceGatheringStateComplete', async function() {
        clearTimeout(timeout)
        resolve()
      }.bind(this))

    }.bind(this))
  }

  async isWssUrl(url) {
    return await mainApi.isWssUrl(url)
  }

  async isNsec(nsec) {
    return await mainApi.isNsec(nsec)
  }

  async isNwc(nwc) {
    return await mainApi.isNwc(nwc)
  }

  async getNpubFromNsec(nsec) {
    return await mainApi.getNpubFromNsec(nsec)
  }

  async getNpubFromPub(pub) {
    return await mainApi.getNpubFromPub(pub)
  }

  async getRemoteUser(query) {
    const remoteUser = await mainApi.getRemoteUser(query)
    if (remoteUser) {
      this.logger({
        level: 'info',
        log: `getRemoteUser found: ${JSON.stringify(remoteUser)}`
      })
    }
    return remoteUser
  }

  async getSignature(msg) {
    return await mainApi.getSignature(msg)
  }

  async addRelay(r) {
    return await mainApi.addRelay(r)
  }

  async removeRelay(r) {
    return await mainApi.removeRelay(r)
  }

  async mutePub(pub) {
    return await mainApi.mutePub(pub)
  }

  async unmutePub(pub) {
    return await mainApi.unmutePub(pub)
  }

  async followPub(pub) {
    return await mainApi.followPub(pub)
  }

  async unfollowPub(pub) {
    return await mainApi.unfollowPub(pub)
  }

  async getZapParams(zapAddress) {
    return await mainApi.getZapParams(zapAddress)
  }

  async getZapInvoice(params) {
    return await mainApi.getZapInvoice(params)
  }

  async zap(invoice) {
    return await mainApi.zap(invoice)
  }

  async getFileHash(filePath) {
    return await mainApi.getFileHash(filePath)
  }

  async isFile(filePath) {
    return await mainApi.isFile(filePath)
  }

  async sendFile(file, onChunk, onDone, onError) {
    if (this.pc) {
      const channel = this.pc.createDataChannel(file.uid, {})
      channel.file = file
      this.pc.dataChannels.set(file.uid, channel)
      this.logger({
        level: 'info',
        log: `webrtc data channel fileTransfer fileMetadata: ${channel.label} - ${JSON.stringify({
          uid: file.uid,
          name: file.name,
          size: file.size,
          path: file.path
        })}`
      })
      this.addDataChannelListenersOutgoing(channel, onChunk, onDone, onError)
    }
  }

  abortFile(uid) {
    if (this.pc) {
      const channel = this.pc.dataChannels.get(uid)
      if (channel) {
        channel.close()
      }
    }
  }

  getIncomingFiles() {
    if (this.pc) {
      const dataChannels = Array.from(this.pc.dataChannels.values())
      const incomingDataChannels = dataChannels.filter(function(c) {
        return c.file && Object.hasOwn(c.file, 'recv') && !c.file.removed
      }.bind(this))
      const incomingFiles = incomingDataChannels.map(function(c) {
        return c.file
      }.bind(this))
      return incomingFiles
    }
    return []
  }

  getOutgoingFiles() {
    if (this.pc) {
      const dataChannels = Array.from(this.pc.dataChannels.values())
      const outgoingDataChannels = dataChannels.filter(function(c) {
        return c.file && Object.hasOwn(c.file, 'sent') && !c.file.removed
      }.bind(this))
      const outgoingFiles = outgoingDataChannels.map(function(c) {
        return c.file
      }.bind(this))
      return outgoingFiles
    }
    return []
  }

  async sessionNotify(remote, options) {
    if (remote.nostrRTCPub === this.user.nostrRTCPub) {
      this.logger({
        level: 'error',
        log: 'handleSessionError eventListener: Cannot start a session with yourself!'
      })
      this.emit('handleSessionError', 'Cannot start a session with yourself!')
      return
    }
    await this.refreshPeer('offer', options)
    if (this.pc) {
      this.pc.remote = remote
      const offerSdp = this.transformSdp()
      const msg = {
        source: this.pc.user,
        destination: this.pc.remote,
        params: {
          options: options,
          offer: offerSdp,
          answer: null
        }
      }
      const sig = await this.getSignature(msg)
      msg.sig = sig

      this.logger({
        level: 'info',
        log: `webrtc offer localIceCandidates: ` +
          `${JSON.stringify(this.getIceCandidatesFromSdp(offerSdp))}`
      })

      this.logger({
        level: 'info',
        log: `sessionNotify eventListener: ${JSON.stringify({
          source: msg.source,
          destination: msg.destination,
          params: {
            options: msg.params.options
          },
          sig: msg.sig
        })}`
      })
      this.logger({
        level: 'debug',
        log: `sessionNotify eventListener: ${JSON.stringify(msg)}`
      })

      mainApi.sessionNotify(msg)
      this._sessionNotify = msg
      this.emit('sessionNotify', this)
      this._sessionTimeout = setTimeout(function() {
          this.sessionDisconnect()
          this.logger({
            level: 'info',
            log: 'handleSessionInfo eventListener: No Response'
          })
          this.emit('handleSessionInfo', 'No Response')
      }.bind(this), 1000 * SESSION_TIMEOUT)
    }
  }

  async sessionAccept(data, options) {
    clearTimeout(this._sessionTimeout)
    const { source, destination, params } = data
    await this.refreshPeer('answer', options, params.offer)
    if (this.pc) {
      this.pc.remote = source
      const answerSdp = this.transformSdp()
      const msg = {
        action: 'sessionAccept',
        params: {
          options: options,
          offer: params.offer,
          answer: answerSdp,
        }
      }
      const sig = await this.getSignature(msg)
      msg.sig = sig

      this.logger({
        level: 'info',
        log: `webrtc answer localIceCandidates: ` +
          `${JSON.stringify(this.getIceCandidatesFromSdp(answerSdp))}`
      })

      this.logger({
        level: 'info',
        log: `sessionAccept eventListener: ${JSON.stringify({
          action: msg.action,
          params: {
            options: msg.params.options
          },
          sig: msg.sig
        })}`
      })
      this.logger({
        level: 'debug',
        log: `sessionAccept eventListener: ${JSON.stringify(msg)}`
      })

      mainApi.sessionAccept(msg)
      this.emit('sessionAccept', this)
    }
  }

  async sessionDisconnect() {
    clearTimeout(this._sessionTimeout)
    this.destroyPeer()
    const msg = {
      action: 'sessionDisconnect'
    }
    const sig = await this.getSignature(msg)
    msg.sig = sig
    this.logger({
      level: 'info',
      log: `sessionDisconnect eventListener: ${JSON.stringify(msg)}`
    })
    mainApi.sessionDisconnect(msg)
    this.emit('sessionDisconnect', this)
  }

}

module.exports = Renderer
