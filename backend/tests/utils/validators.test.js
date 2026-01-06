const { validateIdParam, validateRequiredFields } = require('../../src/utils/validators');

describe('Validators Utils', () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('validateIdParam', () => {
    it('应该在参数不是数字时返回 400', () => {
      mockReq.params.id = 'abc';
      const mw = validateIdParam('id');

      mw(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '无效的id格式' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('应该在参数小于等于 0 时返回 400', () => {
      mockReq.params.id = '0';
      const mw = validateIdParam('id');

      mw(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('应该将参数解析为 number 并调用 next', () => {
      mockReq.params.ownerId = '12';
      const mw = validateIdParam('ownerId');

      mw(mockReq, mockRes, nextFunction);

      expect(mockReq.params.ownerId).toBe(12);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('validateRequiredFields', () => {
    it('应该在缺少必填字段时返回 400 并列出字段名', () => {
      mockReq.body = { a: 'ok', b: '' };
      const mw = validateRequiredFields(['a', 'b', 'c']);

      mw(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '缺少必填字段: b, c' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('应该允许 0 这类 falsy 但合法的值', () => {
      mockReq.body = { count: 0 };
      const mw = validateRequiredFields(['count']);

      mw(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('当所有字段存在时应调用 next', () => {
      mockReq.body = { a: '1', b: 2, c: false };
      const mw = validateRequiredFields(['a', 'b', 'c']);

      mw(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});

