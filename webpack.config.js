module.exports = {
  entry: ['babel-polyfill', 'whatwg-fetch', './src/app.js'],
  output: {
    path: `${__dirname}/build/`,
    filename: 'bundle.js',
  },
  mode: 'development',
  devtool: 'inline-source-map',
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: {
        presets: ['env'],
      },
    }],
  },
};