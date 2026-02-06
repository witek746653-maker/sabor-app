const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    const target = 'http://127.0.0.1:5000';

    // Проксируем основные API и статические пути
    app.use(
        ['/api', '/images', '/audio', '/scripts', '/menus', '/trainer', '/tools'],
        createProxyMiddleware({
            target: target,
            changeOrigin: true,
            secure: false
        })
    );
};
