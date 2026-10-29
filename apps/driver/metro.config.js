const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 與 ios/app/Info.plist RCTMetroPort 一致；避免司機 app 誤連 8081 乘客 Metro（會觸發 RNMapsAirModule 等錯誤）
config.server = { ...config.server, port: 8082 };

module.exports = config;
