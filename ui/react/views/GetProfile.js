const React = require('react')
const { useState } = require('react')
const { UserOutlined } = require('@ant-design/icons')
const { Input } = require('antd')
const { Search } = Input

const GetProfile = function(props) {
  const { getRemoteUser, setRemoteUser, setShowContact } = props

  const [ loading, setLoading ] = useState(false)

  const handleOnChange = async function(e) {
    const value = e.target.value
    if (value.length >= 3) {
      setLoading(true)
      const remoteUser = await getRemoteUser(value)
      setRemoteUser(remoteUser)
      if (remoteUser) {
        setShowContact(true)
      }
      setLoading(false)
      return
    }
    setShowContact(false)
  }

  return (
    <Search
      style={styles.search}
      size='large'
      placeholder='Search'
      prefix={<UserOutlined />}
      onChange={handleOnChange}
      loading={loading}
      allowClear
    />
  )
}

const styles = {
  search: {
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }
}

module.exports = GetProfile
