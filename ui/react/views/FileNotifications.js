const React = require('react')
import { FileOutlined, UserOutlined } from '@ant-design/icons';
const { Card, Space, Button, Avatar } = require('antd')
const { Meta } = Card

const FileNotifications = {
  handleSessionNotify: async function(
    params,
    onAccept,
    onClose
  ) {
    const profile = params.source.profile
    const { title, pictureUrl, description } = profile

    return {
      message: 'Incoming File Transfer',
      description: `${title} would you like to share files with you?`,
      icon: (
        <Meta
          avatar={
            pictureUrl
              ? ( <Avatar icon=<UserOutlined /> src={pictureUrl} /> )
              : ( <FileOutlined /> )
          }
        />
      ),
      btn: (
        <Space>
          <Button
            type='primary'
            size='small'
            onClick={onAccept}
          >
            Accept
          </Button>
        </Space>
      ),
      key: 0,
      duration: 60,
      onClose: onClose
    }
  }
}

module.exports = FileNotifications
