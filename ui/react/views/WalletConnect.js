const React = require('react')
const { useState } = require('react')
const { Flex, Input, Tooltip, Space, message } = require('antd')
const { CopyOutlined, SaveOutlined } = require('@ant-design/icons')

const WalletConnect = function(props) {
  const { nwc, isNwc, setNwc, deleteNwc } = props

  const [ messageApi, contextHolder ] = message.useMessage()
  const [ newNwc, setNewNwc ] = useState(nwc.split('nostr+walletconnect://')[1] || '')
  const [ newNwcError, setNwcError ] = useState(false)

  const handleNewNwcInput = async function(e) {
    const value = e.target.value
    setNewNwc(value)
    if (await isNwc(`nostr+walletconnect://${value.toLowerCase()}`)) {
      setNwcError(false)
    }
    else {
      if (value) {
        setNwcError(true)
      }
      else {
        setNwcError(false)
      }
    }
  }

  const handleSaveNwc = async function(e) {
    if (!newNwcError) {
      if (!newNwc) {
        deleteNwc()
        messageApi.success('Deleted!')
        return
      }
      const value = newNwc.toLowerCase()
      if (nwc !== value) {
        await setNwc(`nostr+walletconnect://${value.toLowerCase()}`)
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
      <Flex>
        <Space.Compact block>
          <Input
            status={newNwcError ? 'error' : null}
            allowClear
            addonBefore='nostr+walletconnect://'
            addonAfter={
              newNwcError
                ? null
                : (
                  <Tooltip title='Save'>
                    <SaveOutlined onClick={handleSaveNwc} />
                  </Tooltip>
                )
            }
            onChange={handleNewNwcInput}
            value={newNwc}
          />
        </Space.Compact>
        <Tooltip title='Copy'>
          <CopyOutlined
            style={styles.copyIcon}
            onClick={function(e) { handleCopy(nwc) }}
          />
        </Tooltip>
      </Flex>
    </>
  )
}

const styles = {
  copyIcon: {
    margin: '5px'
  }
}

module.exports = WalletConnect
