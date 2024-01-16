const React = require('react')
const { useEffect, useState, useRef } = require('react')
const { ConfigProvider, App, message, notification, Row } = require('antd')

const SessionReady = require('./SessionReady.js')
const SessionNotify = require('./SessionNotify.js')
const HandleSessionNotify = require('./HandleSessionNotify.js')
const SessionConnect = require('./SessionConnect.js')
const FileNotifications = require('./FileNotifications.js')
const FileTransfer = require('./FileTransfer.js')

const Home = function(props) {
  const { rendererProp } = props
  const rendererRef = useRef()
  rendererRef.current = rendererProp
  const renderer = rendererRef.current

  const [ messageApi, messageContextHolder ] = message.useMessage()
  const [ notificationApi, notificationContextHolder ] = notification.useNotification()
  const [ component, setComponent ] = useState(null)
  const [ fileTransferUser, setFileTransferUser ] = useState('')
  const [ allowFileTransferDrawer, setAllowFileTransferDrawer ] = useState(false)
  const [ fileTransferDrawer, setFileTransferDrawer ] = useState(false)

  const listeners = {
    handleSessionError: function(msg) {
      messageApi.open({
        type: 'error',
        content: msg,
        duration: 5,
        style: {
          marginTop: '80vh',
        },
      })
    },
    handleSessionInfo: function(msg) {
      messageApi.open({
        type: 'info',
        content: msg,
        duration: 5,
        style: {
          marginTop: '80vh',
        },
      })
    },
    sessionReady: function() {
      notificationApi.destroy()
      setComponent('SessionReady')
    },
    sessionNotify: function() {
      const { params } = renderer._sessionNotify
      const { options } = params
      const { audio, video, data } = options
      if (data) {
        messageApi.open({
          type: 'info',
          content: 'Sent Request',
          duration: 5,
          style: {
            marginTop: '80vh',
          },
        })
        return
      }
      if (audio || video) {
        setComponent('SessionNotify')
        return
      }
    },
    handleSessionNotify: async function() {
      const { source, params } = renderer._handleSessionNotify
      const { options } = params
      const { audio, video, data } = options
      if (data) {
        notificationApi.info(
          await FileNotifications.handleSessionNotify(
            renderer._handleSessionNotify,
            function() {
              renderer.sessionAccept(
                renderer._handleSessionNotify,
                {audio: false, video: false, data: true}
              )
              notificationApi.destroy()
              setFileTransferDrawer(true)
            },
            function() {
              renderer.sessionDisconnect(renderer._handleSessionNotify)
            }
          )
        )
        return
      }
      if (audio || video) {
        setComponent('HandleSessionNotify')
        return
      }
    },
    sessionConnect: function() {
      setFileTransferUser(renderer.pc.remote)
      setAllowFileTransferDrawer(true)
      setComponent('SessionConnect')
    },
    sessionDisconnect: function() {
      setFileTransferDrawer(false)
      setAllowFileTransferDrawer(false)
      setComponent('SessionReady')
      notificationApi.destroy()
    },
    handleSessionDisconnect: function() {
      setFileTransferDrawer(false)
      setAllowFileTransferDrawer(false)
      setComponent('SessionReady')
      notificationApi.destroy()
    }
  }

  useEffect(function() {
    renderer.on('handleSessionError', listeners.handleSessionError)
    renderer.on('handleSessionInfo', listeners.handleSessionInfo)
    renderer.on('sessionReady', listeners.sessionReady)
    renderer.on('sessionNotify', listeners.sessionNotify)
    renderer.on('handleSessionNotify', listeners.handleSessionNotify)
    renderer.on('sessionConnect', listeners.sessionConnect)
    renderer.on('sessionDisconnect', listeners.sessionDisconnect)
    renderer.on('handleSessionDisconnect', listeners.handleSessionDisconnect)
    return function() {
      renderer.removeListener('handleSessionError', listeners.handleSessionError)
      renderer.removeListener('handleSessionInfo', listeners.handleSessionInfo)
      renderer.removeListener('sessionReady', listeners.sessionReady)
      renderer.removeListener('sessionNotify', listeners.sessionNotify)
      renderer.removeListener('handleSessionNotify', listeners.handleSessionNotify)
      renderer.removeListener('sessionConnect', listeners.sessionConnect)
      renderer.removeListener('sessionDisconnect', listeners.sessionDisconnect)
      renderer.removeListener('handleSessionDisconnect', listeners.handleSessionDisconnect)
    }
  }, [])

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#00b966',
          fontFamily: `-apple-system, BlinkMacSystemFont,
            "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell",
            "Fira Sans", "Droid Sans", "Helvetica Neue",
            sans-serif`
        }
      }}
    >
      {messageContextHolder}
      {notificationContextHolder}
      <App>
        <Row
          style={styles.draggable}
        />
        {
          allowFileTransferDrawer && (
            <FileTransfer
              renderer={renderer}
              fileTransferUser={fileTransferUser}
              setAllowFileTransferDrawer={setAllowFileTransferDrawer}
              fileTransferDrawer={fileTransferDrawer}
              setFileTransferDrawer={setFileTransferDrawer}
              sessionNotify={renderer.sessionNotify.bind(renderer)}
              sessionDisconnect={renderer.sessionDisconnect.bind(renderer)}
              sendFile={renderer.sendFile.bind(renderer)}
              abortFile={renderer.abortFile.bind(renderer)}
              getIncomingFiles={renderer.getIncomingFiles.bind(renderer)}
              getOutgoingFiles={renderer.getOutgoingFiles.bind(renderer)}
              isFile={renderer.isFile.bind(renderer)}
            />
          )
        }
        {
          component === 'SessionReady' &&
          <SessionReady
            renderer={renderer}
            setFileTransferUser={setFileTransferUser}
            setAllowFileTransferDrawer={setAllowFileTransferDrawer}
            setFileTransferDrawer={setFileTransferDrawer}
          />
        }
        {
          component === 'SessionNotify' &&
          <SessionNotify
            renderer={renderer}
          />
        }
        {
          component === 'HandleSessionNotify' &&
          <HandleSessionNotify
            renderer={renderer}
          />
        }
        {
          component === 'SessionConnect' &&
          <SessionConnect
            id='sessionConnect'
            renderer={renderer}
            setFileTransferDrawer={setFileTransferDrawer}
          />
        }
      </App>
    </ConfigProvider>
  )
}

const styles = {
  draggable: {
    width: '100%',
    height: '30px',
    WebkitAppRegion: 'drag'
  }
}

module.exports = Home
