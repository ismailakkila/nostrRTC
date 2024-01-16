const React = require('react')
const { useEffect, useState } = require('react')
const { Layout, Space } = require('antd')
const { Header, Content, Footer } = Layout
const { Transition } = require('react-transition-group')
const Draggable = require('react-draggable')

const Camera = require('./Camera.js')
const NoCamera = require('./NoCamera.js')
const SessionControls = require('./SessionControls.js')

const SessionConnect = function(props) {

  const { renderer, setFileTransferDrawer } = props

  const tracks = renderer.pc.getReceivers().map(function(recv) {
    return recv.track
  })
  const stream = new MediaStream()
  tracks.forEach(function(t) {
    stream.addTrack(t)
  }.bind(this))
  renderer.getStats()

  const [ showControls, setShowControls ] = useState(false)
  const [ reduceBrightness, setReduceBrightness ] = useState(false)
  const [ localStream, setLocalStream ] = useState(renderer.localStream)
  const [ remoteStream, setRemoteStream ] = useState(stream)
  const [ inboundVideoAvailable, setInboundVideoAvailable ] = useState(false)
  const [ pip, setPip ] = useState(false)

  const listeners = {
    handleSelectDevices: function() {
      setLocalStream(renderer.localStream)
    },
    sessionStats: function(stats) {
      const { data } = stats
      const inboundVideoStats = data.video.inbound[0]
      const inboundAudioStats = data.audio.inbound[0]
      const { bitrate, packetsReceived } = inboundVideoStats
      const tracks = renderer.pc.getReceivers().map(function(recv) {
        return recv.track
      })
      if (bitrate || packetsReceived) {
        const videoTracks = tracks.filter(function(t) {
          return t.kind === 'video'
        })
        if (
          videoTracks.length > 0 &&
          videoTracks[0].enabled &&
          !videoTracks[0].muted
        ) {
          setInboundVideoAvailable(true)
        }
        else {
          setInboundVideoAvailable(false)
        }
      }
      else {
        setInboundVideoAvailable(false)
      }
    }
  }

  useEffect(function() {
    renderer.on('handleSelectDevices', listeners.handleSelectDevices)
    renderer.on('sessionStats', listeners.sessionStats)
    return function() {
      renderer.removeListener('handleSelectDevices', listeners.handleSelectDevices)
      renderer.removeListener('sessionStats', listeners.sessionStats)
    }
  }, [])

  return (
    <>
      {
        inboundVideoAvailable
          ?
            <Camera
              videoId='remoteStream'
              videoMediaStream={remoteStream}
              pip={pip}
              setPip={setPip}
              isLocal={false}
            />
          :
            <NoCamera
              audioId='remoteStream'
              audioMediaStream={remoteStream}
              isLocal={false}
            />
      }
      <Layout
        style={styles.layout}
        onMouseEnter={function() { setShowControls(true) }}
        onMouseLeave={function() { setShowControls(false) }}
      >
        <Header style={styles.header}>
        </Header>
        <Content style={styles.content}>
        {
          (localStream && localStream.getVideoTracks().length > 0)
          ?
            (
              <Transition in={showControls} timeout={300}>
              {
                function(state) {
                  return (
                    <Draggable
                      bounds='html'
                    >
                      <div
                        style={{
                          ...styles.controlsAnimation[state],
                          position: 'absolute',
                          bottom: 0,
                          left: 0
                        }}
                      >
                        <Camera
                          videoId='localStream'
                          videoMediaStream={localStream}
                          draggable={true}
                          reduceBrightness={reduceBrightness}
                        />
                      </div>
                    </Draggable>
                  )
                }
              }
              </Transition>
            )
          : null
        }
        </Content>
        <Footer
          style={styles.footer}
        >
          <Transition in={showControls} timeout={300}>
          {
            function(state) {
              return (
                <Space
                  style={styles.controlsAnimation[state]}
                >
                  <SessionControls
                    pip={pip}
                    setPip={setPip}
                    inboundVideoAvailable={inboundVideoAvailable}
                    transeivers={renderer.pc.getTransceivers()}
                    localStream={localStream}
                    sessionDisconnect={renderer.sessionDisconnect.bind(renderer)}
                    setFileTransferDrawer={setFileTransferDrawer}
                    setReduceBrightness={setReduceBrightness}
                  />
                </Space>
              )
            }
          }
          </Transition>
        </Footer>
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
    height: '90vh'
  },
  header: {
    height: '10%',
    width: '90%',
    padding: 0,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center'
  },
  content: {
    height: '80%',
    width: '90%',
    padding: 0,
    backgroundColor: 'transparent'
  },
  footer: {
    height: '10%',
    width: '90%',
    padding: 0,
    backgroundColor: 'transparent',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  controlsAnimation: {
    entering: {
      transition: 'opacity 300ms ease-in-out',
      opacity: 1
    },
    entered:  {
      transition: 'opacity 300ms ease-in-out',
      opacity: 1
    },
    exiting:  {
      transition: 'opacity 300ms ease-in-out',
      opacity: 0
    },
    exited:  {
      transition: 'opacity 300ms ease-in-out',
      opacity: 0
    },
  }
}

module.exports = SessionConnect
