const errorMiddleware = require('../../src/middleware/error');

describe('Error Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      url: '/api/test',
      method: 'GET',
      user: { id: 123 },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('应该处理 ValidationError 并返回 400', () => {
    const err = { name: 'ValidationError', message: 'bad input', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '请求数据验证失败',
      details: 'bad input',
    });
  });

  it('应该处理 UnauthorizedError 并返回 401', () => {
    const err = { name: 'UnauthorizedError', message: 'no', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '未授权访问',
    });
  });

  it('应该处理 ER_DUP_ENTRY 并返回 409', () => {
    const err = { code: 'ER_DUP_ENTRY', message: 'dup', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '数据已存在，无法重复创建',
    });
  });

  it('应该处理外键约束错误并返回 400', () => {
    const err = { code: 'ER_NO_REFERENCED_ROW_2', message: 'fk', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '关联的数据不存在',
    });
  });

  it('应该处理包含“文件类型”的错误并返回 400（透传 message）', () => {
    const err = { message: '文件类型不支持', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '文件类型不支持',
    });
  });

  it('应该对未知错误返回 500（不泄露详情）', () => {
    const err = { message: 'unknown', stack: 'stack' };

    errorMiddleware(err, mockReq, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: '服务器内部错误，请稍后重试',
    });
  });

  it('当 req.user 不存在时也能正常工作', () => {
    const err = { name: 'ValidationError', message: 'bad', stack: 'stack' };
    const reqWithoutUser = { url: '/api/test', method: 'GET' };

    errorMiddleware(err, reqWithoutUser, mockRes, nextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

