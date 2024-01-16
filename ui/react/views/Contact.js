const React = require('react')
const { useEffect, useState } = require('react')
const {
  PhoneFilled,
  VideoCameraFilled,
  UploadOutlined,
  UserOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  ThunderboltFilled,
  SoundOutlined,
  StopOutlined,
  CheckOutlined,
  ExclamationOutlined
} = require('@ant-design/icons')
const {
  Card,
  Avatar,
  Tooltip,
  Flex,
  Button,
  Space,
  Badge,
  Slider,
  InputNumber,
  Typography,
  message
} = require('antd')
const { Meta } = Card
const { Text } = Typography

const Contact = function(props) {
  const {
    user,
    remoteUser,
    muted,
    follow,
    setShowContact,
    setFileTransferUser,
    sessionNotify,
    setAllowFileTransferDrawer,
    setFileTransferDrawer,
    mutePub,
    unmutePub,
    followPub,
    unfollowPub,
    getZapParams,
    getZapInvoice,
    zap
  } = props
  const { title, description, pictureUrl, lud06, lud16 } = remoteUser.profile
  const [ messageApi, contextHolder ] = message.useMessage()
  const [ loadingMute, setLoadingMute ] = useState(false)
  const [ loadingFollow, setLoadingFollow ] = useState(false)
  const [ loadingZapParams, setLoadingZapParams ] = useState(false)
  const [ loadingZapPayment, setLoadingZapPayment ] = useState(false)
  const [ zapPaymentSuccess, setZapPaymentSuccess ] = useState(false)
  const [ zapPaymentFailure, setZapPaymentFailure ] = useState(false)
  const [ zapParams, setZapParams ] = useState(null)
  const [ zapAmount, setZapAmount ] = useState(0)

  useEffect(function() {
    if (zapParams) {
      const { minSendable, maxSendable } = zapParams
      const minSendableSats = Math.ceil(minSendable / 1000)
      const maxSendableSats = Math.floor(maxSendable / 1000)
      setZapAmount(minSendableSats)
    }
  }, [zapParams])

  const handleCopy = function(item) {
    navigator.clipboard.writeText(item)
    messageApi.success('Copied!')
  }

  const handleClickAudioCall = async function(e) {
    await sessionNotify(remoteUser, {audio: true, video: false, data: false})
    setShowContact(false)
  }

  const handleClickVideoCall = async function(e) {
    await sessionNotify(remoteUser, {audio: true, video: true, data: false})
    setShowContact(false)
  }

  const handleClickFile = function(e) {
    setFileTransferUser(remoteUser)
    setShowContact(false)
    setAllowFileTransferDrawer(true)
    setFileTransferDrawer(true)
  }

  const handleClickMute = async function(e) {
    if (!loadingMute && remoteUser.pub !== user.pub) {
      setLoadingMute(true)
      if (muted) {
        await unmutePub(remoteUser.pub)
      }
      else {
        await mutePub(remoteUser.pub)
      }
      setLoadingMute(false)
    }
  }

  const handleClickFollow = async function(e) {
    if (!loadingFollow) {
      setLoadingFollow(true)
      if (follow) {
        await unfollowPub(remoteUser.pub)
      }
      else {
        await followPub(remoteUser.pub)
      }
      setLoadingFollow(false)
    }
  }

  const handleClickZapParams = async function(e) {
    const zapAddress = lud16 || lud06 || ''
    if (!zapParams) {
      setLoadingZapParams(true)
      setZapParams(await getZapParams(zapAddress))
      setLoadingZapParams(false)
    }
    else {
      setZapParams(null)
    }
  }

  const handleZapPayment = async function(e) {
    if (zapParams) {
      setLoadingZapPayment(true)
      const { callback } = zapParams
      const invoice = await getZapInvoice({
        callbackUrl: callback,
        amount: zapAmount * 1000
      })
      if (!invoice) {
        setLoadingZapPayment(false)
        messageApi.open({
          type: 'warning',
          icon: (<ThunderboltFilled />),
          content: 'Zap Failed!'
        })
        setZapPaymentFailure(true)
        setTimeout(function() { setZapPaymentFailure(false) }, 2000)
        return
      }
      const preimage = await zap(invoice)
      setLoadingZapPayment(false)
      if (!preimage) {
        messageApi.open({
          type: 'warning',
          icon: (<ThunderboltFilled />),
          content: 'Zap Failed!'
        })
        setZapPaymentFailure(true)
        setTimeout(function() { setZapPaymentFailure(false) }, 2000)
      }
      else {
        messageApi.open({
          type: 'success',
          icon: (<ThunderboltFilled />),
          content: 'Zapped!'
        })
        setZapPaymentSuccess(true)
        setTimeout(function() { setZapPaymentSuccess(false) }, 2000)
      }
    }
  }

  const generateAvatar = function() {
    const zapAddress = lud16 || lud06 || ''
    if (zapAddress) {
      if (pictureUrl) {
        return (
          <Tooltip title={remoteUser.npub}>
            <Badge
              count={<ThunderboltFilled style={{color: 'orange'}} />}
            >
              <Avatar
                icon=<UserOutlined />
                src={pictureUrl}
                onClick={function() {handleCopy(remoteUser.npub)}}
              />
            </Badge>
          </Tooltip>
        )
      }
      else {
        return (
          <Tooltip title={remoteUser.npub}>
            <Badge
              count={<ThunderboltFilled style={{color: 'orange'}} />}
            >
              <Avatar
                icon=<UserOutlined />
                onClick={function() {handleCopy(remoteUser.npub)}}
              />
            </Badge>
          </Tooltip>
        )
      }
    }
    else {
      if (pictureUrl) {
        return (
          <Tooltip title={remoteUser.npub}>
            <Avatar
              icon=<UserOutlined />
              src={pictureUrl}
              onClick={function() {handleCopy(remoteUser.npub)}}
            />
          </Tooltip>
        )
      }
      else {
        return (
          <Tooltip title={remoteUser.npub}>
            <Avatar
              icon=<UserOutlined />
              onClick={function() {handleCopy(remoteUser.npub)}}
            />
          </Tooltip>
        )
      }
    }
  }

  const generateActions = function() {
    if (remoteUser.nostrRTCPub) {
      return (
        [
          <Tooltip title='Audio Call'>
            <PhoneFilled
              style={styles.icon}
              key='audioCall'
              onClick={handleClickAudioCall}
            />
          </Tooltip>,
          <Tooltip title='Video Call'>
            <VideoCameraFilled
              style={styles.icon}
              key='videoCall'
              onClick={handleClickVideoCall}
            />
          </Tooltip>,
          <Tooltip title='Send a File'>
            <UploadOutlined
              style={styles.icon}
              key='file'
              onClick={handleClickFile}
            />
          </Tooltip>
        ]
      )
    }
    return []
  }

  const generateMuteIcon = function() {
    if (loadingMute) {
      return (
        <Button
          icon=<LoadingOutlined />
          size='small'
          disabled
        />
      )
    }
    if (muted) {
      return (
        <Tooltip title='Unmute'>
          <Button
            icon=<SoundOutlined style={{color: 'green'}} />
            size='small'
            onClick={handleClickMute}
          />
        </Tooltip>
      )
    }
    return (
      <Tooltip title='Mute'>
        <Button
          icon=<StopOutlined style={{color: 'red'}} />
          size='small'
          onClick={handleClickMute}
        />
      </Tooltip>
    )
  }

  const generateFollowIcon = function() {
    if (loadingFollow) {
      return (
        <Button
          icon=<LoadingOutlined />
          size='small'
          disabled
        />
      )
    }
    if (follow) {
      return (
        <Tooltip title='Unfollow'>
          <Button
            icon=<UserDeleteOutlined style={{color: 'green'}} />
            size='small'
            onClick={handleClickFollow}
          />
        </Tooltip>
      )
    }
    return (
      <Tooltip title='Follow'>
        <Button
          icon=<UserAddOutlined style={{color: 'red'}} />
          size='small'
          onClick={handleClickFollow}
        />
      </Tooltip>
    )
  }

  const generateZapIcon = function() {
    const zapAddress = lud16 || lud06 || ''
    if (zapAddress) {
      if (loadingZapParams) {
        return (
          <Button
            icon=<LoadingOutlined />
            size='small'
            disabled
          />
        )
      }
      if (!user.nwc) {
        return (
          <Tooltip title='Wallet Connect Required'>
            <Button
              disabled
              icon={<ThunderboltFilled style={{color: 'orange'}} />}
              size='small'
            />
          </Tooltip>
        )
      }
      return (
        <Tooltip title='Zap'>
          <Button
            icon={<ThunderboltFilled style={{color: 'orange'}} />}
            size='small'
            onClick={handleClickZapParams}
          />
        </Tooltip>
      )
    }
    return null
  }

  const generateZapButtons = function() {
    const zapAmounts = [
      [21, 129305, '21'],
      [69, 128536, '69'],
      [420, 127807, '420'],
      [5000, 128153, '5k'],
      [10000, 128525, '10k'],
      [20000, 129321, '20k'],
      [50000, 128293, '50k'],
      [100000, 128640, '100k'],
    ]
    const buttons = []

    const { minSendable, maxSendable } = zapParams
    const minSendableSats = Math.ceil(minSendable / 1000)
    const maxSendableSats = Math.floor(maxSendable / 1000)

    zapAmounts.forEach(function(zapButton) {
      const [ zapAmount, emoji, displayAmount ] = zapButton
      if (zapAmount >= minSendableSats && zapAmount <= maxSendableSats) {
        buttons.push((
          <Button
            key={zapAmount}
            size='small'
            onClick={function() {setZapAmount(zapAmount)}}
            block
          >
             {String.fromCodePoint(emoji)} {displayAmount}
          </Button>)
        )
      }
    })
    const groups = Array.from(
      { length: Math.ceil(buttons.length / 4) },
      function(v, i) {
        return buttons.slice(i * 4, i * 4 + 4)
      }
    )
    return groups.map(function(g, i) {
      return (
        <Space.Compact key={i} block>
          {g}
        </Space.Compact>
      )
    })
  }

  const generateZapPaymentButton = function() {
    if (zapParams) {
      const { minSendable, maxSendable } = zapParams
      const minSendableSats = Math.ceil(minSendable / 1000)
      const maxSendableSats = Math.floor(maxSendable / 1000)

      if (loadingZapPayment) {
        return (
          <Button
            type="primary"
            icon=<LoadingOutlined />
            disabled
          >
            Zap
          </Button>
        )
      }
      if (zapPaymentSuccess) {
        return (
          <Button
            type="primary"
            icon=<CheckOutlined />
          >
            Zap
          </Button>
        )
      }
      if (zapPaymentFailure) {
        return (
          <Button
            type="primary"
            icon=<ExclamationOutlined />
          >
            Zap
          </Button>
        )
      }
      return (
        <Button
          type="primary"
          icon=<ThunderboltFilled />
          onClick={handleZapPayment}
          disabled={
            (zapAmount < minSendableSats) || (zapAmount > maxSendableSats)
              ? true
              : false
          }
        >
          Zap
        </Button>
      )
    }
    return null
  }

  const generateZapParams = function() {
    if (zapParams) {
      const { minSendable, maxSendable } = zapParams
      const minSendableSats = Math.ceil(minSendable / 1000)
      const maxSendableSats = Math.floor(maxSendable / 1000)

      return (
        <Flex style={{padding: 10}} justify='center' align='center' vertical>
          {generateZapButtons()}
          <InputNumber
            style={{margin: 10}}
            min={minSendableSats}
            max={maxSendableSats}
            value={zapAmount}
            addonBefore='Sats'
            onChange={function(n) { setZapAmount(n) }}
          />
          {generateZapPaymentButton()}
        </Flex>
      )
    }
  }

  const generateTitle = function() {
    const titleSplit = title.split('\n')
    const firstLine = titleSplit[0]
    const secondLine = titleSplit[1]
    if (firstLine && secondLine) {
      return (
        <Space.Compact direction='vertical' size='small'>
          <Text ellipsis={true}>{firstLine}</Text>
          <Text ellipsis={true}>{secondLine}</Text>
        </Space.Compact>
      )
    }
    if (firstLine) {
      return (
        <Text ellipsis={true}>{firstLine}</Text>
      )
    }
    if (secondLine) {
      return (
        <Text ellipsis={true}>{secondLine}</Text>
      )
    }
  }

  return (
    <>
      {contextHolder}
      <Card
        style={styles.card}
        hoverable
        actions={generateActions()}
      >
        <Meta
          avatar={generateAvatar()}
          title={(
            <Flex gap="small" justify='space-between'>
              {generateTitle()}
              <Space.Compact>
                {generateMuteIcon()}
                {generateFollowIcon()}
                {generateZapIcon()}
              </Space.Compact>
            </Flex>
          )}
          description={description}
        />
        {generateZapParams()}
      </Card>
    </>
  )
}

const styles = {
  card: {
    width: '400px',
    backgroundColor: 'white'
  },
  icon: {
    fontSize: '18px',
    color: '#00b966'
  }
}

module.exports = Contact
