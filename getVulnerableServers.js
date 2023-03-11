const criminalIpApiKey = ""; // get at https://www.criminalip.io/mypage/information
import { request } from "undici";
import { writeFileSync } from "node:fs"

(async () => {
    let results = [];
    const { body } = await request(`https://api.criminalip.io/v1/banner/search?query="addNZBFromFile" status_code:200 title:SABnzbd&offset=0`, {
        headers: {
            "X-Api-Key": criminalIpApiKey
        }
    });

    const resp = await body.json();
    const loopAmount = Math.ceil(resp.data.count / 100);
    results.push(...resp.data.result);
    for (let i = 1; i < loopAmount; i++) {
        const { body } = await request(`https://api.criminalip.io/v1/banner/search?query="addNZBFromFile" status_code:200 title:SABnzbd&offset=${i * 100}`, {
            headers: {
                "X-Api-Key": criminalIpApiKey
            }
        });
        const resp = await body.json();
        results.push(...resp.data.result);
    };
    
    let mappedResults = results.map(result => ({
        ip: result.ip_address,
        port: result.open_port_no
    }));
    writeFileSync("vulnServers.json", JSON.stringify(mappedResults, null, 4))
})();