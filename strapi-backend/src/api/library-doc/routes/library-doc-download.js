'use strict';
/* Tải tài liệu công khai: auth:false vì văn bản/luật là nội dung ai cũng xem
   được, nhưng có giới hạn tần suất để không hút được cả kho trong một lượt. */
const { rateLimit, DOWNLOAD_LIMIT } = require('../../../utils/rate-limit');

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/library-docs/:documentId/download',
      handler: 'library-doc-download.download',
      config: { auth: false, middlewares: [rateLimit(DOWNLOAD_LIMIT)] },
    },
  ],
};
