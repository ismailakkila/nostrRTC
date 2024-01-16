const React = require('react')
const { useState } = require('react')
const { Input, Tooltip, Space, Flex, message } = require('antd')
const { KeyOutlined, CopyOutlined, SaveOutlined } = require('@ant-design/icons')

const Keys = function(props) {
  const { openSettings, user, isNsec, getNpubFromNsec, saveNsec } = props

  const [ messageApi, contextHolder ] = message.useMessage()
  const [ nsec, setNsec ] = useState(user.nsec)
  const [ npub, setNpub ] = useState(user.npub)
  const [ nsecError, setNsecError ] = useState(false)

  const handleNsecInput = async function(e) {
    const value = e.target.value
    setNsec(value)
    if (await isNsec(value)) {
      setNsecError(false)
      setNpub(await getNpubFromNsec(value))
    }
    else {
      setNsecError(true)
      setNpub('')
    }
  }

  const handleSaveNsec = async function(e) {
    if (!nsecError) {
      if (user.nsec !== nsec) {
        await saveNsec(nsec)
      }
      messageApi.success('Saved!')
    }
  }

  const handleCopy = function(item) {
    navigator.clipboard.writeText(item)
    messageApi.success('Copied!')
  }

  return (
    <>
      {contextHolder}
      <Flex vertical>
        <Flex style={styles.inputRow}>
          <Space.Compact block>
            <Input
              status={nsecError ? 'error' : '' }
              placeholder="nsec key"
              prefix={<KeyOutlined />}
              onChange={handleNsecInput}
              value={nsec}
              addonAfter={
                nsecError
                  ? null
                  : (
                    <Tooltip title='Save'>
                      <SaveOutlined onClick={handleSaveNsec} />
                    </Tooltip>
                  )
              }
            />
          </Space.Compact>
          <Tooltip title='Copy'>
            <CopyOutlined
              style={styles.copyIcon}
              onClick={function(e) { handleCopy(user.nsec) }}
            />
          </Tooltip>
        </Flex>
        <Flex style={styles.inputRow}>
          <Space.Compact block>
            <Input
              disabled
              placeholder='npub key'
              value={npub}
            />
          </Space.Compact>
          <Tooltip title='Copy'>
            <CopyOutlined
              style={styles.copyIcon}
              onClick={function(e) { handleCopy(user.npub) }}
            />
          </Tooltip>
        </Flex>
      </Flex>
    </>
  )
}

const styles = {
  inputRow: {
    margin: '5px'
  },
  copyIcon: {
    margin: '5px'
  }
}

module.exports = Keys
