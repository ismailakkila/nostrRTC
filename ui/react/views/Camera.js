const React = require('react')
const { useRef, useEffect } = require('react')

const Camera = function(props) {
  const videoRef = useRef()
  const {
    videoId,
    videoMediaStream,
    pip,
    setPip,
    isLocal=true,
    reduceBrightness=false,
    draggable=false
  } = props

  useEffect(function() {
    const cleanUp = async function() {
      if (
        window.document.pictureInPictureElement &&
        window.document.pictureInPictureEnabled
      ) {
        await window.document.exitPictureInPicture()
        setPip(false)
        return
      }
    }
    return function() {
      cleanUp()
    }
  }, [])

  useEffect(function() {
    videoRef.current.srcObject = videoMediaStream
    if (!isLocal) {
      videoRef.current.addEventListener('enterpictureinpicture', function(e) {
        e.preventDefault()
        setPip(true)
      })

      videoRef.current.addEventListener('leavepictureinpicture', function(e) {
        e.preventDefault()
        setPip(false)
      })
    }
  }, [videoMediaStream])

  useEffect(function() {
    const togglePip = async function() {
      if (
        pip &&
        !window.document.pictureInPictureElement &&
        window.document.pictureInPictureEnabled
      ) {
        await videoRef.current.requestPictureInPicture()
        return
      }

      if (
        !pip &&
        window.document.pictureInPictureElement &&
        window.document.pictureInPictureEnabled
      ) {
        await window.document.exitPictureInPicture()
        return
      }
    }
    togglePip()
  }, [pip])




  if (isLocal) {
    return (
      <video
        style={
          draggable
            ? reduceBrightness
                ? styles.videoDraggableReduceBrightness
                : styles.videoDraggable
            : reduceBrightness
              ? styles.videoReduceBrightnessMirror
              : styles.videoMirror
        }
        ref={videoRef}
        id={videoId}
        playsInline
        autoPlay
        muted
      />
    )
  }
  else {
    return (
      <video
        style={
          reduceBrightness
            ? styles.videoReduceBrightness
            : styles.video
        }
        ref={videoRef}
        id={videoId}
        playsInline
        autoPlay
      />
    )
  }
}

const styles = {
  video: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1,
  },
  videoMirror: {
    WebkitTransform: 'scaleX(-1)',
    transform: 'scaleX(-1)',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1,
  },
  videoReduceBrightness: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1,
    filter: 'brightness(25%)'
  },
  videoReduceBrightnessMirror: {
    WebkitTransform: 'scaleX(-1)',
    transform: 'scaleX(-1)',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: -1,
    filter: 'brightness(25%)'
  },
  videoDraggable: {
    WebkitTransform: 'scaleX(-1)',
    transform: 'scaleX(-1)',
    width: '20vw',
    height: '11.25vw',
    borderRadius: '10px',
    objectFit: 'cover',
    zIndex: -1
  },
  videoDraggableReduceBrightness: {
    WebkitTransform: 'scaleX(-1)',
    transform: 'scaleX(-1)',
    width: '20vw',
    height: '11.25vw',
    borderRadius: '10px',
    objectFit: 'cover',
    zIndex: -1,
    filter: 'brightness(25%)'
  },
  videoPip: {
    width: '20vw',
    height: '11.25vw',
    borderRadius: '10px',
    objectFit: 'cover'
  }
}

module.exports = Camera
