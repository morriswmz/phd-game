const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const path = require('path');

module.exports = {
    mode: "development",
    entry: "./src/app.ts",
    resolve: {
        extensions: ['.ts', '.js']
    },
    output: {
        filename: "app.bundle.js",
        path: path.join(__dirname, 'dist')
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "awesome-typescript-loader"
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin([{
            from: path.join(__dirname, 'static'),
            to: path.join(__dirname, 'dist')
        }]),
        new UglifyJsPlugin({
            sourceMap: true
        })
    ]
};
