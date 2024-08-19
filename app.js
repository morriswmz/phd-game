const express = require('express');

let port = process.env.PORT || 8000; // 使用 Vercel 提供的端口
let app = express();
app.use(express.static('./static'));
app.listen(port, () => {
    console.log(`Server started on port ${port}.\nPlease navigate to http://localhost:${port} in your browser.`);
});
