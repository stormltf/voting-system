/* eslint-disable no-console */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, _next) {
  console.error('错误详情:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    user: req.user ? req.user.id : 'anonymous'
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '请求数据验证失败',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: '未授权访问'
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: '数据已存在，无法重复创建'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      error: '关联的数据不存在'
    });
  }

  if (err.message && err.message.includes('文件类型')) {
    return res.status(400).json({
      error: err.message
    });
  }

  return res.status(500).json({
    error: '服务器内部错误，请稍后重试'
  });
}

module.exports = errorMiddleware;
