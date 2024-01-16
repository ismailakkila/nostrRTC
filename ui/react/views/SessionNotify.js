const React = require('react')
const { useEffect, useState } = require('react')
const { Layout, Space } = require('antd')
const { Content } = Layout
const { Transition } = require('react-transition-group')

const Camera = require('./Camera.js')
const NoCamera = require('./NoCamera.js')
const SessionNotifyContact = require('./SessionNotifyContact.js')

const SessionNotify = function(props) {
  const { renderer } = props
  const [ sessionCreate, setSessionCreate ] = useState(false)
  const [ localStream, setLocalStream ] = useState(renderer.localStream)

  const listeners = {
    handleSelectDevices: function() {
      setLocalStream(renderer.localStream)
    },
    handleSessionCreate: function() {
      setSessionCreate(true)
    },
  }

  useEffect(function() {
    renderer.on('handleSelectDevices', listeners.handleSelectDevices)
    renderer.on('handleSessionCreate', listeners.handleSessionCreate)
    return function() {
      renderer.removeListener('handleSelectDevices', listeners.handleSelectDevices)
      renderer.removeListener('handleSessionCreate', listeners.handleSessionCreate)
    }
  }, [])

  return (
    <>
      {
        localStream
          ? localStream.getVideoTracks().length > 0
            ?
              <Camera
                videoId='localStream'
                videoMediaStream={localStream}
              />
            :
              <NoCamera
                audioId='localStream'
                audioMediaStream={localStream}
              />
          :
            <NoCamera
              audioId='localStream'
            />
      }
      <Layout style={styles.layout}>
        <Content style={styles.content}>
          <Transition
            in={true}
            timeout={150}>
          {
            function(state) {
              return (
                <Space
                  style={styles.contactAnimation[state]}
                >
                  <SessionNotifyContact
                    remoteUser={renderer._sessionNotify.destination}
                    sessionCreate={sessionCreate}
                    handleSessionDisconnect={renderer.sessionDisconnect.bind(renderer)}
                  />
                </Space>
              )
            }
          }
          </Transition>
        </Content>
      </Layout>
    </>
  )
}

const styles = {
  layout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    height: '90vh',
  },
  content: {
    padding: 0,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAnimation: {
    entering: {
      transition: 'transform 150ms ease',
      transform: 'scale(0)'
    },
    entered:  {
      transition: 'transform 150ms ease',
      transform: 'scale(1)'
    },
    exiting:  {
      transition: 'transform 150ms ease',
      transform: 'scale(1)'
    },
    exited:  {
      transition: 'transform 150ms ease',
      transform: 'scale(0)'
    },
  }
}

module.exports = SessionNotify
