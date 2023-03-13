# sabgrab
(ab)uses [LeakySAB](https://github.com/rlaphoenix/LeakySAB-PoC) to get providers from open SABnzbd instances.

# table of contents
- [demo](#demo)
- [api](#api)
- [troubleshooting](#troubleshooting)

# demo
`webui`
![image](https://user-images.githubusercontent.com/62519659/224598128-567e69e9-adc3-4059-9e9e-25855d7d7926.png)

`testVulnerableServers.js`

https://user-images.githubusercontent.com/62519659/224592891-9016ddc6-3f33-4b9c-9cc2-b81662df1099.mp4

# usage
1. `npm i`
2. configure `config.json` (please fill in host field and not leave it 127.0.0.1)
3. `node index.js`
4. web ui accessible at `:8112`

in new terminal,
1. get criminalip api key [here](https://www.criminalip.io/mypage/information)
2. edit `getVulnerableServers.js` to add api key
3. `node getVulnerableServers.js`
4. `node testVulnerableServers.js`
5. profit! credentials are saved at `creds.json`

# api
## cors is **NOT** enabled.

sending a request to `:8112/address:port` will return the following responses:

success:
```json
{
  "error": false,
  "data": [
    {
      "server": "example.com",
      "host": "example.com",
      "description": "example.com",
      "username": "username",
      "password": "password",
      "port": "1234",
      "ssl": false,
    },
    {
      "server": "example2.com",
      "host": "example2.com",
      "description": "example2.com",
      "username": "username2",
      "password": "password2",
      "port": "12345",
      "ssl": true,
    },
  ]
}
```

error:
```json
{
  "error": true,
  "data": {
    "message": "error"
  }
}
```

# troubleshooting
make sure that port 8119 and port 8112 is open.
