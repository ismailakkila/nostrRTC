const React = require('react')
const { useEffect, useState } = require('react')
const {
  AudioMutedOutlined,
  VideoCameraFilled,
  VideoCameraAddOutlined,
  CloseCircleFilled,
  UploadOutlined,
  ExportOutlined,
  ImportOutlined
} = require('@ant-design/icons')
const { Tooltip, Flex, Button } = require('antd')

const SessionControls = function(props) {
  const {
    pip,
    setPip,
    inboundVideoAvailable,
    transeivers,
    localStream,
    sessionDisconnect,
    setFileTransferDrawer,
    setReduceBrightness
  } = props

  const [ audio, setAudio ] = useState(true)
  const [ video, setVideo ] = useState(true)

  useEffect(function() {
    navigator.mediaSession.setActionHandler('togglemicrophone', handleToggleAudio)
    navigator.mediaSession.setActionHandler('togglecamera', handleToggleVideo)
    navigator.mediaSession.setActionHandler('hangup', sessionDisconnect)
    navigator.mediaSession.setMicrophoneActive(true)
    navigator.mediaSession.setCameraActive(true)
  }, [])

  useEffect(function() {
    transeivers.forEach(function(tr) {
      if (tr.mid === '0') {
        const s = tr.sender
        if (
          s.track &&
          s.track.kind === 'audio'
        ) {
          navigator.mediaSession.setMicrophoneActive(s.track.enabled)
          setAudio(s.track.enabled)
        }
        else {
          navigator.mediaSession.setMicrophoneActive(false)
          setAudio(false)
        }
      }

      if (tr.mid === '1') {
        const s = tr.sender
        if (
          s.track &&
          s.track.kind === 'video'
        ) {
          navigator.mediaSession.setCameraActive(s.track.enabled)
          setVideo(s.track.enabled)
          setReduceBrightness(false)
        }
        else {
          navigator.mediaSession.setCameraActive(false)
          setVideo(false)
          setReduceBrightness(true)
        }
      }
    })
  }, [transeivers])

  const handleToggleAudio = async function() {
    const audioTransceivers = transeivers.filter(function(tr) {
      return tr.mid === '0'
    })
    if (audioTransceivers.length > 0) {
      const s = audioTransceivers[0].sender
      if (
        s.track &&
        s.track.kind === 'audio'
      ) {
        await s.replaceTrack(null)
        navigator.mediaSession.setMicrophoneActive(false)
        setAudio(false)
        return
      }
      let audioTracks = []
      if (localStream) {
        audioTracks = localStream.getAudioTracks()
      }
      if (audioTracks.length > 0) {
        await s.replaceTrack(audioTracks[0])
        navigator.mediaSession.setMicrophoneActive(true)
        setAudio(true)
        return
      }
    }
  }

  const handleToggleVideo = async function() {
    const videoTransceivers = transeivers.filter(function(tr) {
      return tr.mid === '1'
    })
    if (transeivers.length > 0) {
      const s = videoTransceivers[0].sender
      if (
        s.track &&
        s.track.kind === 'video'
      ) {
        await s.replaceTrack(null)
        navigator.mediaSession.setCameraActive(false)
        setVideo(false)
        setReduceBrightness(true)
        return
      }
      let videoTracks = []
      if (localStream) {
        videoTracks = localStream.getVideoTracks()
      }
      if (videoTracks.length > 0) {
        await s.replaceTrack(videoTracks[0])
        navigator.mediaSession.setCameraActive(true)
        setVideo(true)
        setReduceBrightness(false)
        return
      }
    }
  }

  const handleToggleFileTransfer = function() {
    setFileTransferDrawer(true)
  }

  const handleTogglePip = function() {
    setPip(!pip)
  }

  return (
    <Flex gap='small'>
      <Tooltip title={ audio ? 'Mute Mic' : 'Unmute Mic' }>
        <Button
          style={ audio ? null : { backgroundColor: 'red' } }
          type='primary'
          shape='circle'
          size='large'
          icon={<AudioMutedOutlined />}
          onClick={handleToggleAudio}
        />
      </Tooltip>
      <Tooltip title={ video ? 'Mute Camera' : 'Unmute Camera' }>
        {
          video
          ?
            <Button
              type='primary'
              shape='circle'
              size='large'
              icon={<VideoCameraFilled />}
              onClick={handleToggleVideo}
            />
          :
            <Button
              style={{ backgroundColor: 'red' }}
              type='primary'
              shape='circle'
              size='large'
              icon={<VideoCameraAddOutlined />}
              onClick={handleToggleVideo}
            />
        }
      </Tooltip>
      <Tooltip title='File Transfer'>
        <Button
          type='primary'
          shape='circle'
          size='large'
          icon={<UploadOutlined />}
          onClick={handleToggleFileTransfer}
        />
      </Tooltip>
      {
        inboundVideoAvailable
          ? (
            <Tooltip
              title={pip ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'}
            >
              <Button
                type='primary'
                shape='circle'
                size='large'
                icon={ pip ? <ImportOutlined /> : <ExportOutlined /> }
                onClick={handleTogglePip}
              />
            </Tooltip>
          )
          : null
      }
      <Tooltip title='Hangup'>
        <Button
          style={{ backgroundColor: 'red' }}
          type='primary'
          shape='circle'
          size='large'
          icon={<CloseCircleFilled />}
          onClick={sessionDisconnect}
        />
      </Tooltip>
    </Flex>
  )
}

module.exports = SessionControls
