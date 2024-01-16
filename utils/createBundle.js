const fs = require('fs')
const browserify = require('browserify')

const b = new browserify({
  entries: ['./ui/start.js'],
  transform: [
    [
      'babelify',
      {
        presets: [
          '@babel/preset-env',
          '@babel/preset-react'
        ]
      }
    ]
  ],
  cache: {},
  packageCache: {}
})

const bundle = function() {
  b.bundle()
    .on('error', console.error)
    .pipe(fs.createWriteStream('./ui/bundle.js'))
}

bundle()
