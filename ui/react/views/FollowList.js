const React = require('react')
const { useEffect, useState } = require('react')
const { UserOutlined } = require('@ant-design/icons')
const { Drawer, Input } = require('antd')
const { Search } = Input

const Follow = require('./Follow.js')

const FollowList = function(props) {
  const {
    user,
    openFollowList,
    setOpenFollowList,
    setFileTransferUser,
    sessionNotify,
    setAllowFileTransferDrawer,
    setFileTransferDrawer,
    mutePub,
    unmutePub,
    unfollowPub,
    getZapParams,
    getZapInvoice,
    zap
  } = props

  const [ followList, setFollowList ] = useState(user.followList)

  useEffect(function() {
    setFollowList(user.followList)
  }, [user])

  const onClose = function(e) {
    setOpenFollowList(false)
  }

  const handleFilter = function(e) {
    const value = e.target.value
    if (value.length >= 3) {
      const matched = user.followList.filter(function(u) {
        return u.profile.title.toLowerCase()
          .includes(value.toLowerCase())
      })
      setFollowList(matched)
      return
    }
    setFollowList(user.followList)
  }

  const generateFollowList = function(items) {
    return items.map(function(f, i) {
      return (
        <Follow
          key={f.pub}
          followUser={f}
          muted={user.muteList.includes(f.pub)}
          zapsAllowed={user.nwc ? true : false}
          handleAudio={
            async function() {
              setOpenFollowList(false)
              await sessionNotify(f, {audio: true, video: false, data: false})
            }
          }
          handleVideo={
            async function() {
              setOpenFollowList(false)
              await sessionNotify(f, {audio: true, video: true, data: false})
            }
          }
          handleFileTransfer={
            function() {
              setFileTransferUser(f)
              setOpenFollowList(false)
              setAllowFileTransferDrawer(true)
              setFileTransferDrawer(true)
            }
          }
          mutePub={async function() {await mutePub(f.pub)}}
          unmutePub={async function() {await unmutePub(f.pub)}}
          unfollowPub={async function() {await unfollowPub(f.pub)}}
          getZapParams={getZapParams}
          getZapInvoice={getZapInvoice}
          zap={zap}
        />
      )
    }.bind(this))
  }

  return (
    <Drawer
      styles={{ header: {paddingTop: '30px'} }}
      placement="right"
      onClose={onClose}
      open={openFollowList}
      extra={
        <Search
          style={{width: '100%'}}
          size='large'
          placeholder='Search Follow List'
          prefix={<UserOutlined />}
          onChange={handleFilter}
          allowClear
        />
      }
    >
      {generateFollowList(followList)}
    </Drawer>
  )
}

module.exports = FollowList
