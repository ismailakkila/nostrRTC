const React = require('react')
const { useState } = require('react')
const { Flex, Space, Input, Tag, Divider, Tooltip, message } = require('antd')
const { CloseCircleOutlined, PlusOutlined, LoadingOutlined } = require('@ant-design/icons')
const { isURL } = require('validator')

const Keys = function(props) {
  const { relays, addRelay, removeRelay } = props

  const [ messageApi, contextHolder ] = message.useMessage()
  const [ newRelay, setNewRelay ] = useState('')
  const [ newRelayError, setNewRelayError ] = useState(false)
  const [ loadingAddRelay, setLoadingAddRelay ] = useState(false)

  const handleNewRelayInput = async function(e) {
    const value = e.target.value
    setNewRelay(value)
    if (isURL(value)) {
      setNewRelayError(false)
    }
    else {
      setNewRelayError(true)
    }
  }

  const handleAddRelay = async function(e) {
    if (!newRelayError) {
      setLoadingAddRelay(true)
      const value = `wss://${newRelay.toLowerCase()}`
      const result = await addRelay(value)
      if (result) {
        messageApi.success('Saved!')
      }
      setLoadingAddRelay(false)
      setNewRelay('')
    }
  }

  const handleRemoveRelay = async function(r) {
    const result = await removeRelay(r)
    if (result) {
      messageApi.success('Saved!')
    }
  }

  const generateAddRelayIcon = function() {
    if (loadingAddRelay) {
      return (
        <LoadingOutlined disabled />
      )
    }
    if (newRelayError) {
      return null
    }
    return (
      <Tooltip title='Add'>
        <PlusOutlined
          onClick={handleAddRelay}
        />
      </Tooltip>
    )
  }

  const generateTags = function() {
    return relays.map(function(r) {
      return (
        <Tag
          key={r}
          closeIcon={<CloseCircleOutlined />}
          onClose={function(e) {handleRemoveRelay(r)}}
        >
          {r}
        </Tag>
      )
    })
  }

  return (
    <>
      {contextHolder}
      <Flex style={styles.mainContentHeight} vertical>
        <Space.Compact style={styles.mainContentChild}>
          <Input
            status={newRelayError ? 'error' : null}
            allowClear
            addonBefore='wss://'
            addonAfter={generateAddRelayIcon()}
            onChange={handleNewRelayInput}
            value={newRelay}
          />
        </Space.Compact>
        <Flex style={styles.tagsContentChild} vertical>
          <Space size={[0, 8]} wrap>
            {generateTags()}
          </Space>
        </Flex>
      </Flex>
    </>
  )
}

const styles = {
  mainContentHeight: {
    height: '30vh'
  },
  mainContentChild: {
    flexGrow: 1
  },
  tagsContentChild: {
    padding: '5px',
    overflow: 'auto',
    flexGrow: 2
  }
}

module.exports = Keys
