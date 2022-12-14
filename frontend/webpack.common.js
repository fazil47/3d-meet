require("dotenv").config();

const path = require("path");
const webpack = require("webpack");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const appDirectory = fs.realpathSync(process.cwd());

module.exports = {
  entry: path.resolve(appDirectory, "src/app.ts"), //path to the main .ts file
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: ["Assets/generated", "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.glb/,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: path.resolve(appDirectory, "public/index.html"),
      filename: "index.html",
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(process.env)
    }),
  ],
  output: {
    filename: "js/bundle.js", //name for the js file that is created/compiled in memory
    path: path.resolve(appDirectory, "dist"), //path to the folder where the js file is created/compiled in memory
    clean: true,
  },
};
