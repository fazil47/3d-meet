const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const appDirectory = fs.realpathSync(process.cwd());
const parentDirectory = path.join(appDirectory, "../");

module.exports = merge(common, {
  mode: "production",
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(appDirectory, "public/index.html"),
      filename: "room.ejs",
      templateParameters: {
        roomId: "<%= roomId %>",
      },
    }),
  ],
  output: {
    filename: "js/bundle.js", //name for the js file that is created/compiled in memory
    path: path.resolve(parentDirectory, "views"), //path to the folder where the js file is created/compiled in memory
    clean: false,
  },
});
