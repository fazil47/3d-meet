const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const appDirectory = fs.realpathSync(process.cwd());

module.exports = merge(common, {
  mode: "development",
  devServer: {
    host: "0.0.0.0",
    port: 8080, //port that we're using for local host (localhost:8080)
    static: path.resolve(appDirectory, "public"), //tells webpack to serve from the public folder
    hot: true,
    devMiddleware: {
      publicPath: "/",
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(appDirectory, "public/index.html"),
      filename: "index.html",
      templateParameters: {
        roomId: "1234-1234-1234-1234",
      },
    }),
  ],
  output: {
    filename: "js/bundle.js", //name for the js file that is created/compiled in memory
    path: path.resolve(appDirectory, "dist"), //path to the folder where the js file is created/compiled in memory
    clean: true,
  },
});
