# sabgrab
(ab)uses [LeakySAB](https://github.com/rlaphoenix/LeakySAB-PoC) to get providers from open SABnzbd instances.

# demo
https://user-images.githubusercontent.com/62519659/224592891-9016ddc6-3f33-4b9c-9cc2-b81662df1099.mp4

# usage
1. `npm i`
2. configure `config.json` (please fill in host field and not leave it 127.0.0.1)
3. `node index.js`

in new terminal,
1. get criminalip api key [here](https://www.criminalip.io/mypage/information)
2. edit `getVulnerableServers.js` to add api key
3. `node getVulnerableServers.js`
4. `node testVulnerableServers.js`
5. profit! credentials are saved at `creds.json`
