const React = require('react')
const { useState } = require('react')
const { Modal, Tabs } = require('antd')

const Keys = require('./Keys.js')
const Relays = require('./Relays.js')
const WalletConnect = require('./WalletConnect.js')

const Settings = function(props) {
  const {
    user,
    openSettings,
    setOpenSettings,
    saveNsec,
    isNsec,
    getNpubFromNsec,
    addRelay,
    removeRelay,
    isNwc,
    setNwc,
    deleteNwc
  } = props

  const [ activeTab, setActiveTab ] = useState('keys')

  const handleOnCancel = function(e) {
    setOpenSettings(false)
  }

  return (
    <Modal
      style={styles.modal.modal}
      styles={{body: styles.modal.body}}
      title='Settings'
      open={openSettings}
      setOpenSettings={setOpenSettings}
      onCancel={handleOnCancel}
      footer={null}
    >
      <Tabs
        size='small'
        defaultActiveKey='keys'
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'keys',
            label: `Keys`,
            children: (
              <Keys
                openSettings={openSettings}
                user={user}
                isNsec={isNsec}
                getNpubFromNsec={getNpubFromNsec}
                saveNsec={saveNsec}
              />
            )
          },
          {
            key: 'relays',
            label: `Relays`,
            children: (
              <Relays
                relays={user.relayList}
                addRelay={addRelay}
                removeRelay={removeRelay}
              />
            ),
          },
          {
            key: 'walletConnect',
            label: `Wallet Connect`,
            children: (
              <WalletConnect
                nwc={user.nwc}
                isNwc={isNwc}
                setNwc={setNwc}
                deleteNwc={deleteNwc}
              />
            ),
          }
        ]}
      />
    </Modal>
  )
}

const styles = {
  modal: {
    modal: {
      height: '50vh'
    },
    body: {
      height: '40vh'
    }
  }
}

module.exports = Settings
