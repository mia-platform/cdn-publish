

// ----------- 0.0.0/
const index = '<!DOCTYPE html><html></html>'
const indexHash = 'DC284EB4FBD61E7590A543C85622A91DDD8F8E2E20C58A14C3620D57394DBE1A'
const indexChecksum = '1623f1d081160d976dd6588373dd6e73e24af9a6ff056a653ebd0fba2f355bcd'
// -------------------

// 200 put / delete
const headers200 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 200 delete
const responseDelete200 = {
  HttpCode: 200,
  Message: 'File deleted successfuly.',
}

// 201 put
const response201 = {
  HttpCode: 201,
  Message: 'File uploaded.',
}
const headers201 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 204
const headers204 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/text',
  'transfer-encoding': 'chunked',
}

// 400
const response400 = ''
  + '<html>'
  + '<head><title>400 Bad Request</title></head>'
  + '<body>'
  + '<center><h1>400 Bad Request</h1></center>'
  + '<hr><center>nginx</center>'
  + '</body>'
  + '</html>'
const headers400 = {
  'access-control-allow-origin': '*',
  'content-type': 'text/html',
}

// 401
const response401 = {
  HttpCode: 401,
  Message: 'Unauthorized',
}
const headers401 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 404 get
const response404 = {
  HttpCode: 404,
  Message: 'Object Not Found',
}
const headers404 = headers200

const storageAccessKey = process.env.CDN_STORAGE_ACCESS_KEY ?? 'secret'
const accessKey = process.env.CDN_ACCESS_KEY ?? 'secret'
const storageZoneName = process.env.CDN_STORAGE_ZONE_NAME ?? 'mia-platform-test'
const serverStorageBaseUrl = process.env.CDN_STORAGE_BASE_URL ?? 'http://server'
const serverApiBaseUrl = process.env.CDN_API_BASE_URL ?? 'http://server'

const baseFile = {
  ArrayNumber: 0,
  Checksum: null,
  ContentType: '',
  DateCreated: '',
  Guid: '',
  IsDirectory: true,
  LastChanged: '',
  Length: 0,
  ObjectName: '',
  Path: '/__test/file0.txt',
  ReplicatedZones: null,
  ServerId: 0,
  StorageZoneId: 0,
  StorageZoneName: '',
  UserId: '',
}

const bunny = {
  headers200,
  headers201,
  headers204,
  headers400,
  headers401,
  headers404,
  response201,
  response400,
  response401,
  response404,
  responseDelete200,
}
export {
  indexHash,
  storageAccessKey,
  accessKey,
  bunny,
  storageZoneName,
  serverStorageBaseUrl,
  serverApiBaseUrl,
  indexChecksum,
  index,
}
