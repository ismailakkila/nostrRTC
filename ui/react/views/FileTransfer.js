const React = require('react')
const { useState, useEffect } = require('react')
const { InboxOutlined, UserOutlined, CopyOutlined } = require('@ant-design/icons')
const { App, Upload, Drawer, Card, Avatar, Space, Tooltip, Divider } = require('antd')
const { Dragger } = Upload
const { Meta } = Card

const FileTransfer = function(props) {
  const {
    renderer,
    fileTransferUser,
    setAllowFileTransferDrawer,
    fileTransferDrawer,
    setFileTransferDrawer,
    sessionNotify,
    sessionDisconnect,
    sendFile,
    abortFile,
    getIncomingFiles,
    getOutgoingFiles,
    isFile
  } = props

  const { message } = App.useApp()
  const [ title, setTitle ] = useState(fileTransferUser.profile.title)
  const [ pictureUrl, setPictureUrl ] = useState(fileTransferUser.profile.pictureUrl)
  const [ npub, setNpub ] = useState(fileTransferUser.npub)
  const [ incomingFiles, setIncomingFiles ] = useState(getIncomingFiles())

  const listeners = {
    incomingFileStatus: function(file) {
      if (file.status === 'uploading') {
        message.info(`${file.name} file is transferring.`)
        setFileTransferDrawer(true)
      }
      if (file.status === 'done' && file.url) {
        message.success(`${file.name} file transferred successfully.`)
      }
      if (file.status === 'error') {
        message.error(`${file.name} file transfer failed.`)
      }
      setIncomingFiles(getIncomingFiles())
    }.bind(renderer),
    incomingFileProgress: function(file) {
      setIncomingFiles(getIncomingFiles())
    }.bind(renderer),
  }

  useEffect(function() {
    renderer.on('incomingFileStatus', listeners.incomingFileStatus)
    renderer.on('incomingFileProgress', listeners.incomingFileProgress)
    return function() {
      renderer.removeListener('incomingFileStatus', listeners.incomingFileStatus)
      renderer.removeListener('incomingFileProgress', listeners.incomingFileProgress)
    }
  }, [])

  const handleIncomingFileDelete = function(file) {
    file.removed = true
    abortFile(file.uid)
    setIncomingFiles(getIncomingFiles())
  }

  const handleIncomingFileDownload = function(file) {
    if (file.url) {
      const a = document.createElement('a')
      a.href = file.url
      a.download = file.name
      a.style.display = 'none'
      a.click()
    }
  }

  const onClose = function() {
    setFileTransferDrawer(false)
    if (!renderer.pc) {
      setAllowFileTransferDrawer(false)
    }
  }

  const handleCopy = function(item) {
    navigator.clipboard.writeText(item)
    message.success('Copied!')
  }

  const draggerProps = {
    name: 'fileTransfer',
    multiple: true,
    beforeUpload: async function(file) {
      if (!(await isFile(file.path))) {
        message.error(`${file.name} is not a file!`)
        return Upload.LIST_IGNORE
      }
      if (!renderer.pc) {
        await sessionNotify(
          fileTransferUser,
          { audio: false, video: false, data: true}
        )
      }
    },
    customRequest: async function(info) {
      const {
        file,
        onError,
        onProgress,
        onSuccess,
      } = info

      await sendFile(
        file,
        function() {
          const percent = ((file.sent / file.size) * 100).toFixed(0)
          onProgress({ percent: percent })
        },
        onSuccess,
        onError
      )
    },
    onChange: function(info) {
      const { file, fileList } = info
      if (file.status === 'done') {
        message.success(`${file.name} file transferred successfully.`)
        return
      }
      if (file.status === 'removed') {
        file.removed = true
        abortFile(file.uid)
        return
      }
      if (file.status === 'error') {
        message.error(`${file.name} file transfer failed.`)
        return
      }
    }
  }

  return (
    <App>
      <Drawer
        styles={{ header: {paddingTop: '30px'} }}
        title="File Transfer"
        placement="right"
        onClose={onClose}
        open={fileTransferDrawer}
        extra={
          <Space>
            <Tooltip title='Copy npub'>
              <CopyOutlined
                onClick={
                  function(e) { handleCopy(npub) }
                }
              />
            </Tooltip>
            <Tooltip title={title}>
              <Meta
                avatar={
                  pictureUrl
                    ? ( <Avatar icon=<UserOutlined /> src={pictureUrl} /> )
                    : ( <Avatar icon=<UserOutlined /> /> )
                }
              />
            </Tooltip>
          </Space>
        }
      >
        <Divider>Outgoing Files</Divider>
        <Dragger
          style={styles.dragger}
          name={draggerProps.name}
          multiple={draggerProps.multiple}
          beforeUpload={draggerProps.beforeUpload}
          customRequest={draggerProps.customRequest}
          onChange={draggerProps.onChange}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag file to this area to upload</p>
          <p className="ant-upload-hint">
            Supports single or bulk uploads.
          </p>
        </Dragger>
        <Divider>Incoming Files</Divider>
        <Upload
          fileList={incomingFiles}
          onRemove={handleIncomingFileDelete}
          onPreview={handleIncomingFileDownload}
        />
      </Drawer>
    </App>
  )
}

const styles = {
  dragger: {
    maxHeight: '50%'
  }
}

module.exports = FileTransfer
