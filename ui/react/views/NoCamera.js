const React = require('react')
const { useRef, useEffect } = require('react')

const NoCamera = function(props) {
  const audioRef = useRef()
  const {
    audioId,
    audioMediaStream=false,
    isLocal=true,
    reduceBrightness=false
  } = props

  useEffect(function() {
    if (audioMediaStream) {
      audioRef.current.srcObject = audioMediaStream
    }
  }, [audioMediaStream])

  if (isLocal) {
    return (
      <>
        {
          audioMediaStream && (
            <audio
              ref={audioRef}
              id={audioId}
              playsInline
              autoPlay
              muted
            />
          )
        }
        <video
          style={
            reduceBrightness
              ? styles.videoReduceBrightness
              : styles.video
          }
          src='./videos/no_camera.mp4'
          type='video/mp4'
          playsInline
          autoPlay
          muted
          loop
        />
      </>
    )
  }
  else {
    return (
      <>
        <audio
          ref={audioRef}
          id={audioId}
          playsInline
          autoPlay
        />
        <video
          style={
            reduceBrightness
              ? styles.videoReduceBrightness
              : styles.video
          }
          src='./videos/in_session.mp4'
          type='video/mp4'
          playsInline
          autoPlay
          loop
        />
      </>
    )
  }
}

const styles = {
  video: {
    position: 'fixed',
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1
  },
  videoReduceBrightness: {
    position: 'fixed',
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1,
    filter: 'brightness(25%)'
  }
}

module.exports = NoCamera
