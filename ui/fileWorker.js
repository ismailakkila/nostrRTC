let files = new Map()

self.addEventListener("message", function(e) {
  switch(e.data.type) {
    case 'new':
      files.set(e.data.uid, [])
      break
    case 'done':
      const blob = new Blob(
        files.get(e.data.uid),
        { type: "application/octet-stream" }
      )
      const url = URL.createObjectURL(blob)
      self.postMessage({
        action: 'url',
        uid: e.data.uid,
        url: url
      })
      files.delete(e.data.uid)
      break
    case 'chunk':
      files.get(e.data.uid).push(e.data.chunk)
      break
  }
})
