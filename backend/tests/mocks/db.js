// 数据库 mock
const mockPool = {
  query: jest.fn(),
  getConnection: jest.fn(),
  end: jest.fn(),
};

const testConnection = jest.fn().mockResolvedValue(true);

module.exports = {
  pool: mockPool,
  testConnection,
};
