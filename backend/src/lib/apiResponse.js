function createBaseResponse(status, message) {
  return {
    status,
    message,
    timestamp: new Date().toISOString()
  };
}

export function ok(data, message = "Success", status = 200) {
  return {
    ...createBaseResponse(status, message),
    data
  };
}

export function fail(message, status = 400, errors) {
  return {
    ...createBaseResponse(status, message),
    errors
  };
}
