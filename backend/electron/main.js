const process = require('process')
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    Tray,
    nativeImage,
    nativeTheme,
    safeStorage,
    powerMonitor,
    powerSaveBlocker,
    Notification
} = require('electron')
const EventEmitter = require('events')
const path = require('path')
const si = require('systeminformation')
const fs = require('fs')
const os = require('os')

const {
  startLogger,
  getMainLogger,
  getBackendLogger,
  getSessionLogger,
  getDhtLogger,
  getUdpLogger,
  getNostrClientLogger,
  getRendererLogger,
  closeLoggers
} = require('../../utils/logger.js')
const Backend = require('../backend.js')

class Main extends EventEmitter {
  constructor() {
    super()
    this.app = app
    this.win = null
    const firstInstance = this.app.requestSingleInstanceLock()
    if (!firstInstance) {
      process.exit()
    }

    if (this.app.commandLine.hasSwitch("enableDebugLog")) {
      startLogger('DEBUG')
    }
    else {
      startLogger('INFO')
    }

    const mainLogger = getMainLogger()
    const backendLogger = getBackendLogger()
    const sessionLogger = getSessionLogger()
    const dhtLogger = getDhtLogger()
    const udpLogger = getUdpLogger()
    const nostrClientLogger = getNostrClientLogger()
    const rendererLogger = getRendererLogger()

    process.on('unhandledRejection', function (err) {
      mainLogger.error(err.message)
    }.bind(this))

    process.on('uncaughtException', function (err) {
      mainLogger.error(err.message)
    }.bind(this))

    this.logger = mainLogger
    this.rendererLogger = rendererLogger
    this.backend = new Backend({
      loggers: {
        backendLogger,
        sessionLogger,
        dhtLogger,
        udpLogger,
        nostrClientLogger
      }
    })
  }

  getAppIcon() {
    const isMac = os.platform() === "darwin"
    const isWindows = os.platform() === "win32"
    const isLinux = os.platform() === "linux"
    if (isMac) {
      return path.join(__dirname, '/images/appIcon.icns')
    }
    if (isWindows) {
      return path.join(__dirname, '/images/appIcon.ico')
    }
    if (isLinux) {
      return path.join(__dirname, '/images/appIcon.png')
    }
  }

  getUserDataFile(fileName) {
    try {
      const userDataPath = app.getPath('userData')
      const buffer = fs.readFileSync(
        path.join(userDataPath, fileName)
      )
      const fileContents = safeStorage.decryptString(buffer)
      return fileContents
    }
    catch(err) {
      return false
    }
  }

  setUserDataFile(fileName, fileContent) {
    try {
      const userDataPath = this.app.getPath('userData')
      const buffer = safeStorage.encryptString(fileContent)
      fs.writeFileSync(
        path.join(userDataPath, fileName),
        buffer
      )
      this.logger.info(
        `setUserDataFile - ${fileName} - result: success`
      )
      return true
    }
    catch(err) {
      this.logger.error(
        `setUserDataFile - ${fileName} - result: ${err.message}`
      )
      return false
    }
  }

  deleteUserDataFile(fileName) {
    try {
      const existing = this.getUserDataFile(fileName)
      if (existing) {
        const userDataPath = this.app.getPath('userData')
        fs.unlinkSync(
          path.join(userDataPath, fileName),
        )
        this.logger.info(
          `deleteUserDataFile - ${fileName} - result: success`
        )
        return true
      }
      return false
    }
    catch(err) {
      this.logger.error(
        `deleteUserDataFile - ${fileName} - result: ${err.message}`
      )
      return false
    }
  }

  init() {
    return new Promise(async function(resolve, reject) {
      try {
        const { virtual, serial, uuid } = await si.system()
        const isVirtual = Boolean(virtual || serial === '-' || !uuid)
        this.logger.info(`virtual machine: ${isVirtual}`)
        this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')

        this.createAppListeners()
        await this.app.whenReady()
        this.createProcessListeners()
        this.createIpcListeners()
        Menu.setApplicationMenu(null)

        this.logger.info(`userDataPath: ${app.getPath('userData')}`)
        let secret = this.getUserDataFile('secret.txt') || null
        let nwc = this.getUserDataFile('nwc.txt') || null
        let metadata = JSON.parse(this.getUserDataFile('metadata.txt')) || null
        let relayList = JSON.parse(this.getUserDataFile('relayList.txt')) || null

        if (secret) {
          this.logger.info('nsec key available')
        }
        else {
          this.logger.info('nsec key not available')
        }
        if (nwc) {
          this.logger.info('nostr wallet connect string available')
        }
        else {
          this.logger.info('nostr wallet connect string not available')
        }
        if (metadata) {
          this.logger.info('metadata available')
        }
        else {
          this.logger.info('metadata not available')
        }
        if (relayList) {
          this.logger.info('relayList available')
        }
        else {
          this.logger.info('relayList not available')
        }

        this.subscribeToBackendEvents()
        await this.backend.init(secret, nwc, metadata, relayList)

        if (!secret) {
          this.setUserDataFile('secret.txt', this.backend.getSecret())
        }
        this.setUserDataFile(
          'metadata.txt',
          JSON.stringify(this.backend.getMetadata())
        )
        this.setUserDataFile(
          'relayList.txt',
          JSON.stringify(this.backend.getRelayList())
        )

        this.createWindow()
        this.createWinListeners()
        this.createTray()

        this.emit('mainReady')
        this.logger.info('mainReady')
        resolve()
      }
      catch(err) {
        reject(err)
      }
    }.bind(this))
  }

  async createWindow() {
    nativeTheme.themeSource = 'dark'
    this.win = new BrowserWindow({
      menu: null,
      width: 854,
      height: 480,
      minWidth: 854,
      minHeight: 480,
      frame: false,
      roundedCorners: true,
      transparent: true,
      icon: this.getAppIcon(),
      webPreferences: {
        webPreferences: true,
        preload: path.join(__dirname, '/preload.js')
      }
    })
    this.win.setAspectRatio(16/9)
    this.win.setMenuBarVisibility(false)
    await this.win.loadFile(path.join(__dirname, '../../ui/index.html'))
    this.win.removeMenu()
    this.win
    .setMenu(null)
    this.win.webContents.session.setSpellCheckerEnabled(false)
    if (this.app.commandLine.hasSwitch("enableDebugLog")) {
      this.win.webContents.openDevTools({ mode: 'detach'})
    }
  }

  createTray() {
    const trayIcon = nativeImage.createFromPath(
      path.join(__dirname, '/images/taskbarIcon.png')
    )
    const tray = new Tray(trayIcon.resize({ width: 16 }))

    tray.on('click', function() {
      if (this.win) {
        this.win.webContents.send('handleRefreshDevices')
      }
    }.bind(this))

    const menuOptions = [
      {
        label: 'Show App',
        click: function() {
          this.win.show()
        }.bind(this)
      },
      {
        label: 'Quit',
        click: function() {
          this.app.quit()
        }.bind(this)
      }
    ]

    if (this.availableDevices && this.selectedDevices) {
      menuOptions.unshift({
        label: 'Device Settings',
        submenu: Menu.buildFromTemplate(
          [
            {
              label: 'Camera',
              submenu: Menu.buildFromTemplate(
                [{
                  label: 'No Camera',
                  type: 'radio',
                  checked: this.selectedDevices.video === null ? true : false,
                  click: function() {
                    this.win.webContents.send(
                      'handleSelectDevices',
                      Object.assign(this.selectedDevices, { video: null })
                    )
                  }.bind(this)
                }].concat(
                  Array.from(this.availableDevices.video.values()).map(function(d) {
                    return {
                      label: d.label,
                      type: 'radio',
                      checked: this.selectedDevices.video
                        ? this.selectedDevices.video.deviceId === d.deviceId
                        : false,
                      click: function() {
                        this.win.webContents.send(
                          'handleSelectDevices',
                          Object.assign(this.selectedDevices, { video: d })
                        )
                      }.bind(this)
                    }
                  }.bind(this))
                )
              )
            },
            {
              label: 'Mic',
              submenu: Menu.buildFromTemplate(
                [{
                  label: 'No Mic',
                  type: 'radio',
                  checked: this.selectedDevices.audio === null ? true : false,
                  click: function() {
                    this.win.webContents.send(
                      'handleSelectDevices',
                      Object.assign(this.selectedDevices, { audio: null })
                    )
                  }.bind(this)
                }].concat(
                  Array.from(this.availableDevices.audio.values()).map(function(d) {
                    return {
                      label: d.label,
                      type: 'radio',
                      checked: this.selectedDevices.audio
                        ? this.selectedDevices.audio.deviceId === d.deviceId
                        : false,
                      click: function() {
                        this.win.webContents.send(
                          'handleSelectDevices',
                          Object.assign(this.selectedDevices, { audio: d })
                        )
                      }.bind(this)
                    }
                }.bind(this)))
              )
            }
          ]
        )
      })
    }

    const contextMenu = Menu.buildFromTemplate(menuOptions)
    tray.setContextMenu(contextMenu)
    this.tray = tray
  }

  createAppListeners() {

    this.app.commandLine.appendSwitch(
      'enable-logging',
      'file'
    )

    this.app.commandLine.appendSwitch(
      'allow-loopback-in-peer-connection',
      'true'
    )

    this.app.on('activate', function() {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow()
        return
      }
      this.win.show()
    }.bind(this))

    this.app.once('quit', async function(e) {
      e.preventDefault()
      this.app.quit()
    }.bind(this))

    this.app.once('before-quit', async function(e) {
      e.preventDefault()
      await this.close()
    }.bind(this))

    this.app.once('web-contents-created', function(e) {
      if (BrowserWindow.getAllWindows().length > 1) {
        e.preventDefault()
      }
    }.bind(this))

    this.app.on('second-instance', function(event) {
      if (this.win) {
        this.win.show()
      }
    }.bind(this))

    powerMonitor.on('resume', function() {
      if (this.win) {
        this.win.webContents.send('handleRefreshDevices')
      }
    }.bind(this))

  }

  createWinListeners() {

    this.win.on('close', function(e) {
      e.preventDefault()
      this.win.hide()
    }.bind(this))

  }

  createIpcListeners() {

    ipcMain.on('rendererLogger', function(e, params) {
      const { level, log } = params
      this.rendererLogger[level](log)
    }.bind(this))

    ipcMain.on('rendererClosed', async function(params) {
      this.logger.info('rendererClosed - event received')
      await this.backend.close()
      ipcMain.removeAllListeners()
      this.removeAllListeners()
      closeLoggers()
      if (this.win) {
        this.win.destroy()
      }
    }.bind(this))

    ipcMain.on('setSelectedDevices', function(e, params) {
      this.selectedDevices = params
      if (this.tray) {
        this.tray.destroy()
      }
      this.createTray()
    }.bind(this))

    ipcMain.on('setAvailableDevices', function(e, params) {
      this.availableDevices = params
      if (this.tray) {
        this.tray.destroy()
      }
      this.createTray()
    }.bind(this))

    ipcMain.on('setSecret', async function(e, params) {
      await this.backend.close()
      let secret = params
      let nwc = this.getUserDataFile('nwc.txt') || null
      let metadata = JSON.parse(this.getUserDataFile('metadata.txt')) || null
      let relayList = JSON.parse(this.getUserDataFile('relayList.txt')) || null
      this.subscribeToBackendEvents()
      await this.backend.init(
        secret,
        nwc,
        metadata,
        relayList
      )
      this.setUserDataFile('secret.txt', this.backend.getSecret())
      this.setUserDataFile(
        'metadata.txt',
        JSON.stringify(this.backend.getMetadata())
      )
      this.setUserDataFile(
        'relayList.txt',
        JSON.stringify(this.backend.getRelayList())
      )
      this.win.webContents.send(
        'handleSetUser',
        this.backend.getOwnUser()
      )
    }.bind(this))

    ipcMain.on('setNwc', function(e, params) {
      this.backend.setNwc(params)
      this.setUserDataFile('nwc.txt', this.backend.getNwc())
      this.win.webContents.send(
        'handleSetUser',
        this.backend.getOwnUser()
      )
    }.bind(this))

    ipcMain.on('deleteNwc', function(e, params) {
      this.deleteUserDataFile('nwc.txt')
      this.backend.setNwc('')
      this.win.webContents.send(
        'handleSetUser',
        this.backend.getOwnUser()
      )
    }.bind(this))

    ipcMain.on('rendererReady', function(e, params) {
      this.win.webContents.send(
        'handleSetUser',
        this.backend.getOwnUser()
      )
    }.bind(this))

    ipcMain.on('sessionNotify', async function(e, params) {
      try {
        await this.backend.sessionNotify(params)
      }
      catch(err) {
        this.win.webContents.send('handleSessionError', err.message)
        this.win.webContents.send('handleSessionDisconnect')
      }
    }.bind(this))

    ipcMain.on('sessionAccept', async function(e, params) {
      try {
        await this.backend.sessionAccept(params)
      }
      catch(err) {
        this.win.webContents.send('handleSessionError', err.message)
        this.win.webContents.send('handleSessionDisconnect')
      }
    }.bind(this))

    ipcMain.on('sessionDisconnect', function(e, params) {
      try {
        this.backend.sessionDisconnect(params)
      }
      catch(err) {
        this.win.webContents.send('handleSessionError', err.message)
      }
    }.bind(this))

    ipcMain.handle('getFileHash', async function(e, params) {
      return await this.backend.getFileHash(params)
    }.bind(this))

    ipcMain.handle('isFile', function(e, params) {
      return this.backend.isFile(params)
    }.bind(this))

    ipcMain.handle('isWssUrl', function(e, params) {
      return this.backend.isWssUrl(params)
    }.bind(this))

    ipcMain.handle('isNsec', function(e, params) {
      return this.backend.isNsec(params)
    }.bind(this))

    ipcMain.handle('isNwc', function(e, params) {
      return this.backend.isNwc(params)
    }.bind(this))

    ipcMain.handle('getNpubFromNsec', function(e, params) {
      return this.backend.getNpubFromNsec(params)
    }.bind(this))

    ipcMain.handle('getNpubFromPub', function(e, params) {
      return this.backend.getNpubFromPub(params)
    }.bind(this))

    ipcMain.handle('getSignature', function(e, params) {
      return this.backend.getSignature(params)
    }.bind(this))

    ipcMain.handle('getRemoteUser', async function(e, params) {
      return await this.backend.getRemoteUser(params)
    }.bind(this))

    ipcMain.handle('addRelay', async function(e, params) {
      const result = await this.backend.addRelay(params)
      if (result) {
        this.setUserDataFile(
          'relayList.txt',
          JSON.stringify(this.backend.getRelayList())
        )
      }
      return result
    }.bind(this))

    ipcMain.handle('removeRelay', async function(e, params) {
      const result = await this.backend.removeRelay(params)
      if (result) {
        this.setUserDataFile(
          'relayList.txt',
          JSON.stringify(this.backend.getRelayList())
        )
      }
      return result
    }.bind(this))

    ipcMain.handle('mutePub', async function(e, params) {
      return await this.backend.mutePub(params)
    }.bind(this))

    ipcMain.handle('unmutePub', async function(e, params) {
      return await this.backend.unmutePub(params)
    }.bind(this))

    ipcMain.handle('followPub', async function(e, params) {
      return await this.backend.followPub(params)
    }.bind(this))

    ipcMain.handle('unfollowPub', async function(e, params) {
      return await this.backend.unfollowPub(params)
    }.bind(this))

    ipcMain.handle('getZapParams', async function(e, params) {
      return await this.backend.getZapParams(params)
    }.bind(this))

    ipcMain.handle('getZapInvoice', async function(e, params) {
      return await this.backend.getZapInvoice(params)
    }.bind(this))

    ipcMain.handle('zap', async function(e, params) {
      return await this.backend.zap(params)
    }.bind(this))

  }

  createProcessListeners() {

    process.on('SIGINT', function() {
      this.app.quit()
    }.bind(this))

    process.on('SIGTERM', async function() {
      this.app.quit()
    }.bind(this))

    process.on('SIGSEGV', async function() {
      this.app.quit()
    }.bind(this))
  }

  subscribeToBackendEvents() {

    this.backend.on('handleSessionNotify', function(params) {
      if (Notification.isSupported()) {
        const { profile } = params.source
        let sessionNotifyNotificationParams = {
          title: "Incoming",
          body: profile.title
        }
        const sessionNotifyNotification = new Notification(
          sessionNotifyNotificationParams
        )
        sessionNotifyNotification.once('click', function() {
          if (this.win) { this.win.show() }
        }.bind(this))
        sessionNotifyNotification.show()
      }
      if (this.win) {
        this.win.webContents.send('handleSessionNotify', params)
      }
    }.bind(this))

    this.backend.on('handleSessionCreate', function(params) {
      if (this.win) {
        this.win.webContents.send('handleSessionCreate', params)
      }
    }.bind(this))

    this.backend.on('handleSessionAccept', function(params) {
      if (this.win) {
        this.win.webContents.send('handleSessionAccept', params)
      }
    }.bind(this))

    this.backend.on('handleSessionReject', function(params) {
      if (this.win) {
        this.win.webContents.send('handleSessionReject', params)
      }
    }.bind(this))

    this.backend.on('handleSessionDisconnect', function(params) {
      if (this.win) {
        this.win.webContents.send('handleSessionDisconnect', params)
      }
    }.bind(this))

    this.backend.on('handleSessionForbidden', function(params) {
      if (this.win) {
        this.win.webContents.send('handleSessionForbidden', params)
      }
    }.bind(this))

    this.backend.on('handleNostrClientRelayListUpdate', function(params) {
      if (this.win) {
        this.win.webContents.send(
          'handleSetUser',
          this.backend.getOwnUser()
        )
      }
    }.bind(this))

    this.backend.on('handleNostrClientMuteListUpdate', function(params) {
      if (this.win) {
        this.win.webContents.send(
          'handleSetUser',
          this.backend.getOwnUser()
        )
      }
    }.bind(this))

    this.backend.on('handleNostrClientFollowListUpdate', function(params) {
      if (this.win) {
        this.win.webContents.send(
          'handleSetUser',
          this.backend.getOwnUser()
        )
      }
    }.bind(this))
  }

  async close() {
    if (powerSaveBlocker.isStarted(this.powerSaveBlockerId)) {
      powerSaveBlocker.stop(this.powerSaveBlockerId)
    }
    if (this.win) {
      this.win.webContents.send('handleRendererClose')
    }
  }

}

module.exports = Main
