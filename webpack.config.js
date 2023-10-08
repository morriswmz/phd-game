const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const path = require('path');

module.exports = {
    mode: "development",
    entry: "./src/app.ts",
    resolve: {
        extensions: ['.ts', '.js']
    },
    target: ['web', 'es6'],
    output: {
        filename: "app.bundle.js",
        path: path.join(__dirname, 'dist'),
        clean: true
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "ts-loader",
                exclude: /node_modules/,
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: path.join(__dirname, 'static'),
                to: path.join(__dirname, 'dist')
            }],
        })
    ],
    stats: 'verbose'
};
