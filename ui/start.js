const Renderer = require('./renderer.js')
const UI = require('./react/index.js')

const start = async function() {
  window.onload = async function() {
    window.addEventListener('dragover', function(event) {event.preventDefault()})
    const renderer = new Renderer()
    await renderer.init()
    const ui = new UI(renderer)
    await ui.init()
  }
}

start()
