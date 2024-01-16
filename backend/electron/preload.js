const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mainApi', {
  rendererLogger: function(params) {
    ipcRenderer.send('rendererLogger', params)
  },
  setSelectedDevices: function(params) {
    ipcRenderer.send('setSelectedDevices', params)
  },
  setAvailableDevices: function(params) {
    ipcRenderer.send('setAvailableDevices', params)
  },
  setSecret: function(params) {
    ipcRenderer.send('setSecret', params)
  },
  setNwc: function(params) {
    ipcRenderer.send('setNwc', params)
  },
  deleteNwc: function(params) {
    ipcRenderer.send('deleteNwc', params)
  },
  rendererReady: function(params) {
    ipcRenderer.send('rendererReady', params)
  },
  rendererClosed: function(params) {
    ipcRenderer.send('rendererClosed', params)
  },
  sessionNotify: function(params) {
    ipcRenderer.send('sessionNotify', params)
  },
  sessionAccept: function(params) {
    ipcRenderer.send('sessionAccept', params)
  },
  sessionDisconnect: function(params) {
    ipcRenderer.send('sessionDisconnect', params)
  },
  handleRendererClose: function(cb) {
    ipcRenderer.on('handleRendererClose', cb)
  },
  handleSessionInfo: function(cb) {
    ipcRenderer.on('handleSessionInfo', cb)
  },
  handleSessionError: function(cb) {
    ipcRenderer.on('handleSessionError', cb)
  },
  handleSetUser: function(cb) {
    ipcRenderer.on('handleSetUser', cb)
  },
  handleSelectDevices: function(cb) {
    ipcRenderer.on('handleSelectDevices', cb)
  },
  handleRefreshDevices: function(cb) {
    ipcRenderer.on('handleRefreshDevices', cb)
  },
  handleSessionNotify: function(cb) {
    ipcRenderer.on('handleSessionNotify', cb)
  },
  handleSessionCreate: function(cb) {
    ipcRenderer.on('handleSessionCreate', cb)
  },
  handleSessionAccept: function(cb) {
    ipcRenderer.on('handleSessionAccept', cb)
  },
  handleSessionDisconnect: function(cb) {
    ipcRenderer.on('handleSessionDisconnect', cb)
  },
  handleSessionForbidden: function(cb) {
    ipcRenderer.on('handleSessionForbidden', cb)
  },
  getFileHash: async function(params) {
    return await ipcRenderer.invoke('getFileHash', params)
  },
  isFile: async function(params) {
    return await ipcRenderer.invoke('isFile', params)
  },
  isWssUrl: async function(params) {
    return await ipcRenderer.invoke('isWssUrl', params)
  },
  isNsec: async function(params) {
    return await ipcRenderer.invoke('isNsec', params)
  },
  isNwc: async function(params) {
    return await ipcRenderer.invoke('isNwc', params)
  },
  getNpubFromNsec: async function(params) {
    return await ipcRenderer.invoke('getNpubFromNsec', params)
  },
  getNpubFromPub: async function(params) {
    return await ipcRenderer.invoke('getNpubFromPub', params)
  },
  getSignature: async function(params) {
    return await ipcRenderer.invoke('getSignature', params)
  },
  getRemoteUser: async function(params) {
    return await ipcRenderer.invoke('getRemoteUser', params)
  },
  addRelay: async function(params) {
    return await ipcRenderer.invoke('addRelay', params)
  },
  removeRelay: async function(params) {
    return await ipcRenderer.invoke('removeRelay', params)
  },
  mutePub: async function(params) {
    return await ipcRenderer.invoke('mutePub', params)
  },
  unmutePub: async function(params) {
    return await ipcRenderer.invoke('unmutePub', params)
  },
  followPub: async function(params) {
    return await ipcRenderer.invoke('followPub', params)
  },
  unfollowPub: async function(params) {
    return await ipcRenderer.invoke('unfollowPub', params)
  },
  getZapParams: async function(params) {
    return await ipcRenderer.invoke('getZapParams', params)
  },
  getZapInvoice: async function(params) {
    return await ipcRenderer.invoke('getZapInvoice', params)
  },
  zap: async function(params) {
    return await ipcRenderer.invoke('zap', params)
  }
})
