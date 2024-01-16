const React = require('react')
const { Card, Tooltip, Button, Divider } = require('antd')
const { Meta } = Card

const SessionNotifyContact = function(props) {
  const { remoteUser, sessionCreate, handleSessionDisconnect } = props
  const { profile } = remoteUser
  const { description, pictureUrl, title } = profile

  const handleClickSessionDisconnect = function(e) {
    handleSessionDisconnect()
  }

  const actions = [(
    <Tooltip title='Cancel Session'>
      <Button
        type='primary'
        onClick={handleClickSessionDisconnect}
        disabled={!sessionCreate}
      >
        Cancel
      </Button>
  </Tooltip>
  )]

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
          <Tooltip title={remoteUser.npub}>
            {title}
          </Tooltip>
        }
        description={description}
      />
      <Divider />
      <h3>Outgoing</h3>
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
  }
}

module.exports = SessionNotifyContact
