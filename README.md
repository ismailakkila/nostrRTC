# nostrRTC

nostrRTC is an electron based application that utilizes your [`nostr`](https://nostr.com) identity to establish one-to-one [`webRTC`](https://webrtc.org) sessions to other nostr identities. Sessions can be video, audio or data file transfer sessions. Peer-to-peer connectivity is established using the [`holepunch`](https://holepunch.to) protocol.

## Features

 - Contact list based on [`NIP02`](https://github.com/nostr-protocol/nips/blob/master/02.md) follow list (kind 3)
 - Mute list based on [`NIP51`](https://github.com/nostr-protocol/nips/blob/master/51.md) (kind 10000)
 - Relay list based on [`NIP65`](https://github.com/nostr-protocol/nips/blob/master/65.md) (kind 10002)
 - Wallet connect based on [`NIP47`](https://github.com/nostr-protocol/nips/blob/master/47.md) to allow for zapping identities
 - Picture-in-picture support for video calls

Tested on Mac and Ubuntu Linux.

## Getting Started

You can build the application for your platform using:

```
npm install
npm run make
```

Alternatively, install provided binary for your platform [`here`](https://github.com/ismailakkila/nostrRTC/releases/)


For development purposes, you can also run the following:

```
npm install
npm run electron
```

## Usage

The application will automatically generate nsec keys for a nostr identity but you can use your own nsec key to be able to use your own identity. The application will append a tag that includes the nostrRTC public key to the nostr identity kind 0 metadata to be able to discover and establish nostrRTC webRTC sessions with other nostr identities.  

## Disclaimer

This application is more of a work in progress and a proof of concept. Feel free to fork and modify the project.
