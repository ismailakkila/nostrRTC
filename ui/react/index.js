const React = require('react')
const { createRoot } = require('react-dom/client')
const Home = require('./views/Home.js')

class UI {
  constructor(renderer) {
    this.renderer = renderer
  }

  init() {
    const domNode = window.document.createElement('div')
    domNode.id = 'root'
    const root = createRoot(domNode)
    window.document.body.appendChild(domNode)
    root.render(<Home rendererProp={this.renderer} />)
  }
}

module.exports = UI
