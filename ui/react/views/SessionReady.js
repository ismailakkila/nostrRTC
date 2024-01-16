const React = require('react')
const { useEffect, useState } = require('react')
const { Layout, Space, Col, Row, Card, Avatar, Button } = require('antd')
const { UserOutlined, ContactsOutlined } = require('@ant-design/icons')
const { Header, Content } = Layout
const { Transition } = require('react-transition-group')
const { Meta } = Card

const GetProfile = require('./GetProfile.js')
const Camera = require('./Camera.js')
const NoCamera = require('./NoCamera.js')
const Contact = require('./Contact.js')
const FollowList = require('./FollowList.js')
const Settings = require('./Settings.js')

const SessionReady = function(props) {
  const {
    renderer,
    setFileTransferUser,
    setAllowFileTransferDrawer,
    setFileTransferDrawer
  } = props
  const [ openSettings, setOpenSettings ] = useState(false)
  const [ openFollowList, setOpenFollowList ] = useState(false)
  const [ user, setUser ] = useState(renderer.user)
  const [ localStream, setLocalStream ] = useState(renderer.localStream)
  const [ showContact, setShowContact ] = useState(false)
  const [ remoteUser, setRemoteUser ] = useState(null)
  const { title, description, pictureUrl } = renderer.user.profile

  const listeners = {
    handleSelectDevices: function() {
      setLocalStream(renderer.localStream)
    },
    handleSetUser: function() {
      setUser(renderer.user)
    }
  }

  useEffect(function() {
    renderer.on('handleSelectDevices', listeners.handleSelectDevices)
    renderer.on('handleSetUser', listeners.handleSetUser)
    return function() {
      renderer.removeListener('handleSelectDevices', listeners.handleSelectDevices)
      renderer.removeListener('handleSetUser', listeners.handleSetUser)
    }
  }, [])

  const handleFollowListOnClick = function() {
    setOpenFollowList(true)
  }

  const handleSettingsOnClick = function() {
    setOpenSettings(true)
  }

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
        <Header style={styles.header}>
          <Row
            style={styles.row}
            justify='center'
            align='middle'
          >
            <Col
              style={Object.assign(styles.col, {justifyContent: 'flex-start'})}
              span={3}
            >
            </Col>
            <Col span={18}>
              <GetProfile
                getRemoteUser={renderer.getRemoteUser.bind(renderer)}
                setRemoteUser={setRemoteUser}
                setShowContact={setShowContact}
              />
            </Col>
            <Col
              style={Object.assign(styles.col, {justifyContent: 'flex-end'})}
              span={3}
            >
              <Space size='middle'>
                <Button
                  type='text'
                  shape='circle'
                  size='small'
                  icon=<Meta avatar=<Avatar icon=<ContactsOutlined /> /> />
                  onClick={handleFollowListOnClick}
                />
                <Button
                  type='text'
                  shape='circle'
                  size='small'
                  icon={
                    <Meta
                      avatar={
                        pictureUrl
                          ? ( <Avatar icon=<UserOutlined /> src={pictureUrl} /> )
                          : ( <Avatar icon=<UserOutlined /> /> )
                      }
                    />
                  }
                  onClick={handleSettingsOnClick}
                />
              </Space>
            </Col>
          </Row>
        </Header>
        <Content style={styles.content}>
          <Transition
            in={showContact && Boolean(remoteUser)}
            timeout={150}>
          {
            function(state) {
              return showContact && Boolean(remoteUser) && (
                <Space
                  style={styles.contactAnimation[state]}
                >
                  <Contact
                    user={user}
                    remoteUser={remoteUser}
                    muted={user.muteList.includes(remoteUser.pub)}
                    follow={
                      user.followList.map(function(u) { return u.pub })
                        .includes(remoteUser.pub)
                    }
                    setShowContact={setShowContact}
                    setFileTransferUser={setFileTransferUser}
                    sessionNotify={renderer.sessionNotify.bind(renderer)}
                    setAllowFileTransferDrawer={setAllowFileTransferDrawer}
                    setFileTransferDrawer={setFileTransferDrawer}
                    mutePub={renderer.mutePub.bind(renderer)}
                    unmutePub={renderer.unmutePub.bind(renderer)}
                    followPub={renderer.followPub.bind(renderer)}
                    unfollowPub={renderer.unfollowPub.bind(renderer)}
                    getZapParams={renderer.getZapParams.bind(renderer)}
                    getZapInvoice={renderer.getZapInvoice.bind(renderer)}
                    zap={renderer.zap.bind(renderer)}
                  />
                </Space>
              )
            }
          }
          </Transition>
        </Content>
      </Layout>
      <FollowList
        user={user}
        openFollowList={openFollowList}
        setOpenFollowList={setOpenFollowList}
        setFileTransferUser={setFileTransferUser}
        sessionNotify={renderer.sessionNotify.bind(renderer)}
        setAllowFileTransferDrawer={setAllowFileTransferDrawer}
        setFileTransferDrawer={setFileTransferDrawer}
        mutePub={renderer.mutePub.bind(renderer)}
        unmutePub={renderer.unmutePub.bind(renderer)}
        unfollowPub={renderer.unfollowPub.bind(renderer)}
        getZapParams={renderer.getZapParams.bind(renderer)}
        getZapInvoice={renderer.getZapInvoice.bind(renderer)}
        zap={renderer.zap.bind(renderer)}
      />
      {
        openSettings && (
          <Settings
            user={user}
            openSettings={openSettings}
            setOpenSettings={setOpenSettings}
            saveNsec={renderer.setNsec.bind(renderer)}
            isNsec={renderer.isNsec.bind(renderer)}
            getNpubFromNsec={renderer.getNpubFromNsec.bind(renderer)}
            addRelay={renderer.addRelay.bind(renderer)}
            removeRelay={renderer.removeRelay.bind(renderer)}
            isNwc={renderer.isNwc.bind(renderer)}
            setNwc={renderer.setNwc.bind(renderer)}
            deleteNwc={renderer.deleteNwc.bind(renderer)}
          />
        )
      }
    </>
  )
}

const styles = {
  layout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  header: {
    width: '100%',
    backgroundColor: 'transparent'
  },
  content: {
    padding: 0,
    backgroundColor: 'transparent'
  },
  row: {
    height: '100%'
  },
  col: {
    width: '100%',
    display: 'flex',
    alignItems: 'center'
  },
  icon: {
    fontSize: '24px',
    fontColor: 'white',
    color: 'white',
    borderColor: 'white'
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

module.exports = SessionReady
