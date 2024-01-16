const React = require('react')
const { Card, Tooltip, Button, Divider } = require('antd')
const { Meta } = Card
const {
  PhoneFilled,
  VideoCameraFilled
} = require('@ant-design/icons')

const HandleSessionNotifyContact = function(props) {
  const { sessionParams, handleSessionAccept, handleSessionDisconnect } = props
  const { profile } = sessionParams.source
  const { description, pictureUrl, title } = profile

  const handleClickSessionAcceptAudioCall = function(e) {
    handleSessionAccept(sessionParams, {audio: true, video: false, data: false})
  }

  const handleClickSessionAcceptVideoCall = function(e) {
    handleSessionAccept(sessionParams, {audio: true, video: true, data: false})
  }

  const handleClickSessionDisconnect = function(e) {
    handleSessionDisconnect(sessionParams)
  }

  const actions = [
    (
      <Tooltip title='Answer Call (Audio)'>
        <Button
          style={styles.button}
          type='primary'
          icon={<PhoneFilled />}
          onClick={handleClickSessionAcceptAudioCall}
        />
      </Tooltip>
    ),
    (
      <Tooltip title='Answer Call (Video)'>
        <Button
          style={styles.button}
          type='primary'
          icon={<VideoCameraFilled />}
          onClick={handleClickSessionAcceptVideoCall}
        />
      </Tooltip>
    ),
    (
      <Tooltip title='Reject Call'>
        <Button
          style={styles.button}
          type='primary'
          onClick={handleClickSessionDisconnect}
          danger
        >
          Reject
        </Button>
      </Tooltip>
    )
  ]

  return (
    <Card
      style={styles.card}
      size='small'
      hoverable
      cover={
        pictureUrl
          ?
            <img
              style={styles.img}
              src={pictureUrl}
            />
          :
            <img
              style={styles.img}
              src={'./images/anon1.jpg'}
            />
      }
      actions={actions}
      bordered
    >
      <Meta
        title={
          <Tooltip title={sessionParams.source.npub}>
            {title}
          </Tooltip>
        }
        description={description}
      />
      <Divider />
      <h3>Incoming</h3>
    </Card>
  )
}

const styles = {
  card: {
    width: '280px',
    textAlign: 'center'
  },
  img: {
    height: '150px',
    objectFit: 'cover'
  },
  button: {
    width: '80%'
  }
}

module.exports = HandleSessionNotifyContact
