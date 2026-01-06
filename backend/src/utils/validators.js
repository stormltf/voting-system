function validateIdParam(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName];
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({
        error: `无效的${paramName}格式`
      });
    }
    
    req.params[paramName] = parsedId;
    next();
  };
}

function validateRequiredFields(requiredFields, options = {}) {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: options.message || `缺少必填字段: ${missingFields.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  validateIdParam,
  validateRequiredFields
};
